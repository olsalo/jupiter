import { useState, type Ref } from "react"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover"

export const colorPickerPalette = [
  { name: "red", value: "#fa414d" },
  { name: "orange", value: "#f97b28" },
  { name: "yellow", value: "#ffb81c" },
  { name: "purple", value: "#8f49b5" },
  { name: "blue", value: "#1d6bc0" },
  { name: "beige", value: "#c4a77d" },
  { name: "gray", value: "#98a09e" },
  { name: "teal", value: "#30968d" },
  { name: "green", value: "#329631" },
] as const

export function ColorPicker({ value, onChange, onBlur, name, label, colors, disabled = false, invalid = false, ref }: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  name: string
  label: string
  colors: { value: string; label: string }[]
  disabled?: boolean
  invalid?: boolean
  ref?: Ref<HTMLButtonElement>
}) {
  const [open, setOpen] = useState(false)
  const selected = colors.find((color) => color.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input name={name} type="hidden" value={value} />
      <PopoverTrigger
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-invalid={invalid}
        disabled={disabled}
        onBlur={onBlur}
        ref={ref}
        render={<Button className="w-[3.25rem] gap-1.5 px-2" type="button" variant="outline" />}
      >
        <span aria-hidden={true} className="size-4 shrink-0 rounded-full" style={{ backgroundColor: value }} />
        <Icon aria-hidden={true} className="size-3!" name={open ? "chevronUp" : "chevronDown"} />
      </PopoverTrigger>
      <PopoverPopup align="end" aria-label={label} className="[&_[data-slot=popover-viewport]]:p-2" sideOffset={4}>
        <PopoverTitle className="sr-only">{label}</PopoverTitle>
        <div aria-label={label} className="grid grid-cols-5 gap-1" role="group">
          {colors.map((color) => (
            <Button
              aria-label={color.label}
              aria-pressed={color.value === value}
              className="size-7! rounded-full p-1 before:hidden hover:bg-transparent focus-visible:ring-offset-0"
              disabled={disabled}
              key={color.value}
              onClick={() => { onChange(color.value); setOpen(false) }}
              style={color.value === value ? { boxShadow: "inset 0 0 0 1.5px var(--foreground)" } : undefined}
              type="button"
              variant="ghost"
            >
              <span aria-hidden={true} className="size-5 shrink-0 rounded-full" style={{ backgroundColor: color.value }} />
            </Button>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  )
}
