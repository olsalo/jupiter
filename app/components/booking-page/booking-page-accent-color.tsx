import { useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import FormLabel from "~/components/forms/form-label"
import { AccentColorSelect } from "~/components/settings/preferences/accent-color-select"
import { createSettingsSaveQueue } from "~/lib/preferences/settings-save-queue"
import { notifyBookingPageSaved } from "~/lib/booking/booking-page-sync"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function BookingPageAccentColor({ value, disabled }: { value: string | null; disabled: boolean }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const mutation = useMutation(trpc.bookingPage.updateAccentColor.mutationOptions())
  const queue = useRef(createSettingsSaveQueue())
  const revision = useRef(0)
  const confirmed = useRef(value)
  const queryKey = trpc.bookingPage.get.queryKey()

  function updateCache(accentColor: string | null, slug?: string) {
    queryClient.setQueryData(queryKey, (current) => {
      if (!current) return current
      const basePath = `/book/${encodeURIComponent(current.organization.slug)}`
      return { ...current, values: { ...current.values, accentColor }, ...(slug && current.publicPath === basePath ? { publicPath: `${basePath}/${encodeURIComponent(slug)}` } : {}) }
    })
  }

  function save(accentColor: string | null) {
    if (disabled) return
    if (queue.current.pendingCount === 0) confirmed.current = value
    const currentRevision = ++revision.current
    updateCache(accentColor)
    void queue.current.enqueue(async () => {
      try {
        const saved = await mutation.mutateAsync({ accentColor })
        confirmed.current = saved.accentColor
        if (currentRevision !== revision.current) return
        updateCache(saved.accentColor, saved.slug)
        const data = queryClient.getQueryData(queryKey)
        if (data) notifyBookingPageSaved(data.organization.slug)
        await Promise.all([
          queryClient.invalidateQueries(trpc.bookingPage.get.queryFilter()),
          queryClient.invalidateQueries(trpc.booking.getPage.queryFilter()),
          queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
        ])
      } catch {
        if (currentRevision !== revision.current) return
        updateCache(confirmed.current)
        toast.error(t("adminBookingPage.saveError"))
      }
    })
  }

  return <FormLabel label={t("adminBookingPage.accentColor")} labelClassName={disabled ? "opacity-64" : undefined} description={t("adminBookingPage.accentColorDescription")} descriptionClassName={disabled ? "opacity-64" : undefined}>
    <AccentColorSelect
      disabled={disabled}
      invalid={false}
      label={t("adminBookingPage.accentColor")}
      onChange={save}
      value={value}
    />
  </FormLabel>
}
