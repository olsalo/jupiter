import { BookingPageIdentity } from "~/components/booking-page/booking-page-identity"
import { Spinner } from "~/components/ui/spinner"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { useImagePreview } from "~/lib/storage/use-image-preview"
import { PublicBookingOpeningHours } from "./public-booking-opening-hours"
import type { BookingPageData } from "./booking-types"

export function PublicBookingProfile({ data, formatPreference }: { data: BookingPageData, formatPreference: FormatPreference }) {
  const imageUrl = data.page?.imageUrl ?? null
  const { url, loading } = useImagePreview(imageUrl, imageUrl)

  return <header aria-label={data.organization.name} className="flex min-w-0 flex-col gap-1.5">
    <div
      aria-busy={loading}
      className="relative aspect-video max-h-64 w-full rounded-xl bg-primary/5 bg-cover bg-center bg-no-repeat"
      style={url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
    >
      {loading ? <Spinner className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-1/2 text-muted-foreground" /> : null}
    </div>
    <BookingPageIdentity accentColor={data.page?.accentColor ?? null} organization={data.organization} />
    <div className="flex flex-col items-start gap-1 px-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      {data.page?.description ? <p className="min-w-0 text-sm leading-6 whitespace-pre-line text-muted-foreground">{data.page.description}</p> : null}
      <PublicBookingOpeningHours formatPreference={formatPreference} hours={data.openingHours} weekStartsOn={data.settings.weekStartsOn} />
    </div>
  </header>
}
