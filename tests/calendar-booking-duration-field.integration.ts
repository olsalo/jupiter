import assert from "node:assert/strict"
import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { BookingDurationField } = await vite.ssrLoadModule("/app/components/calendar/booking-duration-field.tsx") as typeof import("../app/components/calendar/booking-duration-field")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources: { en: { translation: {} } } })
  type Props = ComponentProps<typeof import("../app/components/ui/number-field").NumberField>
  function control(length: number | null, maxLength = 1440) {
    let props!: Props
    const changes: (number | null)[] = []
    const sources: string[] = []
    function Capture() {
      const field = BookingDurationField({ length, maxLength, onLengthChange: (value, source) => { changes.push(value); sources.push(source) }, disabled: false, language: "en", lengthError: "Invalid length", serviceDurations: [20, 30, 90] })
      props = field.props.children.props
      return field
    }
    const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Capture)))
    const change = (value: number | null, reason: "increment-press" | "decrement-press" | "keyboard" | "input-change", direction?: -1 | 1) => props.onValueChange?.(value, { reason, direction } as Parameters<NonNullable<Props["onValueChange"]>>[1])
    return { changes, sources, change, markup }
  }
  const increment = control(30)
  increment.change(31, "increment-press", 1)
  assert.deepEqual(increment.changes, [90], "The plus control skips directly to the next service duration")
  const decrement = control(90)
  decrement.change(89, "decrement-press", -1)
  assert.deepEqual(decrement.changes, [30])
  const keyboard = control(90)
  keyboard.change(91, "keyboard", 1)
  assert.deepEqual(keyboard.changes, [105], "Keyboard stepping adds fifteen minutes after the longest service")
  const custom = control(25)
  custom.change(26, "keyboard", 1)
  custom.change(24, "keyboard", -1)
  custom.change(27, "input-change")
  custom.change(null, "input-change")
  assert.deepEqual(custom.changes, [30, 20, 27, null], "Stepping uses service lengths while direct typing preserves custom lengths")
  assert.deepEqual(custom.sources, ["step", "step", "input", "input"], "Manual edits are distinguished from steps so the selected service can remain unchanged")
  const bounded = control(30, 42)
  bounded.change(31, "increment-press", 1)
  assert.deepEqual(bounded.changes, [42])
  assert.deepEqual(bounded.sources, ["snap"], "Increasing to the next booking boundary preserves the selected service")
  const matchingBoundary = control(30, 90)
  matchingBoundary.change(31, "increment-press", 1)
  assert.deepEqual(matchingBoundary.sources, ["snap"], "An exact boundary preserves the service even if its length matches another service")
  assert.match(increment.markup, /aria-invalid="true"/, "Input error styling remains connected to the length field")
  console.info("PASS length picker buttons, keyboard, manual values, gap bounds and input errors")
} finally {
  await vite.close()
}
