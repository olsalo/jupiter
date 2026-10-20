import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useEffect, useState, type Ref } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertAction, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Combobox, ComboboxInput, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxTrigger, ComboboxValue } from "~/components/ui/combobox"
import { SelectButton } from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { calendarPanelQueryOptions } from "~/lib/calendar/query-options"
import { useDebouncedValue } from "~/lib/use-debounced-value"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"

const newCustomerValue = "__new_customer__"
export type CustomerOption = { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null }
type CustomerPickerItem = { value: string; label: string; detail: string }

export function CustomerPicker({ value, onChange, onBlur, inputRef, invalid, disabled, onCreate, selectedCustomer, onCustomerChange }: {
  value: string
  selectedCustomer?: CustomerOption
  onCustomerChange?: (customer: CustomerOption | null) => void
  onChange: (id: string) => void
  onBlur: () => void
  inputRef: Ref<HTMLButtonElement>
  invalid: boolean
  disabled: boolean
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [pickedCustomer, setPickedCustomer] = useState<CustomerOption | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())
  const customers = useInfiniteQuery({
    ...trpc.customer.list.infiniteQueryOptions({ limit: 50, search: debouncedSearch || undefined }, { getNextPageParam: (page) => page.nextCursor }),
    ...calendarPanelQueryOptions,
    enabled: open && search.trim() === debouncedSearch,
  })
  const rows = customers.data?.pages.flatMap((page) => page.items) ?? []
  const knownCustomer = rows.find((customer) => customer.id === value) ?? (selectedCustomer?.id === value ? selectedCustomer : undefined) ?? (pickedCustomer?.id === value ? pickedCustomer : undefined)
  const selected = useQuery({ ...trpc.customer.get.queryOptions({ id: value }), ...calendarPanelQueryOptions, enabled: Boolean(value) && !knownCustomer })
  const toItem = (customer: CustomerOption) => ({
    value: customer.id,
    label: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
    detail: customer.phone?.trim() || customer.email?.trim() || "",
  })
  const items = [...rows.map(toItem), { value: newCustomerValue, label: t("bookingForm.newCustomer"), detail: "" }]
  const selectedItem = knownCustomer ?? selected.data
  useEffect(() => {
    onCustomerChange?.(selectedItem ?? null)
  }, [selectedItem, onCustomerChange])

  return <Combobox
    disabled={disabled}
    filter={null}
    inputValue={search}
    items={items}
    itemToStringLabel={(item) => item.label}
    isItemEqualToValue={(item, selectedValue) => item.value === selectedValue.value}
    onInputValueChange={setSearch}
    onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setSearch("") }}
    onValueChange={(item) => {
      if (item?.value === newCustomerValue) {
        setOpen(false)
        onCreate()
      } else {
        setPickedCustomer(rows.find((customer) => customer.id === item?.value) ?? null)
        onChange(item?.value ?? "")
      }
    }}
    open={open}
    value={selectedItem ? toItem(selectedItem) : null}
  >
    <ComboboxTrigger aria-invalid={invalid} onBlur={onBlur} ref={inputRef} render={<SelectButton className="h-auto w-full py-1 text-start" type="button" />}>
      <ComboboxValue placeholder={t("bookingForm.chooseCustomer")}>{(item: CustomerPickerItem | null) => item ? <CustomerPickerLabel item={item} /> : t("bookingForm.chooseCustomer")}</ComboboxValue>
    </ComboboxTrigger>
    <ComboboxPopup aria-label={t("bookingForm.chooseCustomer")} onScrollCapture={(event) => {
      const viewport = event.target as HTMLElement
      if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80 && customers.hasNextPage && !customers.isFetching) void customers.fetchNextPage()
    }}>
      <div className="border-b p-2"><ComboboxInput aria-label={t("bookingForm.searchCustomers")} placeholder={t("bookingForm.searchCustomers")} showTrigger={false} startAddon={<Icon aria-hidden={true} name="search" />} /></div>
      {customers.isPending ? <div className="flex min-h-32 w-full items-center justify-center p-4"><Spinner aria-label={t("loading")} /></div> : customers.isError ? <Alert className="m-2" variant="error"><AlertTitle>{t("bookingForm.customersLoadError")}</AlertTitle><AlertAction><Button disabled={customers.isFetching} onClick={() => void customers.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : !rows.length ? <p className="flex min-h-32 w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{t("bookingForm.noCustomerMatches")}</p> : null}
      <ComboboxList>{(item: (typeof items)[number]) => <ComboboxItem className={cn("min-h-8 sm:min-h-8", item.value === newCustomerValue && "mt-1 border-t border-border pt-2")} key={item.value} value={item}>
        {item.value === newCustomerValue ? <span className="flex items-center gap-2"><Icon aria-hidden={true} name="plus" size={16} />{item.label}</span> : <CustomerPickerLabel item={item} />}
      </ComboboxItem>}</ComboboxList>
      {customers.isFetchingNextPage ? <div className="flex justify-center p-2"><Spinner aria-label={t("loading")} /></div> : null}
    </ComboboxPopup>
  </Combobox>
}

function CustomerPickerLabel({ item }: { item: CustomerPickerItem }) {
  return <span className="flex min-w-0 items-center gap-2">
    <span className="truncate">{item.label}</span>
    {item.detail ? <span className="truncate text-xs text-muted-foreground">{item.detail}</span> : null}
  </span>
}
