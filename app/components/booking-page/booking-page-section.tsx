import { useId, type ReactNode } from "react"

export function BookingPageSection({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  const titleId = useId()

  return <section aria-labelledby={titleId} className="grid min-w-0 gap-7 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:py-8 xl:gap-24">
    <div className="min-w-0 space-y-1.5">
      <h2 className="text-sm font-semibold" id={titleId}>{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-5">{children}</div>
  </section>
}
