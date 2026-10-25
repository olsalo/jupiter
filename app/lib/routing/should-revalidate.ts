import type { ShouldRevalidateFunctionArgs } from "react-router"

export function shouldRevalidateWorkspaceRoute({ currentUrl, nextUrl, formMethod }: Pick<ShouldRevalidateFunctionArgs, "currentUrl" | "nextUrl" | "formMethod">) {
  if (formMethod && formMethod.toUpperCase() !== "GET") return true
  // Check setup when the workspace first loads and on explicit revalidation.
  // Client queries own route data and enforce access on every API request
  return currentUrl.pathname === nextUrl.pathname && currentUrl.search === nextUrl.search
}

function isAccountRoute(pathname: string) {
  return (
    pathname === "/auth" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/invite/")
  )
}

export function shouldRevalidateAppRoute({
  currentUrl,
  defaultShouldRevalidate,
  formMethod,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return defaultShouldRevalidate
  }

  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search
  ) {
    return defaultShouldRevalidate
  }

  return false
}

export function shouldRevalidateRootRoute(args: ShouldRevalidateFunctionArgs) {
  if (
    isAccountRoute(args.currentUrl.pathname) ||
    isAccountRoute(args.nextUrl.pathname)
  ) {
    return args.defaultShouldRevalidate
  }

  return shouldRevalidateAppRoute(args)
}
