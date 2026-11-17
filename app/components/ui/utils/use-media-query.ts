import * as React from "react"

function resolveQuery(query: string) {
  if (query.startsWith("max-")) {
    return `(width < ${query.slice(4)})`
  }

  if (query.startsWith("min-")) {
    return `(width >= ${query.slice(4)})`
  }

  return query
}

export function useMediaQuery(query: string, { serverMatches = false }: { serverMatches?: boolean } = {}) {
  const mediaQuery = resolveQuery(query)

  const subscribe = React.useCallback((onChange: () => void) => {
    const mediaQueryList = window.matchMedia(mediaQuery)
    mediaQueryList.addEventListener("change", onChange)

    return () => {
      mediaQueryList.removeEventListener("change", onChange)
    }
  }, [mediaQuery])

  const getSnapshot = React.useCallback(
    () => window.matchMedia(mediaQuery).matches,
    [mediaQuery],
  )

  const getServerSnapshot = React.useCallback(() => serverMatches, [serverMatches])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useIsMobile() {
  return useMediaQuery("max-768px")
}
