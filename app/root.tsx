import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type UIMatch,
  useLocation,
  useMatches,
} from "react-router"

import type { Route } from "./+types/root"
import {
  getLocale,
  i18nextMiddleware,
} from "./middleware/i18next"
import {
  formatPreferenceCookie,
  localeCookie,
  themeCookie,
} from "./lib/cookies.server"
import {
  isFormatPreference,
} from "./lib/format-preference"
import { getFormatPreferenceFromRequest } from "./lib/format-preference.server"
import { defaultTheme, isTheme, syncThemeColor } from "./lib/theme"
import { ToastProvider } from "./components/ui/toast"
import { AppStatusDialog } from "./components/app-status-dialog"
import { TRPCReactProvider } from "./lib/trpc/client"
import { toast } from "./lib/toast"
import { joinedTeamErrorStorageKey } from "./lib/team-join"
import { prisma } from "./lib/prisma.server"
import { getOrganizationBillingNotification } from "./lib/auth/server"
import { hasActiveOrganizationSubscription } from "./lib/billing.server"
import { hasOwnerRole } from "./lib/utils"
import { syncUserLocale } from "./lib/locale.server"
import {
  authMiddleware,
  membershipContext,
  organizationContext,
  userContext,
} from "./middleware/auth"
import { restrictKeyboardFocus } from "./lib/keyboard-focus"
import { shouldRevalidateRootRoute } from "./lib/should-revalidate"
import { useBackgroundSetting } from "./lib/use-background-setting"
import "./app.css"

export const middleware = [i18nextMiddleware, authMiddleware]

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "48x48" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
]

export async function loader({ context, request }: Route.LoaderArgs) {
  const locale = getLocale(context)
  const user = context.get(userContext)
  const org = context.get(organizationContext)
  const membership = context.get(membershipContext)
  const [organizationSettings, memberships, billingNotification, hasActiveSubscription] = await Promise.all([
    org
      ? prisma.organizationSettings.findUnique({
          select: { timezone: true },
          where: { organizationId: org.id },
        })
      : null,
    user
      ? prisma.member.findMany({
          select: {
            role: true,
            organization: { select: { id: true, name: true } },
          },
          where: { userId: user.id },
          orderBy: { organization: { name: "asc" } },
        })
      : [],
    org && hasOwnerRole(membership?.role)
      ? getOrganizationBillingNotification({ organizationId: org.id })
      : null,
    org ? hasActiveOrganizationSubscription({ organizationId: org.id }) : false,
    user && user.locale !== locale
      ? syncUserLocale({ locale, userId: user.id })
      : undefined,
  ])
  const organizations = memberships.map(({ organization, role }) => ({
    ...organization,
    role,
  }))
  const storedFormatPreference = await formatPreferenceCookie.parse(
    request.headers.get("cookie"),
  )
  const formatPreference = isFormatPreference(storedFormatPreference)
    ? storedFormatPreference
    : await getFormatPreferenceFromRequest(request.headers)
  const storedTheme = await themeCookie.parse(request.headers.get("cookie"))
  const theme = isTheme(storedTheme) ? storedTheme : defaultTheme
  const headers = new Headers()

  headers.append("Set-Cookie", await localeCookie.serialize(locale))
  headers.append(
    "Set-Cookie",
    await formatPreferenceCookie.serialize(formatPreference),
  )
  headers.append("Set-Cookie", await themeCookie.serialize(theme))

  return data(
    {
      billingEnabled: Boolean(
        process.env.STRIPE_SECRET_KEY &&
          process.env.STRIPE_WEBHOOK_SECRET &&
          process.env.STRIPE_PRO_PRICE_ID,
      ),
      billingAnnualEnabled: Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID),
      billingNotification,
      hasActiveSubscription,
      isElectron: /\bElectron\/\d+/.test(request.headers.get("user-agent") ?? ""),
      formatPreference,
      locale,
      organizationTimezone:
        organizationSettings?.timezone ?? "Europe/Helsinki",
      organizations,
      theme,
      user,
      org,
    },
    {
      headers,
    },
  )
}

export const shouldRevalidate = shouldRevalidateRootRoute

export function Layout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const matches = useMatches()
  const rootMatch = matches[0] as UIMatch<Route.ComponentProps["loaderData"]>
  const themeSetting = useBackgroundSetting(`${rootMatch?.loaderData?.user?.id}:theme`, rootMatch?.loaderData?.theme ?? "light")
  const theme = themeSetting.value === "dark" ? "dark" : undefined
  const language = i18n.resolvedLanguage || i18n.language

  return (
    <html lang={language} dir={i18n.dir(language)} className={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta
          name="theme-color"
          content={theme === "dark" ? "#161616" : "#ffffff"}
        />
        <Meta />
        <Links />
      </head>
      <body className={import.meta.env.DEV ? undefined : "select-none"}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { i18n, t } = useTranslation("auth")
  const { t: tTeam } = useTranslation("team")
  const location = useLocation()
  const languageSetting = useBackgroundSetting(`${loaderData.user?.id}:language`, loaderData.locale)
  const themeSetting = useBackgroundSetting(`${loaderData.user?.id}:theme`, loaderData.theme)

  useEffect(() => restrictKeyboardFocus(), [])

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return

    let cancelled = false
    const syncOfflineLocale = () => {
      navigator.serviceWorker.controller?.postMessage({
        type: "SET_OFFLINE_LOCALE",
        locale: loaderData.locale,
      })
    }

    // The server resolves this value from the HTTP-only lng cookie.
    navigator.serviceWorker.addEventListener("controllerchange", syncOfflineLocale)
    void navigator.serviceWorker.ready.then((registration) => {
      if (!cancelled) registration.active?.postMessage({
        type: "SET_OFFLINE_LOCALE",
        locale: loaderData.locale,
      })
    })
    syncOfflineLocale()

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener("controllerchange", syncOfflineLocale)
    }
  }, [loaderData.locale])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const hasQueryMarker = searchParams.get("sessionExpired") === "1"
    const hasStorageMarker =
      window.sessionStorage.getItem("sessionExpiredToast") === "1"

    if (!hasQueryMarker && !hasStorageMarker) {
      return
    }

    window.sessionStorage.removeItem("sessionExpiredToast")

    if (hasQueryMarker) {
      searchParams.delete("sessionExpired")
      const search = searchParams.toString()

      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
      )
    }

    toast.error(t("toasts.sessionExpired"))
  }, [location.hash, location.pathname, location.search, t])

  useEffect(() => {
    const error = window.sessionStorage.getItem(joinedTeamErrorStorageKey)
    if (!error) return

    window.sessionStorage.removeItem(joinedTeamErrorStorageKey)
    toast.error(tTeam("accept.errorTitle"), tTeam(`accept.${error}`))
  }, [tTeam])

  useEffect(() => {
    if (i18n.language !== languageSetting.value) {
      i18n.changeLanguage(languageSetting.value)
    }
  }, [i18n, languageSetting.value])

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      themeSetting.value === "dark",
    )
    syncThemeColor()
  }, [themeSetting.value])

  return (
    <ToastProvider>
      <TRPCReactProvider>
        <AppStatusDialog />
        <Outlet />
      </TRPCReactProvider>
    </ToastProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation()
  let message = t("error.fallbackTitle")
  let details = t("error.genericDetails")
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message =
      error.status === 404
        ? t("error.notFoundTitle")
        : t("error.genericTitle")
    details =
      error.status === 404
        ? t("error.notFoundDetails")
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <title>{message}</title>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
