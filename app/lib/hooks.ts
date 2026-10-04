import type { DehydratedState } from "@tanstack/query-core"
import * as React from "react"
import { useMatches } from "react-router"
import { merge } from "ts-deepmerge"

function resolveQuery(query: string) {
  if (query.startsWith("max-")) {
    return `(width < ${query.slice(4)})`
  }

  if (query.startsWith("min-")) {
    return `(width >= ${query.slice(4)})`
  }

  return query
}

export function useMediaQuery(query: string) {
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

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function useMinimumLoading({
  enabled,
  isLoading,
  minimumDuration = 250,
}: {
  enabled: boolean
  isLoading: boolean
  minimumDuration?: number
}) {
  const [showLoading, setShowLoading] = React.useState(false)
  const loadingStartedAtRef = React.useRef<number | null>(null)
  const wasLoadingRef = React.useRef(false)

  React.useEffect(() => {
    if (!enabled) {
      loadingStartedAtRef.current = null
      wasLoadingRef.current = false
      setShowLoading(false)
      return
    }

    if (isLoading) {
      if (!wasLoadingRef.current) {
        loadingStartedAtRef.current = Date.now()
        wasLoadingRef.current = true
      }

      setShowLoading(true)
      return
    }

    if (!wasLoadingRef.current) {
      return
    }

    wasLoadingRef.current = false
    const startedAt = loadingStartedAtRef.current

    if (startedAt === null) {
      setShowLoading(false)
      return
    }

    const remainingDuration = Math.max(
      0,
      minimumDuration - (Date.now() - startedAt),
    )
    const timeoutId = window.setTimeout(() => {
      loadingStartedAtRef.current = null
      setShowLoading(false)
    }, remainingDuration)

    return () => window.clearTimeout(timeoutId)
  }, [enabled, isLoading, minimumDuration])

  return enabled && showLoading
}

export function useDeleteConfirmation<Id>({
  deleteItems,
}: {
  deleteItems: (ids: readonly Id[]) => Promise<unknown>
}) {
  const [confirmation, setConfirmation] = React.useState<{
    ids: Id[]
    onSuccess?: () => void
  } | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)

  const requestDelete = React.useCallback(
    (ids: readonly Id[], onSuccess?: () => void) => {
      if (ids.length === 0) {
        return
      }

      setConfirmation({ ids: [...ids], onSuccess })
      setIsOpen(true)
    },
    [],
  )

  const confirmDelete = React.useCallback(() => {
    if (!confirmation) {
      return
    }

    setIsOpen(false)

    void deleteItems(confirmation.ids)
      .then(() => confirmation.onSuccess?.())
      .catch(() => undefined)
  }, [confirmation, deleteItems])

  return {
    confirmation,
    confirmDelete,
    isOpen,
    requestDelete,
    setIsOpen,
  }
}

export function useDehydratedState(): DehydratedState | undefined {
  const matches = useMatches()
  const dehydratedState = matches
    .map((match) => match.loaderData)
    .filter(isLoaderDataWithQueryClient)
    .map((loaderData) => loaderData.queryClient)

  return dehydratedState.length
    ? dehydratedState.reduce((accumulator, currentValue) =>
        merge(accumulator, currentValue),
      )
    : undefined
}

export function useIsMobile() {
  return useMediaQuery("max-768px")
}

function isLoaderDataWithQueryClient(
  loaderData: unknown,
): loaderData is { queryClient: DehydratedState } {
  return (
    Boolean(loaderData) &&
    typeof loaderData === "object" &&
    loaderData !== null &&
    "queryClient" in loaderData
  )
}
