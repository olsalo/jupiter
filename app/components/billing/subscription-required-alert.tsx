import { useTranslation } from "react-i18next"

import { Alert, AlertTitle } from "~/components/ui/alert"

export function SubscriptionRequiredAlert() {
  const { t } = useTranslation("team")
  return <Alert><AlertTitle className="font-normal">{t("people.subscriptionRequired")}</AlertTitle></Alert>
}
