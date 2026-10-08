import { useLayoutEffect, useRef, useState, type ComponentProps } from "react"

import { DrawerPopup } from "~/components/ui/drawer"
import { cn } from "~/lib/utils"

export function AnimatedDrawerPopup({ children, className, ...props }: Omit<ComponentProps<typeof DrawerPopup>, "ref">) {
  const [popup, setPopup] = useState<HTMLDivElement | null>(null)
  const previousHeight = useRef<number | null>(null)
  const previousFooterHeight = useRef<number | null>(null)

  // Keep the saved height across route rerenders. Reattaching on child changes
  // would measure the new layout during cleanup and erase the starting height.
  useLayoutEffect(() => {
    if (!popup) return

    let animation: Animation | null = null
    let footerAnimation: Animation | null = null
    let resizeFrame: number | null = null
    const observer = new ResizeObserver(() => {
      if (animation || resizeFrame !== null) return
      // Resize observers must not synchronously change the size they observe.
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null
        updateHeight()
      })
    })
    const mutations = new MutationObserver(updateHeight)

    function updateHeight() {
      if (!popup || animation) return

      const nextHeight = popup.getBoundingClientRect().height
      const fromHeight = previousHeight.current
      previousHeight.current = nextHeight
      const footer = popup.querySelector<HTMLElement>('[data-slot="drawer-footer"]')
      const nextFooterHeight = footer?.getBoundingClientRect().height ?? null
      const fromFooterHeight = previousFooterHeight.current
      previousFooterHeight.current = nextFooterHeight
      const footerChanged = fromFooterHeight !== null && nextFooterHeight !== null
        && Math.abs(fromFooterHeight - nextFooterHeight) >= 1

      // Let the drawer own entry, exit, swipe, and nested drawer transitions.
      if (
        fromHeight === null
        || (Math.abs(fromHeight - nextHeight) < 1 && !footerChanged)
        || !popup.hasAttribute("data-open")
        || popup.hasAttribute("data-starting-style")
        || popup.hasAttribute("data-ending-style")
        || popup.hasAttribute("data-swiping")
        || popup.hasAttribute("data-nested-drawer-open")
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) return

      observer.disconnect()
      popup.setAttribute("data-resizing", "")
      animation = popup.animate([
        { height: `${fromHeight}px` },
        { height: `${nextHeight}px` },
      ], { duration: 0, easing: "ease-in-out", fill: "both" })
      if (footer && footerChanged) {
        footerAnimation = footer.animate([
          { height: `${fromFooterHeight}px` },
          { height: `${nextFooterHeight}px` },
        ], { duration: 0, easing: "ease-in-out", fill: "both" })
      }
      animation.onfinish = () => {
        footerAnimation?.cancel()
        footerAnimation = null
        animation?.cancel()
        animation = null
        popup.removeAttribute("data-resizing")
        // Content can change again during the animation. Measure its natural
        // height after releasing the temporary animated height.
        updateHeight()
        if (!animation) observer.observe(popup)
      }
    }

    updateHeight()
    if (!animation) observer.observe(popup)
    // React content changes are measured before paint, so route and form
    // updates start at the previous height without flashing the new size.
    mutations.observe(popup, {
      attributeFilter: ["class", "style", "hidden"],
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      mutations.disconnect()
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
      previousHeight.current = popup.getBoundingClientRect().height
      previousFooterHeight.current = popup.querySelector<HTMLElement>('[data-slot="drawer-footer"]')?.getBoundingClientRect().height ?? null
      footerAnimation?.cancel()
      animation?.cancel()
      popup.removeAttribute("data-resizing")
    }
  }, [popup])

  return (
    <DrawerPopup
      {...props}
      className={cn("data-resizing:overflow-clip **:data-[slot=drawer-footer]:shrink-0 **:data-[slot=drawer-footer]:overflow-clip", className)}
      ref={setPopup}
    >
      {children}
    </DrawerPopup>
  )
}
