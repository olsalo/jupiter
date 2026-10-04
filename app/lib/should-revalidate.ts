import type { ShouldRevalidateFunctionArgs } from "react-router"

function isAccountRoute(pathname: string) {
  return (
    pathname === "/auth" ||
    pathname === "/onboarding" ||
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
