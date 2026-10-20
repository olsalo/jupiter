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
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-block-time-ssr", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { CalendarBlockTime } = await vite.ssrLoadModule("/app/components/calendar/calendar-block-time.tsx") as typeof import("../app/components/calendar/calendar-block-time")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const own = { id: "own", memberId: "member", name: "Own member", isActive: true, acceptsAppointments: true }
  const other = { ...own, id: "other", memberId: null, name: "Other member" }
  const organization = { id: "organization", role: "owner", memberId: "member", settings: { timezone: "Europe/Helsinki", defaultStartHour: 8, defaultEndHour: 18 } }
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], organization)
  queryClient.setQueryData([...options.staff.list.queryKey()], [own, other])
  const block = (id: string, title: string, startsAt: string, endsAt: string) => ({ id, title, startsAt: new Date(startsAt), endsAt: new Date(endsAt), recurrence: null })
  queryClient.setQueryData([...options.availability.getTimeOff.queryKey({ staffMemberId: own.id })], [block("own-block", "Own upcoming holiday", "2090-06-03T21:00:00Z", "2090-06-04T21:00:00Z")])
  queryClient.setQueryData([...options.availability.getTimeOff.queryKey({ staffMemberId: other.id })], [
    block("other-block", "Other upcoming holiday", "2090-06-03T21:00:00Z", "2090-06-05T21:00:00Z"),
    block("expired", "Expired holiday", "2000-06-03T21:00:00Z", "2000-06-04T21:00:00Z"),
  ])
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ org: { id: organization.id }, organizations: [{ id: organization.id, role: "owner" }], locale: i18n.language, formatPreference: "eu", organizationTimezone: "Europe/Helsinki" }), children: [{ path: "calendar/block-time", Component: CalendarBlockTime }] }])
  async function render(search = "") {
    const context = await handler.query(new Request(`https://example.invalid/calendar/block-time${search}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const owner = await render("?date=2030-10-14&member=other")
  assert.match(owner, /aria-label="Team member"/, "Managers can choose a member")
  assert.match(owner, /Other member/, "The selected calendar member is used")
  assert.match(owner, /Availability/)
  assert.match(owner, /Time off/)
  assert.match(owner, /Add time off/)
  assert.doesNotMatch(owner, /Start date|End date|Set times/, "Time off opens with the upcoming list and a separate add dialog")
  assert.doesNotMatch(owner, /14.10.2030/, "Calendar dates do not prefill the form")
  assert.match(owner, /Time off/)
  assert.match(owner, /Other upcoming holiday/)
  assert.match(owner, /4.6.2090 – 5.6.2090/, "Full-day ranges show inclusive dates")
  assert.doesNotMatch(owner, /Expired holiday|Own upcoming holiday/, "Lists only the selected member's upcoming blocks")
  await i18n.changeLanguage("fi")
  const finnish = await render()
  assert.match(finnish, /Poissaolot/)
  assert.match(finnish, /Lisää poissaolo/)
  await i18n.changeLanguage("en")
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { ...organization, role: "member" })
  const member = await render("?member=other")
  assert.doesNotMatch(member, /aria-label="Team member"/, "Standard members cannot select someone else")
  assert.match(member, /Add time off/, "Members can block their own time")
  assert.match(member, /Own upcoming holiday/)
  assert.doesNotMatch(member, /Other upcoming holiday/, "A forged member parameter cannot expose another member's blocks")
  queryClient.setQueryData([...options.availability.getTimeOff.queryKey({ staffMemberId: own.id })], [])
  assert.match(await render(), /No upcoming time off/, "An empty upcoming list has a clear empty state")
  queryClient.setQueryData([...options.staff.list.queryKey()], [other])
  const notBookable = await render()
  assert.match(notBookable, /Enable appointments to add services and working hours/)
  assert.doesNotMatch(notBookable, /type="submit"/)
  console.log("Calendar block time rendering checks passed")
} finally {
  queryClient.clear()
  await vite.close()
}
