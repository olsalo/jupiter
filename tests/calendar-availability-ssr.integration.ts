import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, Outlet, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-availability-ssr", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { CalendarAvailability } = await vite.ssrLoadModule("/app/components/calendar/calendar-availability.tsx") as typeof import("../app/components/calendar/calendar-availability")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const own = { id: "own", memberId: "member", name: "Own member", isActive: true, acceptsAppointments: true }
  const other = { ...own, id: "other", memberId: null, name: "Other member" }
  const organization = { id: "organization", role: "owner", memberId: "member", settings: { timezone: "Europe/Helsinki", defaultStartHour: 8, defaultEndHour: 18 } }
  const rule = { dayOfWeek: 1, startMinute: 540, endMinute: 1020, timezone: "Europe/Helsinki", isActive: true, locationId: null, validFrom: null, validUntil: null }
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], organization)
  queryClient.setQueryData([...options.staff.list.queryKey()], [own, other])
  queryClient.setQueryData([...options.availability.getRules.queryKey({})], [rule])
  queryClient.setQueryData([...options.availability.getRules.queryKey({ staffMemberId: own.id })], [rule, { ...rule, startMinute: 600, validFrom: new Date("2090-01-02T22:00:00Z") }])
  queryClient.setQueryData([...options.availability.getBreaks.queryKey({ staffMemberId: own.id })], [])
  queryClient.setQueryData([...options.availability.getRules.queryKey({ staffMemberId: other.id })], [])
  queryClient.setQueryData([...options.availability.getBreaks.queryKey({ staffMemberId: other.id })], [])
  let initialKind: "workingHours" | "breaks" | "extraHours" | "timeOff" = "workingHours"
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ org: { id: organization.id }, organizations: [{ id: organization.id, role: "owner" }], locale: i18n.language, formatPreference: "eu", organizationTimezone: "Europe/Helsinki" }), children: [{ path: "calendar/availability", Component: () => createElement(CalendarAvailability, { initialKind }) }] }])
  async function render(search = "") {
    const context = await handler.query(new Request(`https://example.invalid/calendar/availability${search}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const owner = await render()
  assert.match(owner, /aria-label="Team member"/, "Managers can choose a member")
  assert.match(owner, /Working hours/)
  assert.match(owner, /Breaks/)
  const currentHourInputs = owner.match(/<input[^>]*name="workingHours\[\d+\]\.startMinute"[^>]*>/g) ?? []
  assert.equal(currentHourInputs.length, 1, "Calendar excludes upcoming versions from the current schedule")
  assert.match(currentHourInputs[0], /value="540"/)
  assert.match(owner, /tabler-icon-clock/)
  assert.match(owner, /tabler-icon-coffee/)
  assert.match(owner, /Apply changes from/)
  assert.match(owner, /data-slot="working-hours-week"/, "Calendar reuses the team weekly editor")
  assert.doesNotMatch(owner, /data-slot="breaks-week"/, "Working hours has no hidden break editor")
  assert.match(owner, /Current schedule/)
  assert.match(owner, /aria-label="Schedule"/, "Saved schedules use a compact selector")
  assert.doesNotMatch(owner, /Editing today|In use now|Working hours and breaks change together/, "Repeated schedule explanations do not push the weekly editor down")
  assert.match(owner, /noValidate=""/i, "Availability uses RVF without browser form validation")
  await i18n.changeLanguage("fi")
  const finnish = await render()
  assert.match(finnish, /Nykyinen aikataulu/)
  assert.match(finnish, /aria-label="Aikataulu"/)
  assert.match(finnish, /Muutokset voimaan/)
  await i18n.changeLanguage("en")
  initialKind = "breaks"
  const breakEditor = await render()
  assert.match(breakEditor, /data-slot="breaks-week"/)
  assert.doesNotMatch(breakEditor, /data-slot="working-hours-week"/, "Breaks has no hidden working hours editor")
  assert.match(breakEditor, /No breaks/, "Breaks still use the saved working days")
  initialKind = "extraHours"
  queryClient.setQueryData([...options.availability.getExtraHours.queryKey({ staffMemberId: own.id })], [])
  queryClient.setQueryData([...options.availability.getExtraHours.queryKey({ staffMemberId: other.id })], [{ id: "extra", startsAt: new Date("2090-01-07T08:00:00Z"), endsAt: new Date("2090-01-07T12:00:00Z") }])
  const extraEmpty = await render()
  assert.match(extraEmpty, /Add extra hours/)
  assert.match(extraEmpty, /No extra hours yet/)
  assert.doesNotMatch(extraEmpty, /data-slot="working-hours-week"/, "Extra hours has its own list inside Availability")
  const extraOther = await render("?member=other")
  assert.match(extraOther, /Actions for extra hours on/)
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { ...organization, role: "member" })
  const ownExtra = await render("?member=other")
  assert.match(ownExtra, /No extra hours yet/, "Members see only their own extra hours")
  assert.doesNotMatch(ownExtra, /Actions for extra hours on/)
  initialKind = "timeOff"
  queryClient.setQueryData([...options.availability.getTimeOff.queryKey({ staffMemberId: own.id })], [])
  queryClient.setQueryData([...options.availability.getTimeOff.queryKey({ staffMemberId: other.id })], [{ id: "holiday", title: "Other member holiday", startsAt: new Date("2090-06-03T21:00:00Z"), endsAt: new Date("2090-06-04T21:00:00Z"), recurrence: null }])
  const ownTimeOff = await render("?member=other")
  assert.match(ownTimeOff, /Add time off/)
  assert.match(ownTimeOff, /No upcoming time off/)
  assert.doesNotMatch(ownTimeOff, /Other member holiday|data-slot="working-hours-week"/)
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { ...organization, role: "owner" })
  assert.match(await render("?member=other"), /Other member holiday/, "The time off tab uses the selected member")
  initialKind = "workingHours"
  assert.match(await render("?tab=workingHours"), /data-slot="working-hours-week"/, "Working hours action opens its tab")
  const linkedBreaks = await render("?tab=breaks&date=2030-10-14&member=own")
  assert.match(linkedBreaks, /data-slot="breaks-week"/, "Breaks action selects its tab through the URL")
  assert.doesNotMatch(linkedBreaks, /data-slot="working-hours-week"/)
  assert.match(await render("?tab=timeOff&member=other"), /Other member holiday/, "Time off action preserves the selected member")
  assert.match(await render("?tab=extraHours&member=other"), /Actions for extra hours on/, "Extra hours action opens its tab for the selected member")
  assert.match(await render("?tab=unknown"), /data-slot="working-hours-week"/, "Invalid tab values fall back to working hours")
  initialKind = "extraHours"
  assert.match(await render("?tab=breaks"), /data-slot="breaks-week"/, "An explicit tab takes priority over the legacy route default")
  initialKind = "workingHours"
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { ...organization, role: "member" })
  const member = await render("?member=other")
  assert.doesNotMatch(member, /aria-label="Team member"/, "Standard members cannot select someone else")
  assert.match(member, /Current schedule/, "A forged member parameter still opens the member's own schedule")
  queryClient.setQueryData([...options.staff.list.queryKey()], [other])
  const notBookable = await render()
  assert.match(notBookable, /Enable appointments to add services and working hours/)
  assert.doesNotMatch(notBookable, /data-slot="working-hours-week"/)
  queryClient.removeQueries({ queryKey: options.organizations.getCurrent.queryKey(), exact: true })
  queryClient.removeQueries({ queryKey: options.staff.list.queryKey(), exact: true })
  const loadingSheet = await render()
  assert.match(loadingSheet, /aria-label="Team member"/, "The member picker keeps its place before organization and staff data load")
  for (const label of ["Working hours", "Breaks", "Time off", "Extra hours"]) {
    assert.ok(loadingSheet.includes(`>${label}</button>`), `${label} stays visible during the initial load`)
  }
  assert.match(loadingSheet, /Loading working hours/)
  console.log("Calendar availability rendering checks passed")
} finally {
  queryClient.clear()
  await vite.close()
}
