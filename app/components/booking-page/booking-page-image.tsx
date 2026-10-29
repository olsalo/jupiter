import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { BookingPageIdentity } from "./booking-page-identity"
import { BookingPageCoverUpload } from "./booking-page-cover-upload"

export function BookingPageImage({ imageKey, imageUrl, enabled, disabled, organization, accentColor }: {
  organization: { name: string, slug: string, logo: string | null }
  accentColor: string | null
  imageKey: string | null
  imageUrl: string | null
  enabled: boolean
  disabled: boolean
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const upload = useMutation(trpc.bookingPage.uploadImage.mutationOptions())
  const update = useMutation(trpc.bookingPage.updateImage.mutationOptions())

  return <BookingPageCoverUpload
    cover={true}
    previewFooter={<BookingPageIdentity accentColor={accentColor} organization={organization} />}
    value={imageKey}
    imageUrl={imageUrl}
    label={t("adminBookingPage.image")}
    description={t("imageUpload.hint")}
    enabled={enabled}
    disabled={disabled}
    onChange={async (imageKey) => {
      const saved = await update.mutateAsync({ imageKey })
      queryClient.setQueryData(trpc.bookingPage.get.queryKey(), (current) => {
        if (!current) return current
        const basePath = `/book/${encodeURIComponent(current.organization.slug)}`
        return { ...current, imageUrl: saved.imageUrl, values: { ...current.values, imageKey: saved.imageKey }, ...(current.publicPath === basePath ? { publicPath: `${basePath}/${encodeURIComponent(saved.slug)}` } : {}) }
      })
      if (saved.cleanupPending) toast.error(t("imageUpload.cleanupError"))
      void queryClient.invalidateQueries(trpc.booking.getPage.queryFilter())
    }}
    upload={(base64) => upload.mutateAsync({ base64 })}
  />
}
