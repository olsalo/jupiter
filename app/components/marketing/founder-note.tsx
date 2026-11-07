import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"

export type FounderNoteProps = {
  name?: string
  portraitSrc?: string
  signatureSrc?: string
}

export function FounderNote({ name, portraitSrc, signatureSrc }: FounderNoteProps) {
  const { t } = useTranslation("marketing")

  return (
    <section aria-labelledby="founder-title" className="mt-16 grid gap-10 border-t pt-16 pb-16 md:mt-24 md:grid-cols-[1fr_16rem] md:gap-16 md:pt-20 md:pb-20">
      <div>
        <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">{t("founder.label")}</p>
        <h2 className="text-3xl leading-tight font-semibold tracking-[-0.035em] md:text-4xl" id="founder-title">{t("founder.title")}</h2>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground md:text-base">
          <p>{t("founder.note")}</p>
          <p>{t("founder.promise")}</p>
        </div>
        <div className="mt-8">
          {signatureSrc ? (
            <img alt={t("founder.signature")} className="mb-4 h-14 w-40 object-contain object-left" loading="lazy" src={signatureSrc} />
          ) : (
            <div aria-label={t("founder.signature")} className="mb-4 flex h-14 w-40 items-center border-b border-dashed text-sm italic text-muted-foreground/60">{t("founder.signature")}</div>
          )}
          <p className="text-sm font-medium">{name || t("founder.name")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("founder.role")}</p>
        </div>
      </div>
      <div className="w-40 self-start md:w-full">
        {portraitSrc ? (
          <img alt={name || t("founder.portrait")} className="aspect-[4/5] w-full rounded-xl object-cover" loading="lazy" src={portraitSrc} />
        ) : (
          <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 text-muted-foreground/60">
            <Icon aria-hidden={true} name="user" size={28} stroke={1.25} />
            <span className="text-xs">{t("founder.portrait")}</span>
          </div>
        )}
      </div>
    </section>
  )
}
