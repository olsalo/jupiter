import { useEffect, useState } from "react"

export function useModalQueryLoading(query: { isLoading: boolean, isFetching: boolean, isStale: boolean }, cacheKey = "") {
  const [openedKey, setOpenedKey] = useState<string | null>(null)
  const loadingOnOpen = query.isLoading || (query.isFetching && query.isStale)

  useEffect(() => {
    if (!loadingOnOpen) setOpenedKey(cacheKey)
  }, [cacheKey, loadingOnOpen])

  // Only the opening refresh hides stale content. Later refreshes keep it visible.
  return query.isLoading || (openedKey !== cacheKey && loadingOnOpen)
}
