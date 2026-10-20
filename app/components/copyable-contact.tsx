import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { toast } from "~/lib/toast"

export function CopyableContact({ value, kind }: { value: string; kind: "email" | "phone" }) {
  const { t } = useTranslation("common")
  const label = t(kind === "email" ? "contactCopy.email" : "contactCopy.phone")

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t("contactCopy.copied"))
    } catch {
      toast.error(t("contactCopy.error"))
    }
  }

  return <span className="inline-flex max-w-full items-center gap-2 align-middle">
    <span className="min-w-0 break-words">{value}</span>
    <Button aria-label={label} className="text-muted-foreground" onClick={() => void copy()} size="icon-xs" title={label} type="button" variant="ghost"><Icon aria-hidden={true} name="copy" size={16} /></Button>
  </span>
}
