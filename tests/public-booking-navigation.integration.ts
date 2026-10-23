import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createMemoryRouter, RouterProvider } from "react-router"
import { createServer } from "vite"
import type { BookingPageData } from "../app/components/public-booking/booking-types"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/public-booking-navigation",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
try {
  const { useBookingNavigation } = await vite.ssrLoadModule("/app/components/public-booking/use-booking-navigation.ts") as typeof import("../app/components/public-booking/use-booking-navigation")
  const data = { services: [{ id: "service-1" }, { id: "service-2" }] } as BookingPageData
  let detailsServiceId: string | undefined
  let navigation!: ReturnType<typeof useBookingNavigation>
  function Capture() {
    navigation = useBookingNavigation(data, detailsServiceId)
    return null
  }
  const router = createMemoryRouter([{ path: "/book/:business", Component: Capture }], { initialEntries: ["/book/test"] })
  const render = () => renderToStaticMarkup(createElement(RouterProvider, { router }))
  render()
  assert.equal(navigation.screen, "service")
  await router.navigate("/book/test?service=service-1&step=time")
  render()
  assert.equal(navigation.screen, "time")
  const slot = { startsAt: "2026-11-03T08:00:00.000Z", endsAt: "2026-11-03T08:20:00.000Z", staffMemberId: "staff-1", locationId: "location-1" }
  const slotParams = new URLSearchParams({ service: "service-1", step: "time", start: slot.startsAt, end: slot.endsAt, member: slot.staffMemberId, slotLocation: slot.locationId })
  await router.navigate(`/book/test?${slotParams}`, { replace: true })
  render()
  assert.deepEqual(navigation.slot, slot)
  slotParams.set("step", "details")
  await router.navigate(`/book/test?${slotParams}`)
  render()
  assert.equal(navigation.screen, "details")
  await router.navigate(-1)
  render()
  assert.equal(navigation.screen, "time")
  assert.deepEqual(navigation.slot, slot, "Back preserves the selected appointment")
  await router.navigate(1)
  render()
  assert.equal(navigation.screen, "details")
  detailsServiceId = "service-1"
  slotParams.set("step", "review")
  await router.navigate(`/book/test?${slotParams}`)
  render()
  assert.equal(navigation.screen, "review")
  assert.ok(router.state.location.search.includes("step=review"))
  detailsServiceId = undefined
  render()
  assert.equal(navigation.screen, "details", "Reloading review asks for personal details again")
  detailsServiceId = "service-2"
  render()
  assert.equal(navigation.screen, "details", "Another service's details cannot unlock review")
  await router.navigate("/book/test?service=service-2&step=time")
  render()
  assert.equal(navigation.serviceId, "service-2")
  assert.equal(navigation.slot, null)
  assert.equal(navigation.locationChoice, "")
  assert.equal(navigation.staffChoice, "")
  await router.navigate("/book/test?service=unknown&step=review")
  render()
  assert.equal(navigation.screen, "service", "Unknown services return to selection")
  await router.navigate("/book/test?service=service-1&step=details&start=invalid&end=invalid&member=staff-1")
  render()
  assert.equal(navigation.screen, "time", "Invalid URL dates cannot unlock the details step")
  router.dispose()
  console.info("PASS public booking URL steps, Back/Forward, slot persistence, service changes and invalid-link recovery")
} finally {
  await vite.close()
}
