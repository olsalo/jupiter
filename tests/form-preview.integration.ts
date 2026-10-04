import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"
import type { FormEditorDraft, FormItem } from "../app/lib/forms/form-types"

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

try {
  const { FormPreview } = await vite.ssrLoadModule("/app/components/forms/editor/form-preview.tsx") as typeof import("../app/components/forms/editor/form-preview")
  const { TextItemEditor } = await vite.ssrLoadModule("/app/components/forms/editor/items/text-item-editor.tsx") as typeof import("../app/components/forms/editor/items/text-item-editor")
  const { buildFormSnapshot } = await vite.ssrLoadModule("/app/lib/forms/form-snapshot.ts") as typeof import("../app/lib/forms/form-snapshot")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "forms", interpolation: { escapeValue: false } })
  const item: FormItem = {
    id: "item-text", type: "SHORT_TEXT", label: "", description: null,
    placeholder: null, required: true, sortOrder: 0, row: 0, column: 0, width: 12,
    defaultValue: null, validation: null, settings: null, options: [],
  }
  const draft: FormEditorDraft = {
    id: "form-preview", slug: "preview", title: "Feedback", description: null,
    status: "DRAFT", draftRevision: 1, publishedVersion: null,
    settings: {
      submitButtonText: "Send", successMessage: "Thank you", redirectUrl: null,
      emailCollection: "NONE", limitOneResponsePerEmail: false,
      responseLimit: null, startsAt: null, closesAt: null,
    },
    appearance: {
      theme: "LIGHT", accentColor: null, logo: null,
      showProgressBar: false, showQuestionNumbers: false,
    },
    sections: [{ id: "section-preview", title: null, description: null, sortOrder: 0, settings: null, items: [item] }],
    logicRules: [],
  }
  for (const type of ["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE"] as const) {
    const question = {
      ...item, type,
      options: type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"
        ? [{ id: "option-first", kind: "OPTION" as const, label: "First", value: "first", sortOrder: 0 }]
        : [],
    }
    const current = { ...draft, sections: [{ ...draft.sections[0], items: [question] }] }
    assert.equal(buildFormSnapshot(current).sections[0].items[0].label, "")
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(FormPreview, { draft: current })))
    assert.equal(html.includes("Check the form"), false)
    assert.ok(html.includes('id="form-editor-preview"'))
    assert.ok(html.includes('class="sr-only">Question</span>'))
    if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") assert.ok(html.includes('aria-label="Question"'))
  }
  for (const description of [null, "Tell us more"]) {
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(TextItemEditor, {
      item: { ...item, description }, formId: draft.id,
      onChange: () => undefined, onTypeChange: () => undefined,
      onDelete: () => undefined, onDuplicate: () => undefined,
    })))
    assert.ok(html.includes("Add description"))
    assert.equal(html.includes('name="description"'), Boolean(description))
    assert.equal(html.includes("min-h-40"), false)
  }
  console.info("PASS blank text and choice questions render in preview with accessible labels, and hidden descriptions keep cards compact")
} finally {
  await vite.close()
}
