import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { createServer } from "vite"
import { createMemoryRouter, createRequestHandler, RouterProvider, type ServerBuild } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"

process.env.NODE_ENV = "test"
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: {
    "@coss/ui/components": new URL("../app/components/ui", import.meta.url).pathname,
    "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname,
    "@": new URL("../app", import.meta.url).pathname,
    "~": new URL("../app", import.meta.url).pathname,
  } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const build = await import(new URL("../build/server/index.js", import.meta.url).href) as ServerBuild
const handler = createRequestHandler(build, "production")
const suffix = randomUUID()
let organizationId: string | undefined

try {
  const { FormHeadingEditor } = await vite.ssrLoadModule("/app/components/forms/editor/form-heading-editor.tsx") as typeof import("../app/components/forms/editor/form-heading-editor")
  const { PublicForm } = await vite.ssrLoadModule("/app/components/forms/renderer/public-form.tsx") as typeof import("../app/components/forms/renderer/public-form")
  const { Alert, AlertDescription } = await vite.ssrLoadModule("/app/components/ui/alert.tsx") as typeof import("../app/components/ui/alert")
  for (const variant of ["default", "info", "success", "warning", "error"] as const) {
    const alertHtml = renderToStaticMarkup(createElement(Alert, { variant }, createElement(AlertDescription, null, "Status message")))
    const expectedIcon = { default: "alert-circle", info: "alert-circle", success: "circle-check", warning: "alert-triangle", error: "exclamation-circle" }[variant]
    assert.ok(alertHtml.includes(`tabler-icon-${expectedIcon}`), "Alerts must use the icon appropriate to their status")
    assert.equal((alertHtml.match(/<svg\b/g) ?? []).length, 1)
    const plainAlertHtml = renderToStaticMarkup(createElement(Alert, { variant, showIcon: false }, createElement(AlertDescription, null, "Status message")))
    assert.equal(plainAlertHtml.includes("<svg"), false, "showIcon=false must hide the icon for every variant")
    assert.ok(plainAlertHtml.includes("Status message"))
  }
  const { FormPreview } = await vite.ssrLoadModule("/app/components/forms/editor/form-preview.tsx") as typeof import("../app/components/forms/editor/form-preview")
  const { FormSettingsEditor } = await vite.ssrLoadModule("/app/components/forms/form-settings-editor.tsx") as typeof import("../app/components/forms/form-settings-editor")
  const { TimePicker } = await vite.ssrLoadModule("/app/components/time-picker.tsx") as typeof import("../app/components/time-picker")
  const { DateTimePicker } = await vite.ssrLoadModule("/app/components/date-time-picker.tsx") as typeof import("../app/components/date-time-picker")
  const { createTimeOptions } = await vite.ssrLoadModule("/app/lib/time-picker.ts") as typeof import("../app/lib/time-picker")
  const { formAccentColors, formAccentForeground } = await vite.ssrLoadModule("/app/lib/forms/form-accent-colors.ts") as typeof import("../app/lib/forms/form-accent-colors")
  const { AccentColorSelect } = await vite.ssrLoadModule("/app/components/forms/accent-color-select.tsx") as typeof import("../app/components/forms/accent-color-select")
  const { createFormSettingSchema, formSettingsFieldsSchema, isFormScheduleValid } = await vite.ssrLoadModule("/app/lib/forms/schemas/form-settings.ts") as typeof import("../app/lib/forms/schemas/form-settings")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "forms", interpolation: { escapeValue: false } })
  const renderDefaultAccent = () => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(AccentColorSelect, {
    value: null, disabled: false, invalid: false, label: "Accent color", onChange: () => undefined,
  })))
  assert.ok(renderDefaultAccent().includes("Blackberry"))
  await i18n.changeLanguage("fi")
  assert.ok(renderDefaultAccent().includes("Karhunvatukka"))
  const finnishFruitNames = ["Mansikka", "Appelsiini", "Mango", "Limetti", "Kiivi", "Mustikka", "Rypäle", "Vadelma"]
  for (const [index, { color }] of formAccentColors.entries()) {
    const selectedAccent = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(AccentColorSelect, {
      value: color, disabled: false, invalid: false, label: "Korostusväri", onChange: () => undefined,
    })))
    assert.ok(selectedAccent.includes(finnishFruitNames[index]), "Every fruit preset must show its Finnish name")
  }
  await i18n.changeLanguage("en")
  const hourlyTimes = createTimeOptions()
  assert.equal(hourlyTimes.length, 24)
  assert.equal(hourlyTimes[0], "00:00")
  assert.equal(hourlyTimes.at(-1), "23:00")
  assert.deepEqual(createTimeOptions({ startTime: "09:15", endTime: "11:00", intervalMinutes: 30 }), ["09:15", "09:45", "10:15", "10:45"])
  assert.deepEqual(createTimeOptions({ startTime: "09:00", endTime: "10:00", intervalMinutes: 30 }), ["09:00", "09:30", "10:00"])
  assert.throws(() => createTimeOptions({ intervalMinutes: 0 }))
  assert.throws(() => createTimeOptions({ intervalMinutes: 1.5 }))
  assert.throws(() => createTimeOptions({ startTime: "18:00", endTime: "09:00" }))
  assert.throws(() => createTimeOptions({ endTime: "24:00" }))
  for (const [value, eu, us] of [["00:00", "0:00", "12:00 AM"], ["12:00", "12:00", "12:00 PM"], ["23:59", "23:59", "11:59 PM"]]) {
    for (const [formatPreference, expected] of [["eu", eu], ["us", us]] as const) {
      const timeHtml = renderToStaticMarkup(createElement(TimePicker, { value, formatPreference, language: "fi", label: "Time", onChange: () => undefined }))
      assert.ok(timeHtml.includes(expected), `${value} should display as ${expected}`)
      assert.ok(timeHtml.includes('role="combobox"'))
      assert.equal(timeHtml.includes('aria-invalid="true"'), false)
    }
  }
  for (const [formatPreference, expected] of [["eu", "12:00"], ["us", "12:00 PM"]] as const) {
    const dateTimeHtml = renderToStaticMarkup(createElement(DateTimePicker, {
      value: "2026-10-01T09:00:00.000Z", defaultTime: "00:00", timeLabel: "Opening time", label: "Opening date",
      clearLabel: "Clear date", placeholder: "Choose date", disabled: false, invalid: false,
      formatPreference, language: "en", timeZone: "Europe/Helsinki", onChange: () => undefined,
    }))
    assert.ok(dateTimeHtml.includes(expected), "Time picker must retain the organization's wall-clock time")
    assert.equal(dateTimeHtml.includes('type="time"'), false)
  }
  console.info("PASS reusable time picker ranges, intervals, midnight/noon, EU/US clocks, off-step saved times, and organization timezone")
  const renderHeadingEditor = (description: string | null) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(FormHeadingEditor, {
    formId: "heading-test", title: "Customer feedback", description, onChange: () => undefined,
  })))
  const headingWithoutDescription = renderHeadingEditor(null)
  assert.ok(headingWithoutDescription.includes('value="Customer feedback"'))
  assert.ok(headingWithoutDescription.includes("Form name"))
  assert.ok(headingWithoutDescription.includes("Add description"))
  assert.equal(headingWithoutDescription.includes("<textarea"), false)
  assert.equal(headingWithoutDescription.includes("Delete"), false)
  assert.equal(headingWithoutDescription.includes("Duplicate"), false)
  assert.equal(headingWithoutDescription.includes("data-form-drag-handle"), false)
  const headingWithDescription = renderHeadingEditor("Tell us about your visit.")
  assert.ok(headingWithDescription.includes("<textarea"))
  assert.ok(headingWithDescription.includes("Tell us about your visit."))
  await i18n.changeLanguage("fi")
  assert.ok(renderHeadingEditor(null).includes("Lomakkeen nimi"))
  assert.ok(renderHeadingEditor(null).includes("Lisää kuvaus"))
  await i18n.changeLanguage("en")
  console.info("PASS heading editor defaults, optional description switch, Finnish labels, and absence of delete/drag controls")

  const organization = await prisma.organization.create({ data: { name: "Public runtime test", slug: `runtime-${suffix}`, createdAt: new Date() } })
  organizationId = organization.id
  const itemId = `item-${suffix}`
  const choiceId = `choice-${suffix}`
  const multiId = `multi-${suffix}`
  const form = await prisma.form.create({ data: {
    organizationId,
    title: "Public runtime test",
    description: "Tell us about your visit.",
    slug: `runtime-${suffix}`,
    emailCollection: "REQUIRED",
    limitOneResponsePerEmail: true,
    sections: { create: { items: { create: [
      { id: itemId, type: "SHORT_TEXT", label: "Your name", required: true },
      { id: choiceId, type: "SINGLE_CHOICE", label: "Pick a size", required: true, sortOrder: 1, settings: { allowOther: true }, options: { create: [
        { label: "Small", value: "size-small" }, { label: "Large", value: "size-large", sortOrder: 1 },
      ] } },
      { id: multiId, type: "MULTIPLE_CHOICE", label: "Choose services", required: true, sortOrder: 2, settings: { allowOther: true }, options: { create: [
        { label: "Cleaning", value: "cleaning" }, { label: "Repairs", value: "repairs", sortOrder: 1 },
      ] } },
    ] } } },
  } })
  const caller = appRouter.createCaller({
    headers: new Headers(), prisma, user: { id: "runtime-test", name: "Runtime test", email: "runtime@example.invalid", emailVerified: false, createdAt: new Date(), updatedAt: new Date() },
    organizationId, request: undefined, session: undefined, formatLocale: "en-US", formatPreference: "us", locale: "en",
  })
  const savedSettings = await caller.forms.settings.update({ id: form.id, settings: { submitButtonText: "Send feedback", theme: "LIGHT", accentColor: "#facc15" } })
  const rowDefaults = Object.fromEntries(Object.keys(formSettingsFieldsSchema.shape).map((field) => [field, savedSettings[field as keyof typeof savedSettings]]))
  const schedule = { startsAt: "2026-10-01T10:00:00Z", closesAt: "2026-10-01T12:00:00Z" }
  const closingSchema = createFormSettingSchema("closesAt", schedule)
  for (const closesAt of ["2026-10-01T09:00:00Z", "2026-10-01T10:00:00Z", "2026-10-01T13:00:00+03:00"]) {
    const invalid = closingSchema.safeParse({ ...rowDefaults, startsAt: null, closesAt })
    assert.equal(invalid.success, false, "Closing must be after the current opening time, even if row defaults are stale")
    if (!invalid.success) assert.ok(invalid.error.issues.some((issue) => issue.path[0] === "closesAt" && issue.message === "invalidSchedule"))
  }
  const openingSchema = createFormSettingSchema("startsAt", schedule)
  for (const startsAt of ["2026-10-01T12:00:00Z", "2026-10-02T00:00:00Z"]) {
    const invalid = openingSchema.safeParse({ ...rowDefaults, startsAt, closesAt: null })
    assert.equal(invalid.success, false)
    if (!invalid.success) assert.ok(invalid.error.issues.some((issue) => issue.path[0] === "startsAt" && issue.message === "invalidSchedule"))
  }
  assert.equal(closingSchema.safeParse({ ...rowDefaults, closesAt: "2026-10-01T10:01:00Z" }).success, true)
  assert.equal(closingSchema.safeParse({ ...rowDefaults, closesAt: null }).success, true)
  assert.equal(openingSchema.safeParse({ ...rowDefaults, startsAt: null }).success, true)
  assert.equal(createFormSettingSchema("closesAt", { startsAt: null, closesAt: null }).safeParse({ ...rowDefaults, closesAt: "2026-10-01T09:00:00Z" }).success, true)
  assert.equal(isFormScheduleValid({ startsAt: schedule.startsAt, closesAt: schedule.startsAt }), false)
  assert.equal(isFormScheduleValid({ startsAt: null, closesAt: schedule.closesAt }), true)
  console.info("PASS immediate client date validation for both fields, current selected bounds, equal instants, timezone offsets, and clearing dates")
  const renderSettings = (settings = savedSettings) => {
    const queryClient = new QueryClient()
    const router = createMemoryRouter([{
      id: "root", path: "/", element: createElement(FormSettingsEditor, { formId: form.id, settings }),
    }], { hydrationData: { loaderData: { root: { locale: i18n.language, formatPreference: "eu" } } } })
    try {
      return renderToStaticMarkup(createElement(I18nextProvider, { i18n },
        createElement(QueryClientProvider, { client: queryClient },
          createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: createElement(RouterProvider, { router }) }),
        ),
      ))
    } finally {
      router.dispose()
      queryClient.clear()
    }
  }
  const settingsHtml = renderSettings()
  for (const text of ["Responses", "Availability", "Submission", "Presentation", "Collect email addresses", "One response per email", "Accept responses", "Opens at", "Closes at", "Submit button text", "Thank-you message", "Redirect after submission", "Theme", "Accent color"]) assert.ok(settingsHtml.includes(text), `Missing setting: ${text}`)
  assert.equal(settingsHtml.includes('type="time"'), false)
  const openingTime = settingsHtml.match(/<button\b[^>]*aria-label="Opening time"[^>]*>/)?.[0]
  assert.ok(openingTime)
  assert.ok(openingTime.includes('role="combobox"'))
  assert.ok(openingTime.includes('data-disabled=""'))
  assert.ok(settingsHtml.includes("Send feedback"))
  assert.ok(settingsHtml.toLowerCase().includes("novalidate"))
  assert.ok(settingsHtml.includes("Publish your form to enable availability settings."))
  assert.equal(settingsHtml.includes('type="url"'), false)
  assert.equal(settingsHtml.includes('data-align="inline-start"'), false)
  assert.ok(settingsHtml.includes('data-align="inline-end"'))
  assert.ok(settingsHtml.includes('aria-label="Clear redirect URL"'))
  assert.ok(settingsHtml.includes("https://"))
  const redirectInput = settingsHtml.match(/<input\b[^>]*name="redirectUrl"[^>]*>/)?.[0]
  assert.ok(redirectInput)
  assert.ok(redirectInput.includes('type="text"'))
  assert.equal(redirectInput.includes('aria-invalid="true"'), false)
  const redirectSettingsHtml = renderSettings({ ...savedSettings, redirectUrl: "https://example.com/thanks" })
  assert.ok(redirectSettingsHtml.includes('value="https://example.com/thanks"'))
  const availabilityForm = settingsHtml.match(/<form\b[^>]*>[\s\S]*?<\/form>/g)?.find((markup) => markup.includes('name="status"'))
  const availabilitySwitch = availabilityForm?.match(/<[a-z]+\b[^>]*role="switch"[^>]*>/)?.[0]
  assert.ok(availabilitySwitch)
  assert.ok(availabilitySwitch.includes('data-disabled=""'))
  await i18n.changeLanguage("fi")
  const finnishSettings = renderSettings()
  for (const text of ["Vastaukset", "Saatavuus", "Lähetys", "Ulkoasu", "Kerää sähköpostiosoitteet", "Kiitosviesti", "Korostusväri"]) assert.ok(finnishSettings.includes(text), `Missing Finnish setting: ${text}`)
  await i18n.changeLanguage("en")
  console.info("PASS all settings controls render with English/Finnish labels and native validation disabled")
  const published = await caller.forms.publish({ id: form.id, revision: savedSettings.draftRevision })
  const publishedSettings = await caller.forms.settings.get({ id: form.id })
  assert.equal(publishedSettings.isPublished, true)
  assert.equal(renderSettings(publishedSettings).includes("Publish your form to enable availability settings."), false)
  const response = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const html = await response.text()
  assert.ok(html.includes("<title>Public runtime test</title>"))
  for (const text of ["Public runtime test", "Tell us about your visit.", "Your name", "Pick a size", "Small", "Large", "Choose services", "Cleaning", "Repairs", "Email address"]) assert.ok(html.includes(text), `Missing public markup: ${text}`)
  assert.ok(html.includes('type="checkbox"'))
  assert.ok(html.indexOf("<h1") < html.indexOf("Your name"))
  assert.ok(html.indexOf("Tell us about your visit.") < html.indexOf("Email address"))
  assert.ok(html.indexOf("Email address") < html.indexOf("Your name"))
  assert.ok(html.includes('aria-required="true"'))
  assert.ok(html.includes("Send feedback"))
  assert.ok(html.includes("form-theme-light"))
  assert.ok(html.includes("--primary:#facc15"))
  assert.ok(html.includes("--primary-foreground:#713f12"))
  assert.ok(html.match(/<html\b[^>]*>/)?.[0].includes("background-color:#ffffff"), "Light public forms must have a white HTML background")
  assert.ok(html.includes('<meta name="theme-color" content="#fffcf3"'), "Chrome theme color must match the light form's top gradient tint")
  assert.ok(html.toLowerCase().includes("novalidate"))
  assert.equal(html.includes("Sign in"), false)
  console.info("PASS unauthenticated public SSR with existing styled inputs, choices, email, and no native form validation")
  const namedUrl = await handler(new Request(`http://localhost:5174/f/${form.slug}`, { headers: { "accept-language": "en" } }))
  assert.equal(namedUrl.status, 404)
  const missingHtml = await namedUrl.text()
  assert.ok(missingHtml.includes("<title>Form not found</title>"))
  assert.ok(missingHtml.includes("Please check the link."))
  assert.equal(missingHtml.includes("radial-gradient("), false, "Missing forms must use a plain background")
  assert.ok(missingHtml.includes('<meta name="theme-color" content="#ffffff"'), "Unavailable forms must use the plain background for Chrome's theme color")
  assert.equal(missingHtml.includes("This form is unavailable"), false)
  const missingFinnish = await handler(new Request(`http://localhost:5174/f/missing-${suffix}`, { headers: { "accept-language": "fi" } }))
  assert.equal(missingFinnish.status, 404)
  const missingFinnishHtml = await missingFinnish.text()
  assert.ok(missingFinnishHtml.includes("<title>Lomaketta ei löytynyt</title>"))
  assert.ok(missingFinnishHtml.includes("Tarkista linkki."))
  console.info("PASS published browser title and localized unknown-ID errors")
  await prisma.form.update({ where: { id: form.id }, data: { slug: `renamed-${suffix}` } })
  const stableUrl = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(stableUrl.status, 200)
  assert.ok((await stableUrl.text()).includes("Your name"))
  console.info("PASS public URLs use form IDs and remain stable when a name-based slug changes")
  const snapshot = (await caller.publicForms.get({ id: form.id })).snapshot
  for (const color of [...formAccentColors.map((item) => item.color), "#ef4444", "#f97316", "#22c55e", "#8b5cf6", "#ec4899", "#ffffff", "#888888", "#ffaabb", "#000000"]) {
    const foreground = formAccentForeground(color)
    assert.ok(contrastRatio(color, foreground) >= 4.5, `${color} / ${foreground} must keep button text readable`)
    assert.notEqual(foreground, "#000000", "Light accents should use a matching ink instead of pure black")
    for (const theme of ["LIGHT", "DARK"] as const) {
      const coloredForm = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PublicForm, {
        snapshot: { ...snapshot, appearance: { ...snapshot.appearance, theme, accentColor: color } },
        preview: true, submitFn: async () => undefined,
      })))
      assert.ok(coloredForm.includes(`--primary-foreground:${foreground}`))
    }
  }
  console.info("PASS Blackberry default in English/Finnish and readable button text for all fruit presets and saved custom colors in both themes")
  const previewHtml = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PublicForm, {
    snapshot, preview: true, submitFn: async () => undefined,
  })))
  assert.ok(previewHtml.includes("<h1"))
  assert.ok(previewHtml.includes("Public runtime test"))
  assert.ok(previewHtml.includes("Tell us about your visit."))
  assert.ok(previewHtml.indexOf("<h1") < previewHtml.indexOf("Your name"))
  assert.ok(previewHtml.indexOf("Tell us about your visit.") < previewHtml.indexOf("Email address"))
  assert.ok(previewHtml.indexOf("Email address") < previewHtml.indexOf("Your name"))
  assert.ok(previewHtml.includes("Send feedback"))
  for (const mode of ["NONE", "OPTIONAL"] as const) {
    const variantHtml = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PublicForm, {
      snapshot: { ...snapshot, settings: { ...snapshot.settings, emailCollection: mode, limitOneResponsePerEmail: false } },
      preview: true, submitFn: async () => undefined,
    })))
    assert.equal(variantHtml.includes('type="email"'), mode === "OPTIONAL")
    assert.equal(variantHtml.includes('aria-required="true"'), false)
    if (mode === "OPTIONAL") assert.ok(variantHtml.includes("Optional"))
  }
  const darkHtml = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PublicForm, {
    snapshot: { ...snapshot, appearance: { ...snapshot.appearance, theme: "DARK", accentColor: "#2563eb" } },
    preview: true, submitFn: async () => undefined,
  })))
  assert.ok(darkHtml.includes("dark scheme-dark"))
  assert.ok(darkHtml.includes("--primary-foreground:#ffffff"))
  assert.equal(darkHtml.includes("form-theme-light"), false, "Dark forms must not force light tokens on the card or its fields")
  const darkCard = darkHtml.match(/<div\b[^>]*data-slot="card"[^>]*>/)?.[0]
  assert.ok(darkCard?.includes("bg-card"), "Form cards must follow the form's surface color")
  assert.ok(darkCard?.includes("text-card-foreground"), "Card text must follow the form's theme")
  assert.equal(darkCard?.includes("bg-white"), false, "Dark form cards must not have a forced white background")
  console.info("PASS preview/public email placement, required/optional/hidden email fields, submit text, themes and accent contrast")

  await caller.forms.settings.update({ id: form.id, settings: { emailCollection: "OPTIONAL", submitButtonText: "Send now", theme: "DARK", accentColor: "#2563eb" } })
  const liveResponse = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(liveResponse.status, 200)
  const liveHtml = await liveResponse.text()
  assert.ok(liveHtml.includes("Send now"))
  assert.ok(liveHtml.includes("dark scheme-dark"))
  assert.ok(liveHtml.includes("--primary:#2563eb"))
  const publicHtml = liveHtml.match(/<html\b[^>]*>/)?.[0]
  assert.ok(publicHtml?.includes("background-color:#161616"), "Public HTML background must follow the dark form even when the app theme is light")
  assert.ok(publicHtml?.includes("color-scheme:dark"))
  assert.equal(liveHtml.match(/<body\b[^>]*>/)?.[0].includes("background-color:"), false, "Form background must be set on HTML, not body")
  assert.ok(liveHtml.includes('<meta name="theme-color" content="#181e2b"'), "Chrome theme color must use the dark form's top gradient tint")
  assert.ok(liveHtml.includes("linear-gradient(to bottom, #181e2b, transparent 96px)"), "The gradient's top edge must match Chrome's tint")
  assert.ok(liveHtml.includes("Optional"))
  assert.equal(liveHtml.includes('aria-required="true"'), false)
  assert.equal((await caller.publicForms.get({ id: form.id })).versionId, published.versionId)
  const previewDraft = await caller.forms.get({ id: form.id })
  const actualPreview = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(FormPreview, { draft: previewDraft })))
  assert.ok(actualPreview.includes("dark scheme-dark"))
  assert.ok(actualPreview.includes("--primary:#2563eb"))
  assert.ok(actualPreview.includes("min-h-full"))
  const previewScrollRoot = actualPreview.match(/<div\b[^>]*class="[^"]*absolute inset-0[^"]*"[^>]*>/)?.[0]
  assert.ok(previewScrollRoot, "Preview scroll container should render")
  assert.ok(previewScrollRoot.includes("dark scheme-dark"), "Scroll fades must reveal the form's dark background")
  assert.ok(previewScrollRoot.includes("bg-background"))
  const lightPreview = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(FormPreview, {
    draft: { ...previewDraft, appearance: { ...previewDraft.appearance, theme: "LIGHT" } },
  })))
  const lightScrollRoot = lightPreview.match(/<div\b[^>]*class="[^"]*absolute inset-0[^"]*"[^>]*>/)?.[0]
  assert.ok(lightScrollRoot?.includes("form-theme-light scheme-light"), "Light preview fades should follow the form even in a dark editor")
  const cssFiles = (await readdir(new URL("../build/client/assets/", import.meta.url))).filter((file) => file.endsWith(".css"))
  const compiledCss = (await Promise.all(cssFiles.map((file) => readFile(new URL(`../build/client/assets/${file}`, import.meta.url), "utf8")))).join("\n")
  for (const declaration of [
    /\.bg-primary(?:,[^{]*)?\s*\{[^}]*background-color:\s*var\(--primary\)/,
    /\.bg-background(?:,[^{]*)?\s*\{[^}]*background-color:\s*var\(--background\)/,
    /\.text-foreground\s*\{[^}]*color:\s*var\(--foreground\)/,
  ]) assert.match(compiledCss, declaration, "Presentation utilities must resolve the form's local color variables")
  console.info("PASS actual editor preview uses saved presentation settings and compiled CSS resolves nested form colors")
  await caller.forms.settings.update({ id: form.id, settings: { emailCollection: "REQUIRED", limitOneResponsePerEmail: true } })
  console.info("PASS public HTTP settings change immediately without publishing a new question version")

  // Exercise the actual HTTP transport and formatter, not just direct router calls.
  const submit = async (values: Record<string, string | string[]>) => {
    const result = await handler(new Request("http://localhost:5174/api/trpc/publicForms.submit", {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": "en" },
      body: JSON.stringify({ json: { id: form.id, versionId: published.versionId, values } }),
    }))
    return { status: result.status, body: await result.json() }
  }
  const values = { respondentEmail: "runtime@example.com", [itemId]: "Olli", [choiceId]: "size-small", [`${choiceId}:other`]: "", [multiId]: ["cleaning", "repairs"], [`${multiId}:other`]: "" }
  await caller.forms.settings.update({ id: form.id, settings: { status: false } })
  const disabled = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(disabled.status, 404)
  const disabledHtml = await disabled.text()
  assert.ok(disabledHtml.includes("This form is unavailable"))
  assert.equal(disabledHtml.includes("radial-gradient("), false, "Disabled forms must use a plain background")
  assert.equal(disabledHtml.includes("Your name"), false)
  assert.equal((await submit(values)).status, 404)
  assert.equal(await prisma.formSubmission.count({ where: { formId: form.id } }), 0)
  await caller.forms.settings.update({ id: form.id, settings: { status: true } })
  const reenabled = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(reenabled.status, 200)
  assert.ok((await reenabled.text()).includes("Your name"))
  console.info("PASS live settings disable and re-enable public HTTP rendering and submissions")
  const invalid = await submit({ ...values, [itemId]: "" })
  assert.equal(invalid.status, 400)
  assert.ok(invalid.body.error.json.data.zodError.fieldErrors[itemId])
  const invalidMulti = await submit({ ...values, [multiId]: [] })
  assert.equal(invalidMulti.status, 400)
  assert.ok(invalidMulti.body.error.json.data.zodError.fieldErrors[multiId])
  const valid = await submit(values)
  assert.equal(valid.status, 200)
  assert.ok(valid.body.result.data.json.submissionId)
  const duplicate = await submit(values)
  assert.equal(duplicate.status, 400)
  assert.deepEqual(duplicate.body.error.json.data.zodError.fieldErrors.respondentEmail, ["A response has already been sent with this email address."])
  console.info("PASS public HTTP submissions and field-level validation/deduplication error formatting")

  await prisma.form.update({ where: { id: form.id }, data: { status: "CLOSED" } })
  const closed = await handler(new Request(`http://localhost:5174/f/${form.id}`, { headers: { "accept-language": "en" } }))
  assert.equal(closed.status, 404)
  const closedHtml = await closed.text()
  assert.ok(closedHtml.includes("This form is unavailable"))
  assert.equal(closedHtml.includes("radial-gradient("), false, "Closed forms must use a plain background")
  assert.equal(closedHtml.includes("Your name"), false)
  console.info("PASS closed forms render the coss availability state without draft or published questions")
} finally {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
  await prisma.$disconnect()
  await vite.close()
}

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = hex.match(/[\da-f]{2}/gi)!.map((channel) => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const light = Math.max(luminance(first), luminance(second))
  const dark = Math.min(luminance(first), luminance(second))
  return (light + 0.05) / (dark + 0.05)
}
