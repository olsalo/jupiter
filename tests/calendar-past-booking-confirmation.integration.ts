import assert from "node:assert/strict"
import { mock } from "node:test"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false, appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname, "@": new URL("../app", import.meta.url).pathname, "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname } },
  server: { ws: false, middlewareMode: true, hmr: false, watch: null },
})

try {
  const { usePastBookingConfirmation } = await vite.ssrLoadModule("/app/components/calendar/use-past-booking-confirmation.tsx") as typeof import("../app/components/calendar/use-past-booking-confirmation")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources: { en: { translation: {} } } })
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-19T12:00:00Z") })
  let confirmation!: ReturnType<typeof usePastBookingConfirmation>
  function Capture() {
    confirmation = usePastBookingConfirmation()
    return null
  }
  renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Capture)))

  assert.equal(await confirmation.confirmPastBooking("2026-10-19T12:05:00Z"), true, "Future bookings can save immediately")
  let saves = 0
  const save = async (startsAt: string) => {
    if (await confirmation.confirmPastBooking(startsAt)) saves += 1
  }
  const cancelled = save("2026-10-19T11:00:00Z")
  await Promise.resolve()
  assert.equal(saves, 0, "Past bookings wait for a decision before saving")
  const dialog = confirmation.pastBookingConfirmation
  dialog.props.onOpenChange(false)
  await cancelled
  assert.equal(saves, 0, "Closing or cancelling the modal does not save")

  const accepted = save("2026-10-18T11:00:00Z")
  await Promise.resolve()
  assert.equal(saves, 0, "A new save attempt asks for confirmation again")
  const popup = dialog.props.children as ReactElement<{ forceBackdrop: boolean; children: ReactElement[] }>
  assert.equal(popup.props.forceBackdrop, true, "The nested confirmation always renders its backdrop")
  const footer = popup.props.children[1] as ReactElement<{ children: ReactElement[] }>
  const confirmButton = footer.props.children[1] as ReactElement<{ onClick: () => void }>
  confirmButton.props.onClick()
  await accepted
  assert.equal(saves, 1, "Explicit confirmation saves the past booking once")

  mock.timers.setTime(Date.parse("2026-10-19T12:10:00Z"))
  const elapsed = save("2026-10-19T12:05:00Z")
  await Promise.resolve()
  assert.equal(saves, 1, "The start is checked at save time even when it was previously in the future")
  dialog.props.onOpenChange(false)
  await elapsed
  console.info("PASS past start confirmation, cancellation, explicit save and save-time clock checks")
} finally {
  mock.timers.reset()
  await vite.close()
}
