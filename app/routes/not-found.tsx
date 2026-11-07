import { data, useRouteLoaderData } from "react-router"
import { useTranslation } from "react-i18next"

import type { loader as rootLoader } from "~/root"
import { getStandalonePageStyles, standalonePageLogoClassName, standalonePagePadding } from "~/components/layout/standalone-page-styles"
import { cn } from "~/lib/utils"
import { AppLogo } from "~/components/navigation/app-logo"
import Icon from "~/components/icons"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"

export function loader() {
  return data(null, { status: 404 })
}

export function clientLoader() {
  return null
}

export default function NotFound() {
  const { t } = useTranslation("notFound")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)

  return (
    <main className={cn("relative grid min-h-dvh place-items-center bg-background pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-foreground", getStandalonePageStyles(isElectron))}>
      <title>{t("title")}</title>
      <header className="absolute left-[calc(var(--page-gutter)+env(safe-area-inset-left,0px))] top-(--page-top)">
        <div className={standalonePageLogoClassName}>
          <AppLogo aria-hidden="true" className="size-5 md:size-6" />
        </div>
      </header>
      <div className={cn("grid w-full place-items-center", standalonePagePadding)}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon aria-hidden="true" name="search" />
            </EmptyMedia>
            <EmptyTitle aria-level={1} role="heading">
              {t("title")}
            </EmptyTitle>
            <EmptyDescription>
              {t("description")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </main>
  )
}
