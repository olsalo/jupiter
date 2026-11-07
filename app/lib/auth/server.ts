import { hasOrganizationPermission, organizationAccessControl, organizationRoles } from "~/lib/auth/permissions"
import { i18n } from "@better-auth/i18n"
import { stripe } from "@better-auth/stripe"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { TRPCError } from "@trpc/server"
import { consumeRequestBudgets, otpRequestBudgets } from "~/.server/services/request-budget"
import { trustedClientIp, trustedIpHeader } from "~/lib/http/client-ip.server"
import { linkInvitationStaff } from "~/.server/services/team"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { emailOTP, organization } from "better-auth/plugins"
import { plans } from "~/lib/billing/plans"
import { getStripePriceId, stripeClient, stripeBillingEnabled } from "~/lib/billing/stripe.server"
import { isDemoMode } from "~/lib/billing/billing.server"
import { getBillingPortalConfiguration, reconcileOrganizationBilling, syncStripeSubscription } from "~/lib/billing/subscriptions.server"
export { stripeBillingEnabled } from "~/lib/billing/stripe.server"

import enAuth from "~/locales/en/auth.json"
import fiAuth from "~/locales/fi/auth.json"

import { fallbackLanguage, supportedLanguages } from "~/locales"
import type { BillingNotification } from "~/lib/billing/billing"
import { getEmailLocale } from "~/lib/auth/email-locale.server"
import { localeCookie } from "~/lib/http/cookies.server.ts"
import {
  emailOtpExpiresInMinutes,
  sendOtpEmail,
  sendEmail,
} from "~/lib/email/email.server.ts"
import { createInvitationEmailTemplate } from "~/lib/email-templates/invitation"
import { prisma } from "~/lib/database/prisma.server.ts"
import { generateId } from "~/lib/database/id"

const fallbackAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:5175"
const oneYearInSeconds = 60 * 60 * 24 * 365
const twoWeeksInSeconds = 60 * 60 * 24 * 14

const developmentAllowedHosts = [
  "localhost:*",
  "127.0.0.1:*",
  "[::1]:*",
  "0.0.0.0:*",
]

const envAllowedHosts = process.env.BETTER_AUTH_ALLOWED_HOSTS?.split(",")
  .map((host) => host.trim())
  .filter(Boolean) ?? []

const fallbackAuthHost = getHostPattern(fallbackAuthUrl)

const allowedHosts = [
  ...(process.env.NODE_ENV === "production" ? [] : developmentAllowedHosts),
  ...(fallbackAuthHost ? [fallbackAuthHost] : []),
  ...envAllowedHosts,
]

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripeSoloPriceId = getStripePriceId("solo", "month")

const stripePlugin = createStripePlugin()

export const auth = betterAuth({
  baseURL: {
    allowedHosts: Array.from(new Set(allowedHosts)),
    fallback: fallbackAuthUrl,
    protocol: "auto",
  },
  secret: process.env.BETTER_AUTH_SECRET,
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    expiresIn: oneYearInSeconds,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    ipAddress: { ipAddressHeaders: [trustedIpHeader()] },
    // Local production builds use HTTP too, so NODE_ENV cannot decide cookie security.
    useSecureCookies: new URL(fallbackAuthUrl).protocol === "https:",
    database: {
      generateId,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/list-sessions") {
        // Viewing sessions requires a valid sign-in, regardless of its age.
        ctx.context.sessionConfig = { ...ctx.context.sessionConfig, freshAge: 0 }
        return
      }
      // Run before OTP creation so rejected sends do not invalidate a code that
      // is already in the customer's inbox. These limits do not depend on IP.
      if (!["/email-otp/send-verification-otp", "/email-otp/request-password-reset", "/forget-password/email-otp", "/email-otp/request-email-change"].includes(ctx.path)) return
      if (process.env.NODE_ENV === "development") return
      const email = ctx.path === "/email-otp/request-email-change" ? ctx.body?.newEmail : ctx.body?.email
      if (typeof email !== "string" || email.length > 254) throw new APIError("BAD_REQUEST", { message: "Add a valid email address" })
      const ip = trustedClientIp(ctx.headers ?? new Headers())
      if (!ip && process.env.NODE_ENV === "production") {
        throw new APIError("SERVICE_UNAVAILABLE", { message: "Sign-in client IP configuration is missing or invalid" })
      }
      try {
        await consumeRequestBudgets(prisma, [
          ...otpRequestBudgets(email),
          ...(ip ? [{ key: `otp:client:${ip}`, maximum: 10, windowMs: 60000 }] : []),
        ])
      } catch (error) {
        if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") throw new APIError("TOO_MANY_REQUESTS", { message: error.message })
        throw error
      }
    }),
  },
  user: {
    additionalFields: {
      locale: {
        input: true,
        required: false,
        returned: true,
        type: "string",
      },
    },
  },
  plugins: [
    i18n({
      translations: {
        en: enAuth.betterAuthErrors,
        fi: fiAuth.betterAuthErrors,
      },
      defaultLocale: fallbackLanguage,
      detection: ["callback", "header"],
      async getLocale(ctx) {
        const cookieLocale = await localeCookie.parse(
          ctx.headers?.get("Cookie") ?? "",
        )

        if (isSupportedLocale(cookieLocale)) {
          return cookieLocale
        }

        return null
      },
    }),
    emailOTP({
      expiresIn: emailOtpExpiresInMinutes * 60,
      async sendVerificationOTP({ email, otp, type }, context) {
        await sendOtpEmail({
          email,
          locale: await getEmailLocale(context?.request ?? context?.headers),
          otp,
          type,
        })
      },
    }),
    organization({
      ac: organizationAccessControl,
      roles: organizationRoles,
      requireEmailVerificationOnInvitation: true,
      schema: { invitation: { additionalFields: {
        staffMemberId: { type: "string", required: false },
        inviteeName: { type: "string", required: false },
      } } },
      organizationHooks: {
        async beforeCreateInvitation({ invitation }) {
          if (typeof invitation.staffMemberId !== "string") {
            return
          }
          const staff = await prisma.staffMember.findFirst({ where: { id: invitation.staffMemberId, organizationId: invitation.organizationId, isActive: true } })
          if (!staff || staff.memberId || (staff.email && staff.email.toLowerCase() !== invitation.email.toLowerCase())) {
            throw new APIError("BAD_REQUEST", { message: "This staff profile cannot be invited" })
          }
        },
        async beforeAcceptInvitation({ invitation, user }) {
          if (!user.emailVerified) throw new APIError("FORBIDDEN", { message: "Verify your email before accepting" })
          if (typeof invitation.staffMemberId !== "string") return
          const staff = await prisma.staffMember.findFirst({ where: { id: invitation.staffMemberId, organizationId: invitation.organizationId }, include: { member: true } })
          if (!staff || (staff.member && staff.member.userId !== user.id)) throw new APIError("BAD_REQUEST", { message: "This invitation is no longer available" })
        },
        async afterAcceptInvitation({ invitation, member }) {
          await linkInvitationStaff(prisma, invitation.id, member.id)
        },
      },
      invitationExpiresIn: twoWeeksInSeconds,
      async sendInvitationEmail({ id, email, organization, inviter }, request) {
        if (request?.headers.get("x-send-invitation-email") === "false") return

        const inviteUrl = new URL(`/invite/${encodeURIComponent(id)}`, request?.url ?? fallbackAuthUrl).toString()
        const inviterLocale = (await prisma.user.findUnique({ where: { id: inviter.user.id }, select: { locale: true } }))?.locale

        if (process.env.NODE_ENV !== "production") {
          console.info(`[better-auth] Invitation for ${email}: ${inviteUrl}`)
        }

        await sendEmail({
          to: email,
          ...await createInvitationEmailTemplate({
            organizationName: organization.name,
            inviteUrl,
            locale: isSupportedLocale(inviterLocale) ? inviterLocale : await getEmailLocale(request),
          }),
        })
      },
    }),
    ...(stripePlugin ? [stripePlugin] : []),
  ],
})

function createStripePlugin() {
  if (!stripeBillingEnabled || !stripeClient || !stripeWebhookSecret || !stripeSoloPriceId) {
    return null
  }

  return stripe({
    stripeClient,
    stripeWebhookSecret,
    onEvent: async (event) => {
      if (event.type.startsWith("customer.subscription.")) {
        await syncStripeSubscription((event.data.object as { id: string }).id)
      } else if (event.type.startsWith("subscription_schedule.")) {
        const schedule = event.data.object as { subscription?: string | { id: string } | null; released_subscription?: string | null }
        const subscription = schedule.subscription ?? schedule.released_subscription
        if (subscription) await syncStripeSubscription(typeof subscription === "string" ? subscription : subscription.id)
      } else if (event.type === "checkout.session.completed") {
        const subscription = event.data.object.subscription
        if (subscription) await syncStripeSubscription(typeof subscription === "string" ? subscription : subscription.id)
      }
    },
    subscription: {
      enabled: true,
      plans: plans.map((plan) => ({
        name: plan.id,
        priceId: getStripePriceId(plan.id, "month"),
        annualDiscountPriceId: getStripePriceId(plan.id, "year"),
        freeTrial: { days: 14 },
      })),
      getCheckoutSessionParams: () => ({
        params: {
          automatic_tax: { enabled: true },
          billing_address_collection: "required",
          customer_update: { address: "auto", name: "auto" },
          tax_id_collection: { enabled: true },
        },
      }),
      onSubscriptionComplete: async ({ stripeSubscription }) => {
        const customerId =
          typeof stripeSubscription.customer === "string"
            ? stripeSubscription.customer
            : stripeSubscription.customer?.id
        const paymentMethod = stripeSubscription.default_payment_method
        const paymentMethodId =
          typeof paymentMethod === "string" ? paymentMethod : paymentMethod?.id

        if (!customerId) {
          return
        }

        await stripeClient!.subscriptions.update(stripeSubscription.id, {
          payment_settings: {
            save_default_payment_method: "on_subscription",
          },
          ...(paymentMethodId
            ? { default_payment_method: paymentMethodId }
            : {}),
        })

        if (paymentMethodId) {
          await stripeClient!.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          })
        }
      },
      authorizeReference: async ({ user, referenceId, action }) => {
        if (action === "upgrade-subscription" || action === "billing-portal") return false
        const member = await prisma.member.findFirst({
          select: { role: true },
          where: {
            organizationId: referenceId,
            userId: user.id,
          },
        })

        return hasOrganizationPermission(member?.role, { billing: ["manage"] })
      },
    },
    organization: {
      enabled: true,
    },
  })
}

export async function createOrganizationPaymentMethodPortal({
  locale,
  organizationId,
  returnUrl,
}: {
  locale: "en" | "fi"
  organizationId: string
  returnUrl: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  const organization = await prisma.organization.findUnique({
    select: { stripeCustomerId: true },
    where: { id: organizationId },
  })

  if (!organization?.stripeCustomerId) {
    return null
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    configuration: await getBillingPortalConfiguration(),
    flow_data: {
      after_completion: {
        redirect: { return_url: returnUrl },
        type: "redirect",
      },
      type: "payment_method_update",
    },
    locale,
    return_url: returnUrl,
  })

  return session.url
}

export async function createOrganizationCancellationPortal({
  locale,
  organizationId,
  returnUrl,
  subscriptionId,
}: {
  locale: "en" | "fi"
  organizationId: string
  returnUrl: string
  subscriptionId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  const [organization, subscription] = await Promise.all([
    prisma.organization.findUnique({
      select: { stripeCustomerId: true },
      where: { id: organizationId },
    }),
    prisma.subscription.findFirst({
      select: { status: true, stripeSubscriptionId: true },
      where: {
        referenceId: organizationId,
        stripeSubscriptionId: subscriptionId,
      },
    }),
  ])

  if (
    !organization?.stripeCustomerId ||
    !subscription?.stripeSubscriptionId ||
    !["active", "trialing"].includes(subscription.status)
  ) {
    return null
  }

  const stripeSubscription = await stripeClient!.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  )

  if (
    stripeSubscription.status !== "active" &&
    stripeSubscription.status !== "trialing"
  ) {
    return null
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    configuration: await getBillingPortalConfiguration(),
    flow_data: {
      after_completion: {
        redirect: { return_url: returnUrl },
        type: "redirect",
      },
      type: "subscription_cancel",
      subscription_cancel: {
        subscription: stripeSubscription.id,
      },
    },
    locale,
    return_url: returnUrl,
  })

  return session.url
}

export async function listOrganizationPaymentMethods({
  organizationId,
}: {
  organizationId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return []
  }

  const organization = await prisma.organization.findUnique({
    select: { stripeCustomerId: true },
    where: { id: organizationId },
  })

  if (!organization?.stripeCustomerId) {
    return []
  }

  const customer = await stripeClient.customers.retrieve(
    organization.stripeCustomerId,
  )

  if (customer.deleted) {
    return []
  }

  const defaultPaymentMethod = customer.invoice_settings.default_payment_method
  const defaultPaymentMethodId =
    typeof defaultPaymentMethod === "string"
      ? defaultPaymentMethod
      : defaultPaymentMethod?.id
  const paymentMethods = await stripeClient.paymentMethods.list({
    customer: organization.stripeCustomerId,
    limit: 100,
    type: "card",
  })
  const now = new Date()
  const currentMonth = now.getUTCMonth() + 1

  return paymentMethods.data
    .flatMap((paymentMethod) => {
      const card = paymentMethod.card

      if (!card) {
        return []
      }

      const isExpired =
        card.exp_year < now.getUTCFullYear() ||
        (card.exp_year === now.getUTCFullYear() &&
          card.exp_month < currentMonth)
      const isDefault = paymentMethod.id === defaultPaymentMethodId
      const isExpiring =
        isDefault &&
        isPaymentMethodExpiringSoon({
          expMonth: card.exp_month,
          expYear: card.exp_year,
          status: "default",
        })

      return [
        {
          brand: card.brand,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          id: paymentMethod.id,
          isDefault,
          status:
            isExpired
              ? ("expired" as const)
              : isExpiring
                ? ("expiring" as const)
                : isDefault
                  ? ("default" as const)
                  : ("active" as const),
          last4: card.last4,
        },
      ]
    })
    .sort((left, right) => {
      if (left.isDefault && !right.isDefault) {
        return -1
      }

      if (right.isDefault && !left.isDefault) {
        return 1
      }

      return left.expYear - right.expYear || left.expMonth - right.expMonth
    })
}

export async function setOrganizationDefaultPaymentMethod({
  organizationId,
  paymentMethodId,
}: {
  organizationId: string
  paymentMethodId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  const organization = await prisma.organization.findUnique({
    select: { stripeCustomerId: true },
    where: { id: organizationId },
  })

  if (!organization?.stripeCustomerId) {
    return null
  }

  const paymentMethod = await stripeClient.paymentMethods.retrieve(
    paymentMethodId,
  )
  const paymentMethodCustomerId =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id

  if (
    paymentMethodCustomerId !== organization.stripeCustomerId ||
    !paymentMethod.card
  ) {
    return null
  }

  await stripeClient!.customers.update(organization.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  })

  const subscriptions = await stripeClient.subscriptions.list({
    customer: organization.stripeCustomerId,
    limit: 100,
    status: "all",
  })
  const updateableStatuses = new Set([
    "active",
    "incomplete",
    "past_due",
    "paused",
    "trialing",
    "unpaid",
  ])

  await Promise.all(
    subscriptions.data
      .filter((subscription) => updateableStatuses.has(subscription.status))
      .map((subscription) =>
        stripeClient!.subscriptions.update(subscription.id, {
          default_payment_method: paymentMethod.id,
        }),
      ),
  )

  return { id: paymentMethod.id }
}

export async function listOrganizationSubscriptions({
  organizationId,
}: {
  organizationId: string
}) {
  await reconcileOrganizationBilling(organizationId)
  const subscriptions = await prisma.subscription.findMany({
    select: {
      seats: true,
      billingInterval: true,
      cancelAt: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      endedAt: true,
      id: true,
      plan: true,
      status: true,
      stripeScheduleId: true,
      stripeSubscriptionId: true,
    },
    where: { referenceId: organizationId, ...(!isDemoMode() ? { NOT: { plan: { startsWith: "demo" } } } : {}) },
  })

  if (!stripeBillingEnabled || !stripeClient) {
    return subscriptions
  }

  return Promise.all(
    subscriptions.map(async (subscription) => {
      if (!subscription.stripeSubscriptionId) {
        return subscription
      }

      try {
        const stripeSubscription = await stripeClient!.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        )
        const cancelAt = stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000)
          : null
        const canceledAt = stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null
        const endedAt = stripeSubscription.ended_at
          ? new Date(stripeSubscription.ended_at * 1000)
          : null
        const stripeScheduleId = stripeSubscription.schedule
          ? typeof stripeSubscription.schedule === "string"
            ? stripeSubscription.schedule
            : stripeSubscription.schedule.id
          : null

        await prisma.subscription.update({
          data: {
            cancelAt,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt,
            endedAt,
            status: stripeSubscription.status,
            stripeScheduleId,
          },
          where: { id: subscription.id },
        })

        return {
          ...subscription,
          cancelAt,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt,
          endedAt,
          status: stripeSubscription.status,
          stripeScheduleId,
        }
      } catch {
        return subscription
      }
    }),
  )
}

export async function listOrganizationInvoices({
  organizationId,
}: {
  organizationId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return []
  }

  const organization = await prisma.organization.findUnique({
    select: { stripeCustomerId: true },
    where: { id: organizationId },
  })

  if (!organization?.stripeCustomerId) {
    return []
  }

  const invoices = await stripeClient.invoices.list({
    customer: organization.stripeCustomerId,
    limit: 3,
  })

  return invoices.data
    .filter((invoice) => invoice.status !== "draft")
    .map((invoice) => {
      const plan = invoice.lines.data[0]?.description ?? "Jupiter"

      return {
        amount:
          invoice.subtotal,
        currency: invoice.currency,
        date: new Date(
          (invoice.status_transitions.paid_at ?? invoice.created) * 1000,
        ).toISOString(),
        id: invoice.id,
        isTrial:
          /^free trial(?:\s|$)/i.test(plan) ||
          (invoice.billing_reason === "subscription_create" &&
            invoice.amount_due === 0),
        number: invoice.number,
        plan,
        status: invoice.status ?? "unknown",
        taxAmount:
          invoice.total_taxes?.reduce((total, tax) => total + tax.amount, 0) ??
          null,
        url: invoice.hosted_invoice_url ?? invoice.invoice_pdf,
      }
    })
}

export async function getOrganizationBillingNotification({
  organizationId,
}: {
  organizationId: string
}): Promise<BillingNotification | null> {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  try {
    const [allSubscriptions, paymentMethods] = await Promise.all([
      listOrganizationSubscriptions({ organizationId }),
      listOrganizationPaymentMethods({ organizationId }),
    ])
    const subscriptions = allSubscriptions.filter((subscription) => !subscription.plan.startsWith("demo"))

    if (
      subscriptions.some(({ status }) =>
        ["past_due", "unpaid"].includes(status),
      )
    ) {
      return { type: "payment-failed" }
    }

    if (
      subscriptions.some(({ status }) =>
        ["incomplete", "incomplete_expired"].includes(status),
      )
    ) {
      return { type: "payment-setup-incomplete" }
    }

    if (
      subscriptions.some(
        (subscription) =>
          ["canceled", "paused"].includes(subscription.status) ||
          subscription.endedAt,
      )
    ) {
      return { type: "subscription-inactive" }
    }

    const defaultPaymentMethod = paymentMethods.find((paymentMethod) =>
      paymentMethod.isDefault,
    )

    if (defaultPaymentMethod?.status === "expired") {
      return {
        expMonth: defaultPaymentMethod.expMonth,
        expYear: defaultPaymentMethod.expYear,
        last4: defaultPaymentMethod.last4,
        type: "payment-method-expired",
      }
    }

    if (
      defaultPaymentMethod &&
      isPaymentMethodExpiringSoon(defaultPaymentMethod)
    ) {
      return {
        expMonth: defaultPaymentMethod.expMonth,
        expYear: defaultPaymentMethod.expYear,
        last4: defaultPaymentMethod.last4,
        type: "payment-method-expiring",
      }
    }

    if (
      subscriptions.some(({ status }) => status === "active") &&
      !defaultPaymentMethod
    ) {
      return { type: "payment-method-missing" }
    }

    return null
  } catch {
    return null
  }
}

function isPaymentMethodExpiringSoon(paymentMethod: {
  expMonth: number
  expYear: number
  status: "active" | "default" | "expired" | "expiring"
}) {
  if (paymentMethod.status !== "default") {
    return false
  }

  const expirationDate = Date.UTC(
    paymentMethod.expYear,
    paymentMethod.expMonth,
    1,
  )
  const sixtyDaysFromNow = Date.now() + 60 * 24 * 60 * 60 * 1000

  return expirationDate <= sixtyDaysFromNow
}

export async function getOrganizationNextCharge({
  organizationId,
}: {
  organizationId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  const organization = await prisma.organization.findUnique({
    select: { stripeCustomerId: true },
    where: { id: organizationId },
  })
  const subscription = await prisma.subscription.findFirst({
    select: {
      cancelAt: true,
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: true,
    },
    where: {
      referenceId: organizationId,
      status: { in: ["active", "past_due", "trialing"] },
    },
  })

  if (!organization?.stripeCustomerId || !subscription?.stripeSubscriptionId) {
    return null
  }

  const stripeSubscription = await stripeClient!.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
    { expand: ["items.data.price"] },
  )
  const subscriptionItem = stripeSubscription.items.data.find((item) => plans.some((plan) => [getStripePriceId(plan.id, "month"), getStripePriceId(plan.id, "year")].includes(item.price.id)))
  const nextChargeTimestamp =
    stripeSubscription.trial_end ?? subscriptionItem?.current_period_end

  if (
    subscription.cancelAtPeriodEnd ||
    subscription.cancelAt ||
    stripeSubscription.cancel_at_period_end ||
    stripeSubscription.cancel_at
  ) {
    return {
      amount: null,
      currency: null,
      date: null,
    }
  }

  const price = subscriptionItem?.price
  let amount = stripeSubscription.items.data.every((item) => item.price.unit_amount !== null)
    ? stripeSubscription.items.data.reduce((total, item) => total + item.price.unit_amount! * (item.quantity ?? 1), 0)
    : null
  let currency = price?.currency ?? null
  let taxAmount: number | null = null

  try {
    const invoicePreview = await stripeClient.invoices.createPreview({
      customer: organization.stripeCustomerId,
      subscription: stripeSubscription.id,
    })
    amount = invoicePreview.total_excluding_tax ?? invoicePreview.subtotal
    currency = invoicePreview.currency
    const previewTaxAmount = invoicePreview.total_taxes?.reduce(
      (total, tax) => total + tax.amount,
      0,
    ) ?? (
      invoicePreview.total_excluding_tax !== null
        ? invoicePreview.total - invoicePreview.total_excluding_tax
        : null
    )

    taxAmount =
      previewTaxAmount !== null && previewTaxAmount > 0
        ? previewTaxAmount
        : null
  } catch {
    amount = null
    taxAmount = null
  }

  return {
    amount,
    currency,
    date: nextChargeTimestamp ? new Date(nextChargeTimestamp * 1000) : null,
    taxAmount,
  }
}

function getHostPattern(url: string) {
  try {
    const { hostname } = new URL(url)

    if (hostname.includes(":")) {
      return `[${hostname}]:*`
    }

    return `${hostname}:*`
  } catch {
    return null
  }
}

function isSupportedLocale(locale: unknown): locale is (typeof supportedLanguages)[number] {
  return (
    typeof locale === "string" &&
    supportedLanguages.includes(
      locale as (typeof supportedLanguages)[number],
    )
  )
}
