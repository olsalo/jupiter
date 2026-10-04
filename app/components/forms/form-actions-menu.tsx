import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu"

type FormActionsMenuProps = {
  onCopyLink: () => void
  canCopyLink: boolean
  canChangeResponses: boolean
  responsesOpen: boolean
  formTitle: string
  pending: boolean
  onDelete: () => void
  onToggleResponses: () => void
  onDuplicate: () => void
  onOpen: () => void
}

export function FormActionsMenu({ onCopyLink, canCopyLink, canChangeResponses, responsesOpen, formTitle, pending, onToggleResponses, onDelete, onDuplicate, onOpen }: FormActionsMenuProps) {
  const { t } = useTranslation("forms")

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("actions.more", { title: formTitle })}
        render={<Button size="icon" type="button" variant="ghost" />}
      >
        <Icon aria-hidden="true" name="dotsVertical" size={18} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-44" sideOffset={6}>
        <MenuItem closeOnClick={true} onClick={onOpen}>{t("actions.open")}</MenuItem>
        <MenuItem closeOnClick={true} disabled={pending} onClick={onDuplicate}>
          {t("actions.duplicate")}
        </MenuItem>
        <MenuItem closeOnClick={true} disabled={!canCopyLink || pending} onClick={onCopyLink}>{t("actions.copyPublicLink")}</MenuItem>
        <MenuItem closeOnClick={true} disabled={!canChangeResponses || pending} onClick={onToggleResponses}>{t(responsesOpen ? "actions.closeResponses" : "actions.openResponses")}</MenuItem>
        <MenuSeparator />
        <MenuItem closeOnClick={true} disabled={pending} onClick={onDelete} variant="destructive">
          {t("actions.delete")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
