import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuLinkItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"

export function ServiceActionsMenu({ id, name, disabled, onDelete }: {
  id: string
  name: string
  disabled: boolean
  onDelete: () => void
}) {
  const { t } = useTranslation("services")
  const location = useLocation()
  const duplicateParams = new URLSearchParams(location.search)
  duplicateParams.set("duplicate", id)

  return <Menu>
    <MenuTrigger aria-label={t("serviceActions", { name })} render={<Button disabled={disabled} size="icon" type="button" variant="ghost" />}>
      <Icon aria-hidden={true} name="dotsVertical" size={18} />
    </MenuTrigger>
    <MenuPopup align="end" className="min-w-40" sideOffset={6}>
      <MenuLinkItem closeOnClick={true} render={<Link to={`${id}/edit${location.search}`} state={{ returnTo: `${location.pathname}${location.search}` }} />}><Icon aria-hidden={true} name="edit" size={16} />{t("editServiceAction")}</MenuLinkItem>
      <MenuLinkItem closeOnClick={true} render={<Link to={`new?${duplicateParams}`} state={{ returnTo: `${location.pathname}${location.search}` }} />}><Icon aria-hidden={true} name="copy" size={16} />{t("duplicateServiceAction")}</MenuLinkItem>
      <MenuItem closeOnClick={true} onClick={onDelete} variant="destructive"><Icon aria-hidden={true} name="trash" size={16} />{t("deleteServiceAction")}</MenuItem>
    </MenuPopup>
  </Menu>
}
