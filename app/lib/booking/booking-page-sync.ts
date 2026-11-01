function openChannel(organizationSlug: string) {
  try {
    return new BroadcastChannel(`jupiter-booking-page:${organizationSlug}`)
  } catch {
    // Normal query freshness still applies when cross-tab messaging is unavailable.
    return null
  }
}

export function notifyBookingPageSaved(organizationSlug: string) {
  const channel = openChannel(organizationSlug)
  try {
    channel?.postMessage("saved")
  } finally {
    channel?.close()
  }
}

export function subscribeToBookingPageSaves(organizationSlug: string, onSaved: () => void) {
  const channel = openChannel(organizationSlug)
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === "saved") onSaved()
  }
  return () => channel?.close()
}
