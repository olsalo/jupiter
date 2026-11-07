import { useTranslation } from "react-i18next"

import type { FounderNoteProps } from "~/components/marketing/founder-note"
import Icon from "~/components/icons"
import { AppLogo } from "~/components/navigation/app-logo"

export function FounderLetter({ name, portraitSrc, signatureSrc }: FounderNoteProps) {
  const { t } = useTranslation("marketing")

  return (
    <section aria-labelledby="founder-title" className="py-24 md:py-36">
      <article className="-rotate-[0.75deg] rounded-xl border bg-muted/15 px-6 py-8 shadow-sm md:px-12 md:py-12">
        <header className="mb-8 flex items-center justify-between gap-4 border-b pb-5 md:mb-10">
          <h2 className="text-xs font-medium text-muted-foreground" id="founder-title">{t("founder.label")}</h2>
          <AppLogo aria-hidden={true} className="size-5 shrink-0 text-muted-foreground/60" />
        </header>

        <div className="space-y-5 font-serif text-lg leading-8 text-foreground/85 md:text-xl md:leading-9">
          <p className="text-2xl text-foreground md:text-3xl">{t("founder.greeting")}</p>
          <p>{t("founder.note")}</p>
          <p>{t("founder.promise")}</p>
          <p>{t("founder.thanks")}</p>
        </div>

        <div className="mt-8 md:mt-10">
          <p className="font-serif text-sm text-muted-foreground">{t("founder.signoff")}</p>
          {signatureSrc ? (
            <img alt={t("founder.signature")} className="mt-3 mb-5 h-14 w-40 object-contain object-left" loading="lazy" src={signatureSrc} />
          ) : (
            <div aria-label={t("founder.signature")} className="mt-3 mb-5 flex h-14 w-40 items-center border-b border-dashed font-signature text-3xl font-normal text-muted-foreground/50">{t("founder.signature")}</div>
          )}
          <div className="flex items-center gap-3">
            {portraitSrc ? (
              <img alt={name || t("founder.portrait")} className="size-12 shrink-0 rounded-full object-cover" loading="lazy" src={portraitSrc} />
            ) : (
              <div aria-label={t("founder.portrait")} className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed bg-muted/40 text-muted-foreground/60" role="img">
                <Icon aria-hidden={true} name="user" size={20} stroke={1.25} />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{name || t("founder.name")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("founder.role")}</p>
            </div>
          </div>
        </div>
      </article>
    </section>
  )
}
