import { UserAvatar } from "~/components/data-display/user-avatar"
import { bookingPageAccentForeground } from "~/lib/booking/booking-page-colors"

export function BookingPageIdentity({ organization, accentColor }: {
  organization: { name: string, slug: string, logo: string | null }
  accentColor: string | null
}) {
  return <div className="relative flex min-w-0 flex-1 items-end gap-4 px-8 pb-2">
    <UserAvatar
      className="-mt-8 size-16 shrink-0 rounded-xl ring-4 ring-background sm:-mt-9 sm:size-18"
      decorative={true}
      fallbackClassName="rounded-xl bg-inherit text-xl font-semibold text-inherit sm:text-2xl"
      initialsCount={1}
      name={organization.name}
      src={organization.logo}
      stableId={organization.slug}
      style={{ backgroundColor: accentColor ?? "var(--primary)", color: accentColor ? bookingPageAccentForeground(accentColor) : "var(--primary-foreground)" }}
    />
    <div className="min-w-0 flex-1 pt-2">
      <p className="truncate text-lg leading-7 font-semibold tracking-tight sm:text-xl">{organization.name}</p>
    </div>
  </div>
}
