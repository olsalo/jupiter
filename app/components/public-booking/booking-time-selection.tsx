import { useState } from "react"
import { useTranslation } from "react-i18next"
import FormLabel from "~/components/forms/form-label"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import { BookingMemberSelect } from "./booking-member-select"
import { BookingTimePicker } from "./booking-time-picker"
import { useTRPC } from "~/lib/trpc/client"
import { cn } from "~/lib/utils"
import { getBookingChoices } from "./booking-choices"
import type { FormatPreference } from "~/lib/localization/format-preference"
import type { BookingPageData, BookingScope, BookingService, BookingSlot } from "./booking-types"

export function BookingTimeSelection({
  data,
  scope,
  service,
  slot,
  onSelect,
  locationChoice,
  staffChoice,
  onLocationChange,
  onStaffChange,
  formatPreference,
  onReadyChange,
}: {
  data: BookingPageData
  scope: BookingScope
  service: BookingService
  slot: BookingSlot | null
  onSelect: (slot: BookingSlot | null) => void
  locationChoice: string
  staffChoice: string
  onLocationChange: (id: string) => void
  onStaffChange: (id: string) => void
  formatPreference: FormatPreference
  onReadyChange: (ready: boolean) => void
}) {
  const { t } = useTranslation("booking")
  const trpc = useTRPC()
  const [searching, setSearching] = useState(false)
  const choices = getBookingChoices(data, service, locationChoice, staffChoice)
  const locationItems = choices.locations.map((location) => ({
    value: location.id,
    label: location.name,
  }))
  return (
    <div className="space-y-4 sm:space-y-5">
      {(data.page?.allowLocationSelection !== false &&
        choices.locations.length > 1) ||
      (data.page?.allowStaffSelection !== false && choices.staff.length > 1) ? (
        <div
          className={cn(
            "grid gap-3",
            data.page?.allowLocationSelection !== false &&
              choices.locations.length > 1 &&
              data.page?.allowStaffSelection !== false &&
              choices.staff.length > 1 &&
              "sm:grid-cols-2",
          )}
        >
          {data.page?.allowLocationSelection !== false &&
          choices.locations.length > 1 ? (
            <FormLabel label={t("location")}>
              <Select
                disabled={searching}
                items={locationItems}
                onValueChange={(value) => {
                  if (!value || value === choices.locationId) return
                  onLocationChange(value ?? "")
                }}
                value={choices.locationId ?? ""}
              >
                <SelectTrigger className="min-h-11 w-full sm:min-h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {locationItems.map((item) => (
                    <SelectItem
                      className="min-h-12 sm:min-h-8"
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </FormLabel>
          ) : null}
          {data.page?.allowStaffSelection !== false &&
          choices.staff.length > 1 ? (
            <BookingMemberSelect
              disabled={searching}
              members={choices.staff}
              onValueChange={(value) => {
                if (value === choices.staffMemberId) return
                onStaffChange(value ?? "")
              }}
              value={choices.staffMemberId}
            />
          ) : null}
        </div>
      ) : null}
      <BookingTimePicker
        formatPreference={formatPreference}
        getQueryOptions={(range) => trpc.booking.getAvailableSlots.queryOptions({
          ...scope,
          ...range,
          serviceId: service.id,
          staffMemberId: choices.staffMemberId,
          locationId: choices.locationId,
        })}
        maxDays={service.maxBookingAdvanceDays ?? data.settings.maxBookingAdvanceDays ?? 730}
        onReadyChange={onReadyChange}
        onSearchingChange={setSearching}
        onSelect={onSelect}
        resetKey={`${choices.locationId ?? ""}/${choices.staffMemberId ?? ""}`}
        slot={slot}
        timeZone={data.settings.timezone}
      />
    </div>
  )
}
