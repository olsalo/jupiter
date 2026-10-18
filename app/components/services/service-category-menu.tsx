import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Menu, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "~/components/ui/menu"

export function ServiceCategoryMenu({ categories, totalCount, value, onValueChange, onCreate, canManage, disabled, popupAnchor }: {
  categories: { id: string; name: string; count: number }[]
  totalCount: number
  value: string
  onValueChange: (value: string) => void
  onCreate: () => void
  canManage: boolean
  disabled: boolean
  popupAnchor?: ComponentProps<typeof MenuPopup>["anchor"]
}) {
  const { t } = useTranslation("services")
  const label = categories.find((category) => category.id === value)?.name ?? t("allCategories")
  const count = categories.find((category) => category.id === value)?.count ?? totalCount

  return <Menu>
    <MenuTrigger aria-label={t("categoryFilter", { name: label })} render={<Button className="w-full min-w-0 max-w-full shrink justify-between max-md:flex-1 max-sm:h-9 md:w-auto md:min-w-72" disabled={disabled} size="lg" type="button" variant="outline" />}>
      <span className="flex min-w-0 items-center gap-2"><span className="truncate">{label}</span><Badge className="tabular-nums" size="sm" variant="secondary">{count}</Badge></span><Icon aria-hidden={true} name="chevronDown" size={16} />
    </MenuTrigger>
    <MenuPopup align="end" anchor={popupAnchor} className="w-(--anchor-width) max-w-(--available-width) md:w-max md:min-w-(--anchor-width)" sideOffset={6}>
      <MenuRadioGroup value={value} onValueChange={(next) => { if (typeof next === "string") onValueChange(next) }}>
        <MenuRadioItem className="grid-cols-[.75rem_minmax(0,1fr)] [&>span]:min-w-0" closeOnClick={true} value=""><span className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 truncate">{t("allCategories")}</span><Badge className="tabular-nums" size="sm" variant="secondary">{totalCount}</Badge></span></MenuRadioItem>
        {categories.map((category) => <MenuRadioItem className="grid-cols-[.75rem_minmax(0,1fr)] [&>span]:min-w-0" closeOnClick={true} key={category.id} value={category.id}><span className="flex min-w-0 items-center justify-between gap-2"><span className="min-w-0 truncate">{category.name}</span><Badge className="tabular-nums" size="sm" variant="secondary">{category.count}</Badge></span></MenuRadioItem>)}
      </MenuRadioGroup>
      {canManage ? <><MenuSeparator /><MenuItem closeOnClick={true} onClick={onCreate}><Icon aria-hidden={true} name="plus" size={16} /><span className="min-w-0 truncate">{t("newCategory")}</span></MenuItem></> : null}
    </MenuPopup>
  </Menu>
}
