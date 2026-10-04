const focusableSelector = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[contenteditable=\"true\"]",
  "[tabindex]",
].join(",")

const formFocusableSelector = [
  "input:not([type=\"hidden\"])",
  "select",
  "textarea",
  "[contenteditable=\"true\"]",
].join(",")

const optInSelector = ".keyboard-focusable, #keyboard-focusable"
const originalTabIndexAttribute = "data-pluto-original-tabindex"

export function restrictKeyboardFocus() {
  const update = (root: ParentNode) => {
    const elements = [
      ...(root instanceof HTMLElement && root.matches(focusableSelector)
        ? [root]
        : []),
      ...root.querySelectorAll<HTMLElement>(focusableSelector),
    ]

    elements.forEach((element) => {
      const isFormControl = element.matches(formFocusableSelector)
      const isFormButton =
        element.matches("button") && element.closest("form") !== null
      const isOptedIn = element.matches(optInSelector)

      if (isFormControl || isFormButton || isOptedIn) {
        return
      }

      if (!element.hasAttribute(originalTabIndexAttribute)) {
        element.setAttribute(
          originalTabIndexAttribute,
          element.getAttribute("tabindex") ?? "",
        )
      }

      element.tabIndex = -1
    })
  }

  update(document)

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          update(node)
        }
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    observer.disconnect()

    document
      .querySelectorAll<HTMLElement>(`[${originalTabIndexAttribute}]`)
      .forEach((element) => {
        const originalTabIndex = element.getAttribute(originalTabIndexAttribute)

        if (originalTabIndex) {
          element.setAttribute("tabindex", originalTabIndex)
        } else {
          element.removeAttribute("tabindex")
        }

        element.removeAttribute(originalTabIndexAttribute)
      })
  }
}
