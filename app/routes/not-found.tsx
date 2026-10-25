import { Link, data, href } from "react-router"
import { useTranslation } from "react-i18next"

import { AppLogo } from "~/components/app-logo"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "~/components/ui/empty"

export function loader() {
  return data(null, { status: 404 })
}

export function clientLoader() {
  return null
}

export default function NotFound() {
  const { t } = useTranslation("notFound")

  return (
    <main className="relative grid min-h-dvh place-items-center bg-background pl-[calc(1.25rem+env(safe-area-inset-left,0px))] pr-[calc(1.25rem+env(safe-area-inset-right,0px))] pb-[env(safe-area-inset-bottom,0px)] text-foreground">
      <title>{t("title")}</title>
      <header className="absolute left-[calc(1.25rem+env(safe-area-inset-left,0px))] top-[calc(1.25rem+env(safe-area-inset-top,0px))]">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9">
          <AppLogo aria-hidden="true" className="size-5 md:size-6" />
        </div>
      </header>
      <Empty className="w-full max-w-lg">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" name="search" />
          </EmptyMedia>
          <h1 className="font-heading text-xl font-semibold" data-slot="empty-title">
            {t("title")}
          </h1>
          <EmptyDescription>
            {t("description")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            className="keyboard-focusable"
            render={<Link reloadDocument to={href("/")} />}
          >
            <Icon aria-hidden="true" name="arrowLeft" />
            {t("goToOverview")}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
