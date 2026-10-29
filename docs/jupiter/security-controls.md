# Security controls

## Production ingress

Jupiter defaults to reading the visitor's IP from `X-Real-IP`, which Traefik supplies. Set `TRUSTED_CLIENT_IP_HEADER` only to override this default. `BOOKING_TRUSTED_IP_HEADER` remains a legacy fallback. Configure the trusted ingress to **overwrite** the selected header with the address it observes. Never pass through an incoming client value or append to a forwarded chain. Prevent clients from bypassing this ingress and reaching the application directly.

The application rejects missing, invalid or comma-separated addresses for production public booking requests and OTP delivery. The rejection indicates a proxy configuration problem, rather than placing all visitors in one shared client bucket. Development can run without this header. Authentication uses the same selected header, defaulting to `X-Real-IP`.

Verify the ingress by sending requests with forged incoming header values and checking that the application receives the address observed by the ingress. This deployment property cannot be guaranteed by application code.

## Email and request budgets

OTP sends are limited before OTP creation: one per recipient per minute, five per hour and ten per day, shared across request types and application instances. The application also permits ten sends per trusted client per minute, 200 sends per hour globally and 1,000 per day globally. Recipient addresses are trimmed and lowercased; counter keys are hashed before storage. Rotating IPs cannot bypass recipient or delivery budgets. Rejected sends do not replace an existing OTP.

Booking lookup limits are shared across instances and allow 120 requests per client per minute. The existing per-organization read and mutation budgets remain in place. Expiring counters use the existing verification table and PostgreSQL transaction locks, without a schema change. The appointment job removes expired budget records and old booking request audit rows.

## Subscriptions

When all required Stripe billing settings are present, organization application APIs require a current subscription entitlement. Public page discovery, availability and new bookings require it too. Existing booking links remain available to read, cancel and reschedule appointments so customers can manage existing commitments. Billing recovery, organization switching, personal preferences and onboarding remain accessible.

Scheduled cancellation preserves access until the paid period or scheduled cancellation date expires. Expired subscription periods are rejected even if a webhook has not updated the status yet. `DEMO_BYPASS_ONBOARDING_PAYMENT` only applies outside production. Billing-disabled installations remain usable.

## Storage

See [booking image storage](booking-image-storage.md) for upload limits, required storage permissions and scheduled orphan cleanup.

The previous example configuration included concrete storage credentials. They have been removed from the example file. If those credentials are real, rotate them at the storage provider, inspect access logs and remove shared copies. Removing values from a file does not revoke credentials or remove repository history. This repository change does not rotate external credentials.

## Regression checks

```sh
node --experimental-strip-types tests/security-abuse.integration.ts
node --experimental-strip-types tests/auth-production.test.ts
node --experimental-strip-types tests/booking-page-image.integration.ts
npm run typecheck
npm run build
```

The security regression test isolates authentication and storage transports and uses a transactional database test double. It verifies subscription bypass rejection, recovery access, recipient throttling, budget expiry and rollback, independent booking clients, upload limits and scoped cleanup without sending emails or accessing external storage.
