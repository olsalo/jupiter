"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@coss/ui/lib/utils";
import type React from "react";

export function ScrollArea({
  className,
  children,
  scrollFade = false,
  stickyHeader,
  scrollbarGutter = false,
  scrollbarClassName,
  fill = false,
  clampContentMinWidth = true,
  viewportProps,
  onWheel,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  scrollFade?: boolean;
  stickyHeader?: React.ReactNode
  scrollbarGutter?: boolean;
  scrollbarClassName?: string;
  fill?: boolean;
  clampContentMinWidth?: boolean;
  viewportProps?: ScrollAreaPrimitive.Viewport.Props;
}): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        stickyHeader
          ? "relative flex w-full min-h-0 flex-1 flex-col"
          : "size-full min-h-0",
        className,
      )}
      onWheel={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) {
          return
        }

        onWheel?.(event)

        if (event.defaultPrevented) {
          return
        }

        const viewport = event.currentTarget.querySelector<HTMLElement>(
          '[data-slot="scroll-area-viewport"]',
        )

        if (!viewport || viewport.contains(event.target as Node)) {
          return
        }

        const deltaMultiplier =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? viewport.clientHeight
              : 1
        const nextScrollTop = Math.max(
          0,
          Math.min(
            viewport.scrollHeight - viewport.clientHeight,
            viewport.scrollTop + event.deltaY * deltaMultiplier,
          ),
        )
        const nextScrollLeft = Math.max(
          0,
          Math.min(
            viewport.scrollWidth - viewport.clientWidth,
            viewport.scrollLeft + event.deltaX * deltaMultiplier,
          ),
        )

        if (
          nextScrollTop !== viewport.scrollTop ||
          nextScrollLeft !== viewport.scrollLeft
        ) {
          event.preventDefault()
          viewport.scrollTop = nextScrollTop
          viewport.scrollLeft = nextScrollLeft
        }
      }}
      {...props}
    >
      {stickyHeader ? (
        <div className="shrink-0" data-slot="scroll-area-sticky-header">
          {stickyHeader}
        </div>
      ) : null}
      <ScrollAreaPrimitive.Viewport
        {...viewportProps}
        className={cn(
          stickyHeader
            ? "min-h-0 flex-1 overscroll-none rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            : "h-full overscroll-none rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          scrollFade &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
          scrollbarGutter &&
            "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5",
          viewportProps?.className,
        )}
        data-slot="scroll-area-viewport"
      >
        <ScrollAreaPrimitive.Content
          className={cn(fill && "size-full")}
          data-slot="scroll-area-content"
          style={clampContentMinWidth ? { minWidth: 0 } : undefined}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar className={scrollbarClassName} orientation="vertical" />
      <ScrollBar className={scrollbarClassName} orientation="horizontal" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        "m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-foreground/20"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollAreaPrimitive };
