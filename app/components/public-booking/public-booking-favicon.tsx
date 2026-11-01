import { bookingFavicon } from "~/lib/booking/booking-favicon"

export function PublicBookingFavicon({ organization, accentColor }: {
  organization?: { name: string, logo: string | null }
  accentColor?: string | null
}) {
  if (!organization) return <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="48x48" />

  return <link
    rel="icon"
    href={organization.logo || bookingFavicon(organization.name, accentColor)}
    type={organization.logo ? undefined : "image/svg+xml"}
    sizes={organization.logo ? undefined : "any"}
  />
}
