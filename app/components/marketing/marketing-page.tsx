import { useTranslation } from "react-i18next"
import { Link, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { standalonePageLogoClassName } from "~/components/layout/standalone-page-styles"
import { FeatureVideo } from "~/components/marketing/feature-video"
import { FounderLetter } from "~/components/marketing/founder-letter"
import { GetStartedForm } from "~/components/marketing/get-started-form"
import { RequestAccessForm } from "~/components/marketing/request-access-form"
import { AppLogo } from "~/components/navigation/app-logo"
import { LanguageSwitch } from "~/components/settings/preferences/language-switch"
import { ThemeSwitch } from "~/components/settings/preferences/theme-switch"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"

const features = [
  { id: "booking", video: "/video.mp4" },
  { id: "calendar", video: "/video.mp4" },
  { id: "availability", video: "/video.mp4" },
  { id: "reminders", video: "/video.mp4" },
  { id: "page", video: "/video.mp4" },
  { id: "customers", video: "/video.mp4" },
] as const

export function MarketingPage({ requestAccessOnly = false }: { requestAccessOnly?: boolean }) {
  const { t } = useTranslation("marketing")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const signedIn = Boolean(rootData?.user)
  const appLink = `${rootData?.appBaseUrl ?? ""}${signedIn ? "/calendar" : "/auth"}`

  return (
    <ScrollArea className="h-dvh overflow-hidden bg-background text-foreground" scrollbarClassName="max-md:hidden" viewportProps={{ className: "max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden" }}>
      <title>{t("metaTitle")}</title>
      <meta content={t("metaDescription")} name="description" />
      <a className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3" href="#main">{t("skipToContent")}</a>

      <header className="pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-5 md:items-center md:px-8 md:py-4">
          <Link aria-label="Jupiter" className="flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight outline-offset-4" to="/marketing">
            <span className={standalonePageLogoClassName}><AppLogo aria-hidden={true} className="size-5 md:size-6" /></span>
            Jupiter
          </Link>
          <div className="flex items-center gap-3 md:gap-5">
            <div className="flex items-center gap-2 max-md:[&_[data-slot=tabs-tab]]:size-8 max-md:[&_[data-slot=tabs-tab]]:p-0 max-md:[&_[data-slot=tabs-tab]]:text-sm max-md:[&_svg]:size-5"><ThemeSwitch /><LanguageSwitch /></div>
            {!requestAccessOnly ? <>
              <span aria-hidden={true} className="hidden h-5 w-px bg-border sm:block" />
              <Button className="max-sm:hidden" render={<Link to={appLink} />} variant="outline">{t(signedIn ? "openApp" : "signIn")}</Button>
            </> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8" id="main">
        <section aria-labelledby="hero-title" className="pt-20 pb-14 md:pt-28 md:pb-20">
          <p className="mb-6 text-sm font-medium text-muted-foreground" hidden={true}>{t("eyebrow")}</p>
          <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.1] font-semibold tracking-[-0.055em]" id="hero-title">
            {t("title")}<br /><span className="text-muted-foreground">{t("titleSecondLine")}</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {requestAccessOnly ? <RequestAccessForm /> : signedIn ? <Button render={<Link to={appLink} />} size="xl">{t("openApp")}<Icon aria-hidden={true} name="arrowRight" /></Button> : <GetStartedForm />}
          </div>
        </section>

        <div>
          {features.map(({ id, video }, index) => (
            <section aria-labelledby={`${id}-title`} className="scroll-mt-8 pt-16 pb-4 md:pt-24 md:pb-6" id={id} key={id}>
              <div className="mb-7 md:mb-10">
                <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground"><span className="mr-2 font-mono text-muted-foreground/60">0{index + 1}</span>{t(`sections.${id}.label`)}</p>
                <h2 className="text-2xl leading-tight font-semibold tracking-[-0.035em] md:text-4xl" id={`${id}-title`}>{t(`sections.${id}.title`)}</h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base md:leading-7">{t(`sections.${id}.description`)}</p>
              </div>
              <FeatureVideo src={video} title={t(`sections.${id}.title`)} />
            </section>
          ))}
        </div>

        <FounderLetter />

        <section aria-labelledby="closing-title" className="relative mb-12 overflow-hidden rounded-xl bg-muted/40 px-5 py-8 md:mb-16 md:px-8 md:py-10 lg:pr-80">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-[-0.035em] md:text-3xl" id="closing-title">{t("closingTitle")}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">{t("closingDescription")}</p>
            <div className="mt-6">
              {requestAccessOnly ? <RequestAccessForm /> : signedIn ? <Button render={<Link to={appLink} />} size="xl">{t("openApp")}<Icon aria-hidden={true} name="arrowRight" /></Button> : <GetStartedForm />}
            </div>
          </div>
          <div aria-hidden={true} className="pointer-events-none absolute right-0 -bottom-20 hidden w-76 lg:block">
            <img alt="" className="w-full dark:hidden" loading="lazy" src="/mockup-light.avif" />
            <img alt="" className="hidden w-full dark:block" loading="lazy" src="/mockup-dark.avif" />
          </div>
        </section>
      </main>

      <footer className="border-t pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-muted-foreground md:px-8">
          <span className="flex items-center gap-2 font-medium text-foreground"><span className={standalonePageLogoClassName}><AppLogo aria-hidden={true} className="size-5 md:size-6" /></span>Jupiter</span>
          <span>{t("footer")}</span>
        </div>
      </footer>
    </ScrollArea>
  )
}
