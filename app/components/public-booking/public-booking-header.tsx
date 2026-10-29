import { FormatPreferenceSwitch } from "~/components/settings/preferences/format-preference-switch"
import { LanguageSwitch } from "~/components/settings/preferences/language-switch"
import { UserAvatar } from "~/components/data-display/user-avatar"
import type { FormatPreference } from "~/lib/localization/format-preference"
import type { BookingPageData } from "./booking-types"

export function PublicBookingHeader({ organization, formatPreference, onFormatPreferenceChange }: {
  organization?: BookingPageData["organization"]
  formatPreference: FormatPreference
  onFormatPreferenceChange: (value: FormatPreference) => void
}) {
  return (
    <header className="shrink-0 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-6 lg:h-20 lg:w-[calc(100%_-_3rem)] lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          {organization ? <UserAvatar
            className="size-8 shrink-0 rounded-lg bg-primary text-xs text-primary-foreground"
            fallbackClassName="bg-primary text-primary-foreground"
            decorative={true}
            initialsCount={1}
            name={organization.name}
            src={organization.logo}
            stableId={organization.slug}
          /> : null}
          <span className="truncate text-sm font-medium">{organization?.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FormatPreferenceSwitch onValueChange={onFormatPreferenceChange} value={formatPreference} />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  )
}
