import type { FormItem } from "~/lib/forms/form-types"

export function TextBlock({ item }: { item: FormItem }) {
  if (!item.label && !item.description) return null

  return (
    <section aria-label={item.label || undefined} className="space-y-2">
      {item.label ? <h2 className="text-xl font-semibold tracking-tight text-foreground">{item.label}</h2> : null}
      {item.description ? <p className="whitespace-pre-wrap text-base leading-6 text-muted-foreground">{item.description}</p> : null}
    </section>
  )
}
