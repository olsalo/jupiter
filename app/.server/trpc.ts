import { ResourceLimitError } from "./resource-limits/errors"
import { isSupportedLocale } from "~/lib/locale"
import { initTRPC, TRPCError } from "@trpc/server"
import { createInstance } from "i18next"
import superjson from "superjson"

import { hasOrganizationPermission, type OrganizationPermissions } from "~/lib/auth/permissions"
import { auth } from "~/lib/auth/server"
import { hasActiveOrganizationSubscription } from "~/lib/billing.server"
import {
  formatPreferenceCookie,
  localeCookie,
} from "~/lib/cookies.server"
import {
  getFormatLocale,
  isFormatPreference,
} from "~/lib/format-preference"
import { getFormatPreferenceFromRequest } from "~/lib/format-preference.server"
import { prisma } from "~/lib/prisma.server"
import { configureZodI18n, ZodError } from "~/lib/zod"
import {
  fallbackLanguage,
  resources,
  supportedLanguages,
} from "~/locales"

export const createTRPCContext = async (opts: {
  headers: Headers
  request?: Request
  responseHeaders?: Headers
  authenticatedContext?: {
    authSession: typeof auth.$Infer.Session | null
    organizationId: string | null
  }
}) => {
  const authSessionPromise = opts.authenticatedContext
    ? Promise.resolve(opts.authenticatedContext.authSession)
    : auth.api.getSession({ headers: opts.headers })
  const organizationIdPromise = opts.authenticatedContext
    ? Promise.resolve(opts.authenticatedContext.organizationId)
    : authSessionPromise.then(async (authSession) => (authSession
      ? (await getActiveOrganization({
          organizationId: authSession.session.activeOrganizationId,
          userId: authSession.user.id,
        }))?.id ?? null
      : null))
  const formatPreferencePromise = formatPreferenceCookie
    .parse(opts.headers.get("cookie"))
    .then((storedFormatPreference) => isFormatPreference(storedFormatPreference)
      ? storedFormatPreference
      : getFormatPreferenceFromRequest(opts.headers))
  const [authSession, organizationId, formatPreference] = await Promise.all([
    authSessionPromise,
    organizationIdPromise,
    formatPreferencePromise,
  ])

  const locale = await configureRequestZodI18n(opts.headers, authSession?.user.locale)

  const source = opts.headers.get("x-trpc-source") ?? "unknown"

  if (process.env.NODE_ENV === "development") {
    console.log(">>> tRPC Request from", source, "by", authSession?.user.id)
  }

  return {
    headers: opts.headers,
    ...({ responseHeaders: opts.responseHeaders } as { responseHeaders?: Headers }),
    request: opts.request,
    prisma,
    user: authSession?.user,
    session: authSession?.session,
    organizationId,
    formatLocale: getFormatLocale(formatPreference),
    formatPreference,
    locale,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      resourceLimit: error.cause instanceof ResourceLimitError ? { resource: error.cause.resource, limit: error.cause.limit } : null,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      appCode: error.cause && "appCode" in error.cause ? error.cause.appCode : null,
    },
  }),
})

export const createCallerFactory = t.createCallerFactory
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const resourceLimitProcedure = t.procedure.use(async ({ next }) => {
  const result = await next()
  if (!result.ok && result.error.cause instanceof ResourceLimitError) {
    throw new TRPCError({ code: "FORBIDDEN", message: result.error.cause.message, cause: result.error.cause })
  }
  return result
})

export const protectedProcedure = resourceLimitProcedure.use(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: {
      headers: ctx.headers,
      user: ctx.user,
      session: ctx.session,
      organizationId: ctx.organizationId,
      formatLocale: ctx.formatLocale,
      formatPreference: ctx.formatPreference,
      locale: ctx.locale,
    },
  })
})

export const subscribedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (
    !ctx.organizationId ||
    !(await hasActiveOrganizationSubscription({
      organizationId: ctx.organizationId,
    }))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An active subscription is required",
    })
  }

  return next()
})

export const organizationProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = ctx.session?.activeOrganizationId
  if (!organizationId || organizationId !== ctx.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Choose a business first" })
  }
  const member = await ctx.prisma.member.findFirst({
    where: { organizationId, userId: ctx.user.id },
    include: { organization: { include: { settings: true } }, staffProfile: true },
  })
  if (!member || !member.role.split(",").some((role) => ["owner", "admin", "member"].includes(role.trim()))) throw new TRPCError({ code: "FORBIDDEN" })
  return next({ ctx: { organizationId, organization: member.organization, member } })
})

export const permissionProcedure = (permissions: OrganizationPermissions) => organizationProcedure.use(({ ctx, next }) => {
  if (!hasOrganizationPermission(ctx.member.role, permissions)) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next()
})

export const adminProcedure = permissionProcedure({ team: ["manage"] })

async function getActiveOrganization({
  organizationId,
  userId,
}: {
  organizationId: string | null | undefined
  userId: string
}) {
  const activeOrganization = organizationId
    ? await prisma.organization.findFirst({
        select: { id: true },
        where: {
          id: organizationId,
          members: {
            some: { userId },
          },
        },
      })
    : null

  return (
    activeOrganization ??
    (await prisma.organization.findFirst({
      select: { id: true },
      where: {
        members: {
          some: { userId },
        },
      },
    }))
  )
}

async function configureRequestZodI18n(headers: Headers, savedLocale?: string | null) {
  const locale = isSupportedLocale(savedLocale) ? savedLocale : await getRequestLocale(headers)
  const i18n = createInstance()

  await i18n.init({
    resources,
    lng: locale,
    fallbackLng: fallbackLanguage,
    supportedLngs: [...supportedLanguages],
    defaultNS: "common",
    ns: ["zod"],
    interpolation: {
      escapeValue: false,
    },
  })

  configureZodI18n(i18n.t.bind(i18n))
  return locale
}

async function getRequestLocale(headers: Headers): Promise<SupportedLanguage> {
  const cookieLocale = await localeCookie.parse(headers.get("cookie"))

  if (isSupportedLanguage(cookieLocale)) {
    return cookieLocale
  }

  const acceptedLanguage = headers
    .get("accept-language")
    ?.split(",")
    .map((language) => language.trim().split(";")[0]?.toLowerCase())
    .map((language) => language.split("-")[0])
    .find(isSupportedLanguage)

  return acceptedLanguage ?? fallbackLanguage
}

type SupportedLanguage = (typeof supportedLanguages)[number]

function isSupportedLanguage(locale: unknown): locale is SupportedLanguage {
  return (
    typeof locale === "string" &&
    supportedLanguages.includes(locale as SupportedLanguage)
  )
}
