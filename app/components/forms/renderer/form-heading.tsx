import { useTranslation } from "react-i18next"

export function FormHeading({ title, description, logo }: {
  title: string
  description: string | null
  logo: string | null
}) {
  const { t } = useTranslation("forms")

  return (
    <header className="space-y-2">
      {logo ? <img alt="" className="mb-4 max-h-16 max-w-48 object-contain" src={logo} /> : null}
      <h1 className="text-2xl font-semibold tracking-tight">{title.replace(/^Untitled(?=_\d+$|$)/, t("untitled"))}</h1>
      {description ? <p className="whitespace-pre-wrap text-muted-foreground">{description}</p> : null}
    </header>
  )
}
