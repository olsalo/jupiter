import { createContext, redirect, type MiddlewareFunction } from "react-router"

import { auth } from "~/lib/auth/server"
import { prisma } from "~/lib/prisma.server"
import { joinInvitationSearchParam } from "~/lib/team-join"
import { hasOwnerRole } from "~/lib/utils"

type AuthSession = typeof auth.$Infer.Session
type AuthUser = AuthSession["user"]
type AuthOrganization = Awaited<ReturnType<typeof getActiveOrganization>>
type AuthMembership = Awaited<ReturnType<typeof getActiveMembership>>

export const userContext = createContext<AuthUser | null>(null)
export const sessionContext = createContext<AuthSession | null>(null)
export const organizationContext = createContext<AuthOrganization>(null)
export const membershipContext = createContext<AuthMembership>(null)

export const authMiddleware: MiddlewareFunction<Response> = async ({
  context,
  request,
}) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  context.set(sessionContext, session)
  context.set(userContext, session?.user ?? null)

  const organization = session
    ? await getActiveOrganization({
        organizationId: session.session.activeOrganizationId,
        userId: session.user.id,
      })
    : null

  if (
    session &&
    organization &&
    session.session.activeOrganizationId !== organization.id
  ) {
    await prisma.session.update({
      where: { id: session.session.id },
      data: { activeOrganizationId: organization.id },
    })
  }

  const membership =
    session && organization
      ? await getActiveMembership({
          organizationId: organization.id,
          userId: session.user.id,
        })
      : null

  context.set(organizationContext, organization)
  context.set(membershipContext, membership)
}

export const requireAuthMiddleware: MiddlewareFunction<Response> = async ({
  context,
  request,
  url,
}) => {
  const user = context.get(userContext)

  if (!user) {
    const searchParams = new URLSearchParams()

    if (hasSessionCookie(request.headers)) {
      searchParams.set("sessionExpired", "1")
    }

    if (url.pathname !== "/") {
      searchParams.set("redirectTo", `${url.pathname}${url.search}`)
    }

    const query = searchParams.toString()

    throw redirect(query ? `/auth?${query}` : "/auth")
  }
}

export const requireOrganizationMiddleware: MiddlewareFunction<
  Response
> = async ({ context, url }) => {
  const invitationId = url.pathname === "/"
    ? url.searchParams.get(joinInvitationSearchParam)
    : null

  if (!context.get(organizationContext) && (!invitationId || invitationId.length > 200)) {
    throw redirect("/onboarding")
  }
}

export const requireOwnerMiddleware: MiddlewareFunction<Response> = async ({
  context,
}) => {
  const membership = context.get(membershipContext)

  if (!hasOwnerRole(membership?.role)) {
    throw redirect("/")
  }
}

function hasSessionCookie(headers: Headers) {
  const cookieHeader = headers.get("cookie")

  return (
    cookieHeader?.split(";").some((cookie) => {
      const cookieName = cookie.trim().split("=", 1)[0]

      return (
        cookieName.includes("better-auth") &&
        cookieName.endsWith("session_token")
      )
    }) ?? false
  )
}

async function getActiveMembership({
  organizationId,
  userId,
}: {
  organizationId: string
  userId: string
}) {
  return prisma.member.findFirst({
    select: { role: true },
    where: {
      organizationId,
      userId,
    },
  })
}

async function getActiveOrganization({
  organizationId,
  userId,
}: {
  organizationId: string | null | undefined
  userId: string
}) {
  const activeOrganization = organizationId
    ? await prisma.organization.findFirst({
        where: {
          id: organizationId,
          members: {
            some: {
              userId,
            },
          },
        },
      })
    : null

  if (activeOrganization) {
    return activeOrganization
  }

  return prisma.organization.findFirst({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
  })
}
