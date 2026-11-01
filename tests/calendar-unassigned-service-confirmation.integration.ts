import assert from "node:assert/strict"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-tests/calendar-unassigned-service-confirmation", appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname, "@": new URL("../app", import.meta.url).pathname, "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname } },
  server: { ws: false, middlewareMode: true, hmr: false, watch: null },
})

try {
  const { useUnassignedServiceConfirmation } = await vite.ssrLoadModule("/app/components/calendar/use-unassigned-service-confirmation.tsx") as typeof import("../app/components/calendar/use-unassigned-service-confirmation")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources: { en: { translation: {} } } })
  let confirmation!: ReturnType<typeof useUnassignedServiceConfirmation>
  function Capture() {
    confirmation = useUnassignedServiceConfirmation()
    return null
  }
  renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Capture)))

  let saves = 0
  const save = async () => {
    if (await confirmation.confirmUnassignedService()) saves += 1
  }
  const cancelled = save()
  await Promise.resolve()
  assert.equal(saves, 0, "Unassigned service bookings wait for a decision before saving")
  const dialog = confirmation.unassignedServiceConfirmation
  dialog.props.onOpenChange(false)
  await cancelled
  assert.equal(saves, 0, "Closing or cancelling the modal does not save")

  const accepted = save()
  await Promise.resolve()
  assert.equal(saves, 0, "A new save attempt asks for confirmation again")
  const popup = dialog.props.children as ReactElement<{ forceBackdrop: boolean; children: ReactElement[] }>
  assert.equal(popup.props.forceBackdrop, true, "The nested confirmation always renders its backdrop")
  const footer = popup.props.children[1] as ReactElement<{ children: ReactElement[] }>
  const confirmButton = footer.props.children[1] as ReactElement<{ onClick: () => void }>
  confirmButton.props.onClick()
  await accepted
  assert.equal(saves, 1, "Explicit confirmation saves the unassigned service booking once")

  const repeated = save()
  await Promise.resolve()
  assert.equal(saves, 1, "Each save requires its own acknowledgement")
  dialog.props.onOpenChange(false)
  await repeated
  assert.equal(saves, 1)
  console.info("PASS unassigned service confirmation, cancellation, nested backdrop and explicit acknowledgement")
} finally {
  await vite.close()
}
