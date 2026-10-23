import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { FormSwitch } from "~/components/form-switch"
import { createSettingsSaveQueue } from "~/lib/settings-save-queue"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function BookingPageSwitch({ name, checked, disabled }: {
  name: "isActive" | "allowStaffSelection"
  checked: boolean
  disabled: boolean
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const queue = useRef(createSettingsSaveQueue())
  const revision = useRef(0)
  const confirmed = useRef(checked)
  const mutation = useMutation(trpc.bookingPage.updateSwitches.mutationOptions())
  const queryKey = trpc.bookingPage.get.queryKey()

  const updateCache = (value: boolean, slug?: string) => queryClient.setQueryData(queryKey, (current) => {
    if (!current) return current
    const values = { ...current.values, [name]: value }
    const basePath = `/book/${encodeURIComponent(current.organization.slug)}`
    return { ...current, values, published: current.bookingEnabled && values.isActive, ...(slug && current.publicPath === basePath ? { publicPath: `${basePath}/${encodeURIComponent(slug)}` } : {}) }
  })

  const save = (value: boolean) => {
    if (queue.current.pendingCount === 0) confirmed.current = checked
    const currentRevision = ++revision.current
    updateCache(value)
    void queue.current.enqueue(async () => {
      try {
        const saved = await mutation.mutateAsync({ [name]: value })
        confirmed.current = saved[name]
        if (currentRevision !== revision.current) return
        updateCache(saved[name], saved.slug)
        await Promise.all([
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

  return <FormSwitch checked={checked} disabled={disabled} label={t(`adminBookingPage.${name}`)} description={t(`adminBookingPage.${name}Description`)} onCheckedChange={save} />
}
