import { cn } from "~/lib/utils"

export function PageBottomFade({ variant, pathname }: { variant: "classic" | "floating"; pathname: string }) {
  const floating = variant === "floating"

  return <div
    aria-hidden={true}
    className={cn(
      "pointer-events-none inset-x-0 bottom-0 z-10 bg-linear-to-t from-background/75 from-50% to-transparent transition-opacity duration-150 motion-reduce:transition-none md:in-data-[page-layout=viewport-desktop]:hidden",
      floating
        ? "fixed h-[calc(112px+env(safe-area-inset-bottom))] md:h-8 md:in-data-[page-layout=viewport]:hidden"
        : "absolute h-8 in-data-[page-layout=viewport]:hidden",
      pathname === "/booking-page" && (floating ? "md:h-14 from-background from-20%" : "h-14 from-background from-20%"),
    )}
    data-slot="page-bottom-fade"
  />
}
