import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { Calendar } = await vite.ssrLoadModule("/app/components/ui/calendar.tsx") as typeof import("../app/components/ui/calendar")
  const markup = renderToStaticMarkup(createElement(Calendar, {
    mode: "range",
    defaultMonth: new Date(2026, 9, 15),
    weekStartsOn: 1,
    classNames: {
      week: "calendar-week-preview",
      day_button: "calendar-day-customization",
    },
  }))
  const weekRows = [...markup.matchAll(/<tr\b[^>]*>/g)].filter(([row]) => row.includes("calendar-week-preview"))
  assert.ok(weekRows.length >= 4, "Every week row receives custom styles, including keys without local defaults")
  assert.match(markup, /class="[^"]*calendar-day-customization/, "Day button customization is retained")
  assert.match(markup, /class="[^"]*focus-visible:ring-ring/, "Default day button styles are retained")
  console.log("Calendar render checks passed")
} finally {
  await vite.close()
}
