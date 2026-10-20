import { useState, type Ref } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Checkbox } from "~/components/ui/checkbox"
import { CheckboxGroup } from "~/components/ui/checkbox-group"
import { FieldItem } from "~/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Label } from "~/components/ui/label"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

export function ServiceSelection({ services, value, onChange, onBlur, inputRef, disabled, invalid, label, className }: {
  services: { id: string; name: string; durationMinutes: number }[]
  value: string[]
  onChange: (value: string[]) => void
  onBlur: () => void
  inputRef: Ref<HTMLInputElement>
  disabled: boolean
  invalid: boolean
  label: string
  className?: string
}) {
  const { t } = useTranslation("services")
  const [search, setSearch] = useState("")
  const term = search.trim().toLocaleLowerCase()
  const filtered = services.filter((service) => service.name.toLocaleLowerCase().includes(term))
  const filteredIds = new Set(filtered.map((service) => service.id))
  const selectedCount = value.filter((id) => filteredIds.has(id)).length
  const allSelected = filtered.length > 0 && selectedCount === filtered.length

  return <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border", invalid && "border-destructive/64", className)}>
    <div className="shrink-0 p-3"><InputGroup><InputGroupInput aria-label={t("searchServices")} aria-invalid={invalid} disabled={disabled} nativeInput={true} onBlur={onBlur} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchServices")} ref={inputRef} type="search" value={search} /><InputGroupAddon><Icon aria-hidden={true} name="search" size={16} /></InputGroupAddon></InputGroup></div>
    <ScrollArea className="h-auto min-h-0 flex-1" fill={filtered.length === 0} overscrollContain={true} scrollFade={true}>
    <CheckboxGroup aria-label={label} aria-invalid={invalid} className={cn("items-stretch gap-2 p-2", filtered.length === 0 && "h-full justify-center")} value={value} onValueChange={onChange}>
      {filtered.length ? filtered.map((service) => <FieldItem className="w-full" key={service.id}><Label className="flex h-11 w-full cursor-pointer gap-3 rounded-md px-2 py-2 font-normal hover:bg-muted/60 has-data-checked:bg-muted/60">
        <Checkbox aria-invalid={invalid} disabled={disabled} onBlur={onBlur} value={service.id} />
        <span className="min-w-0 flex-1 truncate text-sm" title={service.name}>{service.name}</span><span className="shrink-0 text-xs text-muted-foreground">{service.durationMinutes} {t("minutes")}</span>
      </Label></FieldItem>) : <p className="px-3 py-10 text-center text-sm text-muted-foreground">{t(term ? "noServiceMatches" : "empty")}</p>}
    </CheckboxGroup>
    </ScrollArea>
    {services.length > 0 ? <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3">
      <FieldItem className="shrink-0"><Label className="cursor-pointer gap-3 text-xs font-normal">
        <Checkbox checked={allSelected} disabled={disabled || filtered.length === 0} indeterminate={selectedCount > 0 && !allSelected} onBlur={onBlur} onCheckedChange={(checked) => onChange(checked ? [...new Set([...value, ...filteredIds])] : value.filter((id) => !filteredIds.has(id)))} />
        {t("selectAllServices")}
      </Label></FieldItem>
      <p className="text-right text-xs text-muted-foreground" role="status">{t("selectedServices", { count: value.length })}</p>
    </div> : null}
  </div>
}
