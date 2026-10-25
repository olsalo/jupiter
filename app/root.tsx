import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router"

import type { Route } from "./+types/root"
import { AppStatusDialog } from "~/components/app-status-dialog"
import { ToastProvider } from "~/components/ui/toast"
import { TooltipProvider } from "~/components/ui/tooltip"
import { formatPreferenceCookie, localeCookie, themeCookie } from "~/lib/cookies.server"
import { isFormatPreference } from "~/lib/format-preference"
import { getFormatPreferenceFromRequest } from "~/lib/format-preference.server"
import { restrictKeyboardFocus } from "~/lib/keyboard-focus"
import { isSupportedLocale } from "~/lib/locale"
import { syncUserLocale } from "~/lib/locale.server"
import { isElectron, isReactNativeWebView } from "~/lib/platform"
import { shouldRevalidateRootRoute } from "~/lib/should-revalidate"
import { defaultTheme, isTheme, syncThemeColor } from "~/lib/theme"
import { TRPCReactProvider } from "~/lib/trpc/client"
import { useAuthNotifications } from "~/lib/use-auth-notifications"
import { useBackgroundSetting } from "~/lib/use-background-setting"
import { useOfflineLocale } from "~/lib/use-offline-locale"
import { authMiddleware, userContext } from "~/middleware/auth"
import { getInstance, getLocale, i18nextMiddleware } from "~/middleware/i18next"
import "./app.css"

export const middleware = [i18nextMiddleware, authMiddleware]

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "48x48" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
]

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args
  const user = context.get(userContext)
  const locale = isSupportedLocale(user?.locale) ? user.locale : getLocale(context)
  const cookie = request.headers.get("cookie")

  const [storedFormatPreference, storedTheme] = await Promise.all([
    formatPreferenceCookie.parse(cookie),
    themeCookie.parse(cookie),
    getInstance(context).changeLanguage(locale),
    user && !isSupportedLocale(user.locale) ? syncUserLocale({ locale, userId: user.id }) : undefined,
  ])
  const formatPreference = isFormatPreference(storedFormatPreference)
    ? storedFormatPreference
    : await getFormatPreferenceFromRequest(request.headers)
  const theme = isTheme(storedTheme) ? storedTheme : defaultTheme
  const cookies = await Promise.all([
    localeCookie.serialize(locale),
    formatPreferenceCookie.serialize(formatPreference),
    themeCookie.serialize(theme),
  ])
  const headers = new Headers()
  for (const cookie of cookies) headers.append("Set-Cookie", cookie)

  return data({
    user,
    isElectron: isElectron(request.headers.get("user-agent") ?? ""),
    isReactNativeWebView: isReactNativeWebView(request.headers.get("user-agent") ?? ""),
    locale,
    formatPreference,
    theme,
  }, { headers })
}

export const shouldRevalidate = shouldRevalidateRootRoute

export function Layout({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const rootData = useRouteLoaderData<typeof loader>("root")
  const themeSetting = useBackgroundSetting(`${rootData?.user?.id}:theme`, rootData?.theme ?? defaultTheme)
  const theme = themeSetting.value === "dark" ? "dark" : undefined
  const language = i18n.resolvedLanguage || i18n.language

  useEffect(syncThemeColor, [themeSetting.value])

  return (
    <html lang={language} dir={i18n.dir(language)} className={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta
          name="theme-color"
          content={theme === "dark" ? "#161616" : "#ffffff"}
        />
        <Meta />
        <Links />
      </head>
      <body
        className={import.meta.env.DEV ? undefined : "select-none"}
        onDragStartCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) {
            event.preventDefault()
          }
        }}
      >
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { i18n } = useTranslation()
  const languageSetting = useBackgroundSetting(`${loaderData.user?.id}:language`, loaderData.locale)

  useAuthNotifications()
  useOfflineLocale(languageSetting.value)
  useEffect(restrictKeyboardFocus, [])
  useEffect(() => {
    if (i18n.language !== languageSetting.value) {
      void i18n.changeLanguage(languageSetting.value)
    }
  }, [i18n, languageSetting.value])

  return (
    <ToastProvider>
      <TooltipProvider>
        <TRPCReactProvider>
          <AppStatusDialog />
          <Outlet />
        </TRPCReactProvider>
      </TooltipProvider>
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
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] container mx-auto">
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
