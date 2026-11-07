import assert from "node:assert/strict"
import { createInstance } from "i18next"
import { readFile } from "node:fs/promises"
import { createServer } from "vite"
import { renderToStaticMarkup } from "react-dom/server"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/recent-booking-toasts",
  appType: "custom",
  resolve: { alias: { "~": appPath } },
  plugins: [{
    name: "recent-booking-toast-fixture",
    transform(code, id) {
      if (id !== `${appPath}/components/public-booking/recent-booking-toasts.tsx`) return
      return code
        .replace('import { useEffect, useRef } from "react"', `
          export const fixture = { effects: [], toasts: [], closed: [], bookings: [], requests: 0 }
          const useEffect = (effect) => fixture.effects.push(effect)
          const useRef = (value) => ({ current: value })
        `)
        .replace('import { useQueryClient } from "@tanstack/react-query"', `
          const useQueryClient = () => ({ query: async () => {
            fixture.requests += 1
            return fixture.bookings
          } })
        `)
        .replace('import { useTranslation } from "react-i18next"', `
          const useTranslation = () => fixture.translation
        `)
        .replace('import { ToastProvider } from "~/components/ui/toast"', 'const ToastProvider = () => null')
        .replace('import { Toast } from "@base-ui/react/toast"', `
          const Toast = { createToastManager: () => ({
            add: (toast) => { fixture.toasts.push(toast); return "activity-toast" },
            close: (id) => fixture.closed.push(id),
          }) }
        `)
        .replace('import { useTRPC } from "~/lib/trpc/client"', `
          const useTRPC = () => ({ booking: { getRecentBookings: { queryOptions: (scope) => scope } } })
        `)
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
const originalRandom = Math.random
try {
  const { RecentBookingToasts, fixture } = await vite.ssrLoadModule("/app/components/public-booking/recent-booking-toasts.tsx")
  const i18n = createInstance()
  await i18n.init({
    lng: "en", defaultNS: "booking", interpolation: { escapeValue: false },
    resources: {
      en: { booking: JSON.parse(await readFile(new URL("../app/locales/en/booking.json", import.meta.url), "utf8")) },
      fi: { booking: JSON.parse(await readFile(new URL("../app/locales/fi/booking.json", import.meta.url), "utf8")) },
    },
  })
  fixture.translation = { t: i18n.t.bind(i18n), i18n }
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
  } })
  const timers = new Map<number, { callback: () => void; delay: number }>()
  let nextId = 0
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    const id = ++nextId
    timers.set(id, { callback, delay })
    return id
  }) as unknown as typeof setTimeout
  globalThis.clearTimeout = ((id: number) => { timers.delete(id) }) as unknown as typeof clearTimeout
  const visibilityListeners = new Set<() => void>()
  const document = {
    visibilityState: "visible",
    addEventListener: (event: string, listener: () => void) => {
      assert.equal(event, "visibilitychange")
      visibilityListeners.add(listener)
    },
    removeEventListener: (event: string, listener: () => void) => {
      assert.equal(event, "visibilitychange")
      visibilityListeners.delete(listener)
    },
  }
  function setVisibility(state: string) {
    document.visibilityState = state
    visibilityListeners.forEach((listener) => listener())
  }
  Object.defineProperty(globalThis, "document", { configurable: true, value: document })
  async function tick(delay: number) {
    assert.equal(timers.size, 1)
    const [id, timer] = [...timers][0]
    assert.equal(timer.delay, delay)
    timers.delete(id)
    timer.callback()
    await Promise.resolve()
    await Promise.resolve()
  }

  fixture.bookings = [{ id: "first", serviceName: "Haircut", startsAt: new Date("2026-11-02T12:00:00Z") }]
  RecentBookingToasts({ scope: { organizationSlug: "barber" }, formatPreference: "eu", timeZone: "Europe/Helsinki" })
  const cleanup = fixture.effects[0]()
  assert.equal(fixture.toasts.length, 0)
  await tick(10_000)
  assert.equal(fixture.toasts.length, 1)
  assert.match(renderToStaticMarkup(fixture.toasts[0].title), /Someone booked/)
  assert.match(renderToStaticMarkup(fixture.toasts[0].title), /Haircut/)
  assert.match(renderToStaticMarkup(fixture.toasts[0].title), /Appointment time: 2.11 at 14:00/)
  fixture.bookings.push({ id: "second", serviceName: "Beard trim", startsAt: new Date("2026-11-03T12:00:00Z") })
  await tick(50_000)
  assert.equal(fixture.toasts.length, 2, "The second toast appears at 60 seconds from mounting")
  await tick(60_000)
  assert.equal(fixture.toasts.length, 2, "Already shown bookings are not repeated")
  fixture.bookings.push({ id: "third", serviceName: "Hair wash", startsAt: new Date("2026-11-04T12:00:00Z") })
  setVisibility("hidden")
  assert.deepEqual(fixture.closed, [], "Switching tabs does not dismiss the active toast")
  const requests = fixture.requests
  assert.equal(timers.size, 0, "Hiding the tab cancels the scheduled check")
  assert.equal(fixture.requests, requests, "Hidden tabs do not fetch or display activity")
  setVisibility("visible")
  assert.deepEqual(fixture.closed, [], "Returning resets the schedule without dismissing the active toast")
  assert.equal(fixture.requests, requests, "Returning to the tab does not fetch immediately")
  await tick(10_000)
  assert.equal(fixture.toasts.length, 3)
  await tick(50_000)
  await tick(60_000)
  assert.equal(fixture.toasts.length, 3, "Restarting the schedule preserves already-shown history")
  cleanup()
  assert.equal(timers.size, 0, "Leaving the booking page clears the timer")
  assert.equal(visibilityListeners.size, 0, "Leaving the page removes the visibility listener")
  assert.deepEqual(fixture.closed, ["activity-toast"])
  fixture.bookings = [fixture.bookings[0]]
  for (const language of ["en", "fi"]) {
    await i18n.changeLanguage(language)
    for (const formatPreference of ["eu", "us"]) {
      RecentBookingToasts({ scope: { organizationSlug: `barber-${language}-${formatPreference}` }, formatPreference, timeZone: "Europe/Helsinki" })
      const stop = fixture.effects.at(-1)()
      await tick(10_000)
      const toast = fixture.toasts.at(-1)
      const title = renderToStaticMarkup(toast.title)
      assert.ok(title.includes(language === "fi" ? "Joku varasi ajan" : "Someone booked"))
      assert.ok(title.includes("Haircut"))
      const date = formatPreference === "eu" ? "2.11" : "Nov 2"
      const time = formatPreference === "eu" ? "14:00" : "2:00 PM"
      assert.ok(title.includes(language === "fi"
        ? `Varattu aika: ${date} klo ${time}`
        : `Appointment time: ${date} at ${time}`))
      stop()
    }
  }
  fixture.bookings = [
    { id: "random-first", serviceName: "First choice", startsAt: new Date("2026-11-02T12:00:00Z") },
    { id: "random-second", serviceName: "Second choice", startsAt: new Date("2026-11-03T12:00:00Z") },
  ]
  Math.random = () => 0.99
  const props = { scope: { organizationSlug: "random-booking" }, formatPreference: "eu", timeZone: "Europe/Helsinki" }
  RecentBookingToasts(props)
  const stopRandom = fixture.effects.at(-1)()
  await tick(10_000)
  assert.match(renderToStaticMarkup(fixture.toasts.at(-1).title), /Second choice/, "Random selection can choose beyond the first booking")
  stopRandom()
  RecentBookingToasts(props)
  const stopReload = fixture.effects.at(-1)()
  await tick(10_000)
  assert.match(renderToStaticMarkup(fixture.toasts.at(-1).title), /First choice/, "Reloading favors bookings absent from the browser's recent history")
  const count = fixture.toasts.length
  await tick(50_000)
  assert.equal(fixture.toasts.length, count, "Exhausted history does not fall back to previously shown bookings")
  await tick(60_000)
  assert.equal(fixture.toasts.length, count, "Random selection still avoids repeating bookings during one visit")
  stopReload()
  fixture.bookings = [{ id: "only-booking", serviceName: "Only appointment", startsAt: new Date("2026-11-02T12:00:00Z") }]
  const singleProps = { ...props, scope: { organizationSlug: "single-booking" } }
  RecentBookingToasts(singleProps)
  const stopSingle = fixture.effects.at(-1)()
  const beforeSingle = fixture.toasts.length
  await tick(10_000)
  assert.equal(fixture.toasts.length, beforeSingle + 1)
  await tick(50_000)
  await tick(60_000)
  assert.equal(fixture.toasts.length, beforeSingle + 1, "One booking is shown only once")
  stopSingle()
  RecentBookingToasts(singleProps)
  const stopSingleReload = fixture.effects.at(-1)()
  await tick(10_000)
  await tick(50_000)
  assert.equal(fixture.toasts.length, beforeSingle + 1, "A single booking also stays hidden after reloading")
  fixture.bookings.push({ id: "new-booking", serviceName: "New appointment", startsAt: new Date("2026-11-03T12:00:00Z") })
  await tick(60_000)
  assert.equal(fixture.toasts.length, beforeSingle + 2, "New bookings still appear after the previous pool was exhausted")
  stopSingleReload()
  console.info("PASS recent booking timing, random selection, reload history, deduplication, languages, hidden tab behavior and cleanup")
} finally {
  Math.random = originalRandom
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument)
  else Reflect.deleteProperty(globalThis, "document")
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage)
  else Reflect.deleteProperty(globalThis, "localStorage")
  await vite.close()
}
