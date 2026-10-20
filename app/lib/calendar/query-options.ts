// Calendar controls and forms share these results without creating polling timers
export const calendarReferenceQueryOptions = {
  staleTime: 5 * 60 * 1000,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const

export const calendarPanelQueryOptions = {
  staleTime: 60 * 1000,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const

export const calendarAvailabilityQueryOptions = {
  staleTime: Infinity,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const

// Keep the live calendar fresh between interactions without interrupting an active edit
export function calendarBookingsQueryOptions(interacting: boolean) {
  return {
    staleTime: 60 * 1000,
    refetchInterval: interacting ? false : 60 * 1000,
    refetchOnWindowFocus: !interacting,
    refetchOnReconnect: !interacting,
    refetchOnMount: !interacting,
  } as const
}
