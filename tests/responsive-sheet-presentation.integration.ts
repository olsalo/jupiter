import assert from "node:assert/strict"
import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
try {
  const { DrawerBackdrop, DrawerViewport } = await vite.ssrLoadModule("/app/components/ui/drawer.tsx") as typeof import("../app/components/ui/drawer")
  const { ResponsiveModal, ResponsiveModalPopup, ResponsiveModalHeader, ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalPanel } = await vite.ssrLoadModule("/app/components/overlays/responsive-modal.tsx") as typeof import("../app/components/overlays/responsive-modal")
  function render(presentation: "drawer" | "sheet" | "dialog") {
    // These presentation wrappers are pure: inspect the props they give Base UI
    // without requiring a browser portal to render during this regression check
    const backdrop = DrawerBackdrop({ presentation })
    const viewport = DrawerViewport({ presentation, position: presentation === "sheet" ? "right" : "bottom", variant: "inset", children: "Form content" })
    return renderToStaticMarkup(createElement("div", null, [
      createElement("div", { ...(backdrop.props as ComponentProps<"div">), key: "backdrop" }),
      createElement("div", { ...(viewport.props as ComponentProps<"div">), key: "viewport" }),
    ]))
  }
  const sheet = render("sheet")
  assert.match(sheet, /data-slot="sheet-viewport"/)
  assert.match(sheet, /data-base-ui-swipe-ignore=""/, "Desktop blocks gestures before they can move the popup or fade the backdrop")
  assert.match(sheet, /justify-end/)
  assert.match(sheet, /sm:p-2/)
  assert.match(sheet, /duration-200/)
  assert.doesNotMatch(sheet, /touch-none|drawer-swipe-progress|drawer-swipe-strength|--bleed|duration-450/)
  const drawer = render("drawer")
  assert.match(drawer, /data-slot="drawer-viewport"/)
  assert.match(drawer, /grid-rows-\[1fr_auto\]/)
  assert.match(drawer, /touch-none/)
  assert.match(drawer, /drawer-swipe-progress/)
  assert.doesNotMatch(drawer, /data-base-ui-swipe-ignore/)
  const dialog = render("dialog")
  assert.match(dialog, /data-slot="dialog-viewport"/)
  assert.match(dialog, /data-slot="dialog-backdrop"/)
  assert.match(dialog, /data-base-ui-swipe-ignore=""/)
  assert.match(dialog, /justify-items-center/)
  assert.match(dialog, /duration-200/)
  assert.doesNotMatch(dialog, /touch-none|drawer-swipe-progress|drawer-swipe-strength|--bleed|duration-450/)
  const modalContent = createElement(ResponsiveModalPopup, { titleId: "modal-title", descriptionId: "modal-description", children: [
    createElement(ResponsiveModalHeader, { key: "header", children: [createElement(ResponsiveModalTitle, { key: "title", id: "modal-title", children: "Category" }), createElement(ResponsiveModalDescription, { key: "description", id: "modal-description", children: "Edit services" })] }),
    createElement(ResponsiveModalPanel, { key: "panel", children: createElement("input", { defaultValue: "Draft category" }) }),
  ] })
  const modal = renderToStaticMarkup(createElement(ResponsiveModal, { open: true, children: modalContent }))
  assert.match(modal, /role="dialog"/)
  assert.match(modal, /aria-labelledby="modal-title"/)
  assert.match(modal, /aria-describedby="modal-description"/)
  assert.match(modal, /value="Draft category"/)
  assert.match(modal, /max-sm:grid-rows-\[1fr_auto\]/)
  assert.equal(renderToStaticMarkup(createElement(ResponsiveModal, { open: false, children: modalContent })), "")
  assert.match(renderToStaticMarkup(createElement(ResponsiveModal, { defaultOpen: true, children: modalContent })), /role="dialog"/)
  console.info("PASS desktop sheets and dialogs block swipe gestures, mobile drawers retain swipe styles, and responsive modals render accessible server markup")
} finally {
  await vite.close()
}
