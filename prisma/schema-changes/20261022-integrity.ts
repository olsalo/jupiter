// Versioned data migration. Run once after Prisma adds the new nullable columns.
export const version = "20261022-integrity"
export const backfill = [
  `UPDATE service SET "minBookingNoticeMinutes" = NULL WHERE "minBookingNoticeMinutes" = 0`,
  `WITH policies AS (SELECT a.id,
    COALESCE(s."cancellationNoticeMinutes", os."cancellationNoticeMinutes", 0) AS cancellation,
    COALESCE(s."rescheduleNoticeMinutes", os."rescheduleNoticeMinutes", 0) AS reschedule,
    COALESCE(s."minBookingNoticeMinutes", os."minBookingNoticeMinutes", 0) AS notice,
    COALESCE(s."maxBookingAdvanceDays", os."maxBookingAdvanceDays") AS advance,
    COALESCE(os."allowCustomerCancellation", true) AS cancel_allowed,
    COALESCE(os."allowCustomerRescheduling", true) AS reschedule_allowed
    FROM appointment a LEFT JOIN organization_settings os ON os."organizationId" = a."organizationId"
    LEFT JOIN LATERAL (SELECT sv.* FROM appointment_service aps JOIN service sv ON sv.id = aps."serviceId" WHERE aps."appointmentId" = a.id ORDER BY aps."createdAt", aps.id LIMIT 1) s ON true)
  UPDATE appointment a SET "cancellationNoticeMinutes" = p.cancellation, "rescheduleNoticeMinutes" = p.reschedule,
    "minBookingNoticeMinutes" = p.notice, "maxBookingAdvanceDays" = p.advance,
    "allowCustomerCancellation" = p.cancel_allowed, "allowCustomerRescheduling" = p.reschedule_allowed
  FROM policies p WHERE a.id = p.id AND a."cancellationNoticeMinutes" IS NULL`,
  `UPDATE booking_answer a SET label = q.label, type = q.type, options = q.options, "sortOrder" = q."sortOrder" FROM booking_question q WHERE a."questionId" = q.id AND a.label IS NULL`,
  `UPDATE notification SET
    attempts = CASE WHEN metadata->>'attempts' ~ '^[0-9]{1,6}$' THEN (metadata->>'attempts')::int ELSE 0 END,
    "nextAttemptAt" = CASE WHEN metadata ? 'attempts' THEN "scheduledAt" ELSE NULL END,
    "lockedUntil" = CASE WHEN metadata ? 'leaseToken' AND status = 'SCHEDULED' THEN "scheduledAt" ELSE NULL END,
    "leaseToken" = CASE WHEN metadata ? 'leaseToken' AND status = 'SCHEDULED' THEN metadata->>'leaseToken' ELSE NULL END,
    metadata = metadata - 'attempts' - 'leaseToken'`,
]

export const checks: [string, string, string][] = [
  ["service", "service_duration", '"durationMinutes" > 0 AND "durationMinutes" <= 1440'],
  ["service", "service_buffers", '"bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0'],
  ["service", "service_values", '(price IS NULL OR price >= 0) AND ("depositAmount" IS NULL OR "depositAmount" >= 0) AND "maxAttendees" > 0 AND ("minBookingNoticeMinutes" IS NULL OR "minBookingNoticeMinutes" >= 0) AND ("maxBookingAdvanceDays" IS NULL OR "maxBookingAdvanceDays" > 0) AND ("cancellationNoticeMinutes" IS NULL OR "cancellationNoticeMinutes" >= 0) AND ("rescheduleNoticeMinutes" IS NULL OR "rescheduleNoticeMinutes" >= 0)'],
  ["availability_rule", "availability_minutes", '"dayOfWeek" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute"'],
  ["availability_rule", "availability_validity", '"validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" > "validFrom"'],
  ...["appointment", "availability_override", "blocked_time"].map((table): [string, string, string] => [table, `${table}_interval`, '"endsAt" > "startsAt"']),
  ["appointment_series", "series_interval", '"endsAt" IS NULL OR "endsAt" > "startsAt"'],
  ["appointment", "appointment_money", '"subtotalAmount" >= 0 AND "discountAmount" >= 0 AND "taxAmount" >= 0 AND "totalAmount" >= 0 AND "paidAmount" >= 0'],
  ["appointment_service", "appointment_service_values", '"durationMinutes" > 0 AND quantity > 0 AND "unitPrice" >= 0 AND "totalPrice" >= 0 AND "bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0'],
  ["staff_service", "staff_service_values", '("durationMinutes" IS NULL OR "durationMinutes" > 0) AND (price IS NULL OR price >= 0)'],
  ...["service_resource", "appointment_resource"].map((table): [string, string, string] => [table, `${table}_quantity`, 'quantity > 0']),
  ["resource", "resource_capacity", 'capacity > 0'],
  ...["payment", "refund"].map((table): [string, string, string] => [table, `${table}_amount`, 'amount >= 0']),
  ["organization_settings", "settings_values", '"weekStartsOn" BETWEEN 0 AND 6 AND "defaultStartHour" >= 0 AND "defaultEndHour" <= 24 AND "defaultEndHour" > "defaultStartHour" AND "defaultSlotIntervalMinutes" > 0 AND "calendarSlotIntervalMinutes" > 0 AND "minBookingNoticeMinutes" >= 0 AND "cancellationNoticeMinutes" >= 0 AND "rescheduleNoticeMinutes" >= 0 AND ("maxBookingAdvanceDays" IS NULL OR "maxBookingAdvanceDays" > 0)'],
]

export const postChecks: [string, string, string][] = [
  ["notification", "notification_attempts", "attempts >= 0"],
  ["appointment", "appointment_policy_values", '("cancellationNoticeMinutes" IS NULL OR "cancellationNoticeMinutes" >= 0) AND ("rescheduleNoticeMinutes" IS NULL OR "rescheduleNoticeMinutes" >= 0) AND ("minBookingNoticeMinutes" IS NULL OR "minBookingNoticeMinutes" >= 0) AND ("maxBookingAdvanceDays" IS NULL OR "maxBookingAdvanceDays" > 0)'],
]
