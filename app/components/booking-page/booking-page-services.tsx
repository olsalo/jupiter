import { Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { DragDropProvider, PointerSensor } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"
import { useRef, type Ref } from "react"
import FormLabel from "~/components/forms/form-label"
import { SortableBookingPageChoice } from "./sortable-booking-page-choice"

export function BookingPageServices({ label, description, items, value, hiddenServiceIds, onChange, onHiddenServiceIdsChange, onBlur, inputRef, error, disabled }: {
  label: string
  description: string
  items: { id: string; name: string }[]
  value: string[]
  hiddenServiceIds: string[]
  onChange: (value: string[]) => void
  onHiddenServiceIdsChange: (value: string[]) => void
  onBlur: () => void
  inputRef: Ref<HTMLButtonElement>
  error?: string | null
  disabled: boolean
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const orderedItems = value.flatMap((id) => itemsById.has(id) ? [itemsById.get(id)!] : [])

  return <FormLabel label={label} description={description} error={error}>
    {orderedItems.length > 0 ? <DragDropProvider
      sensors={(defaults) => defaults.map((sensor) => sensor === PointerSensor ? PointerSensor.configure({ activationConstraints: (event) => event.pointerType === "touch" ? [new PointerActivationConstraints.Distance({ value: 8 })] : undefined }) : sensor)}
      plugins={(defaults) => [...defaults, Feedback.configure({ dropAnimation: null })]}
      onDragEnd={(event) => {
        if (event.canceled || disabled) return
        const { source } = event.operation
        if (!isSortable(source) || source.initialIndex === source.index) return
        const next = orderedItems.map((item) => item.id)
        const [moved] = next.splice(source.initialIndex, 1)
        if (!moved) return
        next.splice(source.index, 0, moved)
        onChange(next)
      }}
    >
      <ul aria-description={error || undefined} aria-invalid={Boolean(error)} aria-label={label} className="relative isolate z-0 w-full divide-y rounded-lg border aria-invalid:border-destructive" onBlur={onBlur} ref={listRef}>
        {orderedItems.map((item, index) => <SortableBookingPageChoice
          key={item.id}
          id={item.id}
          index={index}
          name={item.name}
          disabled={disabled}
          sortableDisabled={disabled || orderedItems.length < 2}
          containerRef={listRef}
          visible={!hiddenServiceIds.includes(item.id)}
          inputRef={index === 0 ? inputRef : undefined}
          onToggleVisibility={() => onHiddenServiceIdsChange(hiddenServiceIds.includes(item.id) ? hiddenServiceIds.filter((id) => id !== item.id) : [...hiddenServiceIds, item.id])}
        />)}
      </ul>
    </DragDropProvider> : null}
  </FormLabel>
}
