import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Combobox, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxTrigger, ComboboxValue } from "~/components/ui/combobox"
import { SelectButton } from "~/components/ui/select"

type ServiceOption = { id: string; name: string; durationMinutes: number }

export function ServicePicker({ services, value, onChange, disabled }: {
  services: ServiceOption[]
  value: string
  onChange: (id: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const items = useMemo(() => services.map((service) => ({ ...service, label: service.name })), [services])

  return <Combobox
    disabled={disabled}
    items={items}
    itemToStringLabel={(item) => item.name}
    isItemEqualToValue={(item, selected) => item.id === selected.id}
    onValueChange={(item) => onChange(item?.id ?? "")}
    value={items.find((item) => item.id === value) ?? null}
  >
    <ComboboxTrigger render={<SelectButton className="w-full" type="button" />}>
      <ComboboxValue>{(item: ServiceOption | null) => item?.name ?? <span className="text-muted-foreground/72">{t("bookingForm.chooseService")}</span>}</ComboboxValue>
    </ComboboxTrigger>
    <ComboboxPopup aria-label={t("bookingForm.chooseService")}>
      <div className="border-b p-2"><ComboboxInput aria-label={t("bookingForm.searchServices")} placeholder={t("bookingForm.searchServices")} showTrigger={false} startAddon={<Icon aria-hidden={true} name="search" />} /></div>
      <ComboboxEmpty className="flex min-h-32 items-center justify-center empty:hidden">{t("bookingForm.noServiceMatches")}</ComboboxEmpty>
      <ComboboxList>{(item: (typeof items)[number]) => <ComboboxItem className="min-h-8 sm:min-h-8 [&>div]:min-w-0" key={item.id} value={item}>
        <span className="flex min-w-0 items-center justify-between gap-4"><span className="truncate">{item.name}</span><span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{t("bookingForm.duration", { minutes: item.durationMinutes })}</span></span>
      </ComboboxItem>}</ComboboxList>
    </ComboboxPopup>
  </Combobox>
}
