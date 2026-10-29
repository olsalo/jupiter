import { useTranslation } from "react-i18next"

import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export function SettingsLoading({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation()

  return <div className={cn("flex min-h-32 flex-1 items-center justify-center", className)}>
    <Spinner aria-label={label ?? t("settings.loading")} className="size-6 text-muted-foreground" />
  </div>
}
