import { i18n } from "@better-auth/i18n"
import { stripe } from "@better-auth/stripe"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { emailOTP, organization } from "better-auth/plugins"
import Stripe from "stripe"

import enAuth from "~/locales/en/auth.json"
import fiAuth from "~/locales/fi/auth.json"

import { fallbackLanguage, supportedLanguages } from "~/locales"
import type { BillingNotification } from "~/lib/billing"
import { localeCookie } from "~/lib/cookies.server"
import {
  emailOtpExpiresInMinutes,
  getEmailLocale,
  sendOtpEmail,
  sendEmail,
} from "~/lib/email.server"
import { createInvitationEmailTemplate } from "~/lib/email-templates/invitation"
import { prisma } from "~/lib/prisma.server"
import { hasOwnerRole } from "~/lib/utils"

const fallbackAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:5174"
const oneYearInSeconds = 60 * 60 * 24 * 365

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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripeProPriceId = process.env.STRIPE_PRO_PRICE_ID
const stripeProAnnualPriceId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export const stripeBillingEnabled = Boolean(
  stripeSecretKey && stripeWebhookSecret && stripeProPriceId,
)

const stripePlugin = createStripePlugin()

export const auth = betterAuth({
  baseURL: {
    allowedHosts: Array.from(new Set(allowedHosts)),
    fallback: fallbackAuthUrl,
    protocol: "auto",
  },
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  session: {
    disableSessionRefresh: true,
    expiresIn: oneYearInSeconds,
  },
  advanced: {
    database: {
      generateId: false,
    },
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
          locale: await getEmailLocale(context?.request),
          otp,
          type,
        })
      },
    }),
    organization({
      async sendInvitationEmail({ id, email, organization }, request) {
        if (request?.headers.get("x-send-invitation-email") === "false") return

        const inviteUrl = new URL(`/invite/${encodeURIComponent(id)}`, request?.url ?? fallbackAuthUrl).toString()

        if (process.env.NODE_ENV !== "production") {
          console.info(`[better-auth] Invitation for ${email}: ${inviteUrl}`)
        }

        await sendEmail({
          to: email,
          ...createInvitationEmailTemplate({
            organizationName: organization.name,
            inviteUrl,
            locale: await getEmailLocale(request),
          }),
        })
      },
    }),
    ...(stripePlugin ? [stripePlugin] : []),
  ],
})

function createStripePlugin() {
  if (!stripeBillingEnabled || !stripeClient || !stripeWebhookSecret || !stripeProPriceId) {
    return null
  }

  return stripe({
    stripeClient,
    stripeWebhookSecret,
    subscription: {
      enabled: true,
      plans: [
        {
          name: "pro",
          annualDiscountPriceId: stripeProAnnualPriceId,
          priceId: stripeProPriceId,
          freeTrial: {
            days: 14,
          },
        },
      ],
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

        await stripeClient.subscriptions.update(stripeSubscription.id, {
          payment_settings: {
            save_default_payment_method: "on_subscription",
          },
          ...(paymentMethodId
            ? { default_payment_method: paymentMethodId }
            : {}),
        })

        if (paymentMethodId) {
          await stripeClient.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          })
        }
      },
      authorizeReference: async ({ user, referenceId }) => {
        const member = await prisma.member.findFirst({
          select: { role: true },
          where: {
            organizationId: referenceId,
            userId: user.id,
          },
        })

        return hasOwnerRole(member?.role)
      },
    },
    organization: {
      enabled: true,
    },
  })
}

export async function createOrganizationTrial({
  customerEmail,
  organizationId,
  organizationName,
}: {
  customerEmail: string
  organizationId: string
  organizationName: string
}) {
  if (!stripeBillingEnabled || !stripeClient || !stripeProPriceId) {
    return null
  }

  const stripeCustomer = await stripeClient.customers.create(
    {
      email: customerEmail,
      name: organizationName,
      metadata: {
        customerType: "organization",
        organizationId,
      },
    },
    {
      idempotencyKey: `organization-trial-customer-${organizationId}`,
    },
  )
  const stripeSubscription = await stripeClient.subscriptions.create(
    {
      collection_method: "charge_automatically",
      customer: stripeCustomer.id,
      items: [{ price: stripeProPriceId }],
      metadata: {
        referenceId: organizationId,
      },
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: "cancel",
        },
      },
    },
    {
      idempotencyKey: `organization-trial-subscription-${organizationId}`,
    },
  )

  return { stripeCustomer, stripeSubscription }
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

  const stripeSubscription = await stripeClient.subscriptions.retrieve(
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

export async function changeOrganizationBillingInterval({
  interval,
  organizationId,
}: {
  interval: "month" | "year"
  organizationId: string
}) {
  if (!stripeBillingEnabled || !stripeClient) {
    return null
  }

  const targetPriceId =
    interval === "year" ? stripeProAnnualPriceId : stripeProPriceId

  if (!targetPriceId) {
    return null
  }

  const [organization, subscription] = await Promise.all([
    prisma.organization.findUnique({
      select: { stripeCustomerId: true },
      where: { id: organizationId },
    }),
    prisma.subscription.findFirst({
      select: { stripeSubscriptionId: true, status: true },
      where: {
        referenceId: organizationId,
        status: { in: ["active", "trialing", "past_due"] },
      },
    }),
  ])

  if (!organization?.stripeCustomerId || !subscription?.stripeSubscriptionId) {
    return null
  }

  const stripeSubscription = await stripeClient.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
    { expand: ["items.data.price", "schedule"] },
  )

  if (
    stripeSubscription.status !== "active" &&
    stripeSubscription.status !== "trialing" &&
    stripeSubscription.status !== "past_due"
  ) {
    return null
  }

  const subscriptionItem = stripeSubscription.items.data.find((item) =>
    [stripeProPriceId, stripeProAnnualPriceId].includes(item.price.id),
  )

  if (!subscriptionItem) {
    return null
  }

  if (subscriptionItem.price.id === targetPriceId) {
    return { billingInterval: interval }
  }

  if (stripeSubscription.schedule) {
    const scheduleId =
      typeof stripeSubscription.schedule === "string"
        ? stripeSubscription.schedule
        : stripeSubscription.schedule.id
    const schedule = await stripeClient.subscriptionSchedules.retrieve(scheduleId)

    if (schedule.status === "active") {
      await stripeClient.subscriptionSchedules.release(scheduleId)
    }
  }

  const updatedSubscription = await stripeClient.subscriptions.update(
    stripeSubscription.id,
    {
      items: [{
        id: subscriptionItem.id,
        price: targetPriceId,
      }],
      proration_behavior: "create_prorations",
    },
  )

  await prisma.subscription.updateMany({
    data: {
      billingInterval: interval,
      stripeScheduleId: null,
    },
    where: {
      referenceId: organizationId,
      stripeSubscriptionId: updatedSubscription.id,
    },
  })

  return { billingInterval: interval }
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

  await stripeClient.customers.update(organization.stripeCustomerId, {
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
        stripeClient.subscriptions.update(subscription.id, {
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
  const subscriptions = await prisma.subscription.findMany({
    select: {
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
    where: { referenceId: organizationId },
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
        const stripeSubscription = await stripeClient.subscriptions.retrieve(
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
      const plan = invoice.lines.data[0]?.description ?? "Pro"

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
    const [subscriptions, paymentMethods] = await Promise.all([
      listOrganizationSubscriptions({ organizationId }),
      listOrganizationPaymentMethods({ organizationId }),
    ])

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

  const stripeSubscription = await stripeClient.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
    { expand: ["items.data.price"] },
  )
  const subscriptionItem = stripeSubscription.items.data[0]
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
  const amount =
    price?.unit_amount !== null && price?.unit_amount !== undefined
      ? price.unit_amount * (subscriptionItem.quantity ?? 1)
      : null
  const currency = price?.currency ?? null
  let taxAmount: number | null = null

  try {
    const invoicePreview = await stripeClient.invoices.createPreview({
      customer: organization.stripeCustomerId,
      subscription: stripeSubscription.id,
    })
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
