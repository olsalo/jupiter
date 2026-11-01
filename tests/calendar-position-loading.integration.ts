import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-position-loading",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib`, "@coss/ui/components": `${appPath}/components/ui` } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { CalendarTimeline } = await vite.ssrLoadModule("/app/components/calendar/calendar-timeline.tsx") as typeof import("../app/components/calendar/calendar-timeline")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources: { en: { translation: { loading: "Loading" } } } })
  for (const expandToContent of [false, true]) for (const formatPreference of ["eu", "us"] as const) for (const viewMode of ["day", "week"] as const) {
    const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(CalendarTimeline, {
      expandToContent,
      initialNow: Date.parse("2026-10-30T12:00:00Z"),
      days: Array.from({ length: viewMode === "week" ? 7 : 1 }, (_, index) => new Date(Date.UTC(2026, 9, 26 + index, 12))),
      members: [{ id: "alice", name: "Alice" }],
      startMinute: 480,
      endMinute: 1080,
      timeZone: "Europe/Helsinki",
      formatPreference,
      viewMode,
    })))
    const section = markup.match(/<section\b[^>]*>/)?.[0] ?? ""
    const gutter = markup.match(/data-slot="calendar-time-gutter" style="width:(\d+)px"/)?.[1]
    const mobile = expandToContent && viewMode === "day"
    assert.equal(Number(gutter), mobile ? formatPreference === "us" ? 64 : 48 : formatPreference === "us" ? 80 : 56, "Twenty-four-hour time uses a narrower gutter while twelve-hour time retains room for AM/PM")
    if (viewMode === "week") {
      const dividers = markup.match(/<div[^>]*data-slot="calendar-date-dividers"[^>]*>/)?.[0] ?? ""
      assert.match(dividers, new RegExp(`left:${gutter}px`), "Week dividers use the same offset as the time gutter in both clock formats")
      assert.doesNotMatch(dividers, /left-20/, "Week dividers do not retain the old fixed time-column width")
    }
    assert.match(section, /aria-busy="true"/, "Desktop and mobile wait for client positioning")
    assert.match(section, /\binvisible\b/, "The unpositioned grid reserves space while hidden")
    assert.match(markup, /data-slot="calendar-position-loading"/, "Positioning displays a loading indicator outside the hidden grid")
    assert.match(markup, /aria-label="Loading"/, "The calendar shows a spinner until positioning is ready")
  }
  console.info("PASS desktop and mobile reserve the initial layout and show a spinner until positioning is ready")
} finally {
  await vite.close()
}
