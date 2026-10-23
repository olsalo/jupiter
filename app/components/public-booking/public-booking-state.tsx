import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export function PublicBookingLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div aria-label={label} className={cn("relative isolate flex min-h-64 w-full flex-1 items-center justify-center", className)} role="status">
      <div aria-hidden={true} className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-background/60 via-background/90 to-background backdrop-blur-sm" />
      <Spinner aria-hidden={true} className="size-6" />
    </div>
  )
}

export function PublicBookingUnavailable({ notFound, title, onRetry, retrying }: {
  notFound: boolean
  title: string
  onRetry: () => void
  retrying: boolean
}) {
  const { t } = useTranslation("booking")

  if (notFound) return (
    <Empty className="w-full max-w-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon aria-hidden={true} name="search" /></EmptyMedia>
        <h1 className="font-heading text-xl font-semibold" data-slot="empty-title">{title}</h1>
        <EmptyDescription>{t("unavailableHint")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )

  return (
    <Alert className="border-0" variant="error">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {t("unavailableHint")}
        <Button className="mt-2 self-start" loading={retrying} onClick={onRetry} type="button" variant="outline">{t("retry")}</Button>
      </AlertDescription>
    </Alert>
  )
}
