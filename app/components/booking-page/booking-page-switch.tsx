import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SettingsSwitch } from "~/components/settings/settings-switch"
import { useTRPC } from "~/lib/trpc/client"

export function BookingPageSwitch({ name, checked, disabled }: {
  name: "isActive" | "allowStaffSelection"
  checked: boolean
  disabled: boolean
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const mutation = useMutation(trpc.bookingPage.updateSwitches.mutationOptions())
  const queryKey = trpc.bookingPage.get.queryKey()

  const updateCache = (value: boolean, slug?: string) => queryClient.setQueryData(queryKey, (current) => {
    if (!current) return current
    const values = { ...current.values, [name]: value }
    const basePath = `/book/${encodeURIComponent(current.organization.slug)}`
    return { ...current, values, published: current.bookingEnabled && values.isActive, ...(slug && current.publicPath === basePath ? { publicPath: `${basePath}/${encodeURIComponent(slug)}` } : {}) }
  })

  return <SettingsSwitch
    checked={checked}
    disabled={disabled}
    label={t(`adminBookingPage.${name}`)}
    description={t(`adminBookingPage.${name}Description`)}
    errorMessage={t("adminBookingPage.saveError")}
    save={(value) => mutation.mutateAsync({ [name]: value })}
    getChecked={(saved) => saved[name]}
    updateCache={(value, saved) => updateCache(value, saved?.slug)}
    onSaved={() => Promise.all([
      queryClient.invalidateQueries(trpc.booking.getPage.queryFilter()),
      queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
    ])}
  />
}
