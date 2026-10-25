# Email and communications

Settings → Communications is available to owners and admins. Message switches save
immediately. Reminder timing, sender name and reply-to address use Save/Cancel.
Configure up to five distinct reminders from 1 minute to 10080 minutes (one week)
before the appointment. Clearing either sender field restores the provider default.
No message editor is included.

Templates use the unified `react-email` 6 package. Each email follows the same path:

- `app/lib/email-templates/otp.ts`, `invitation.ts`, `appointment.ts`: select translated copy and prepare template data
- `app/components/emails/`: React Email layouts for each template, sharing `layout.tsx`
- `app/lib/email-templates/render.ts`: one renderer returning `{ subject, html, text }` from `types.ts`
- `app/lib/email/email.server.ts`: provider delivery through Resend or Plunk

The appointment template handles confirmations, cancellations, reschedules and
reminders through its `kind` option. Scheduling and notification services call the
template function instead of assembling React markup themselves.
Email copy lives in `app/locales/en/email.json` and `app/locales/fi/email.json`.
OTP and team invitation templates support Finnish and English. Guest emails use
the selected language cookie (then browser language, then English). Signed-in
account emails use the saved user locale, and language changes update both the
database and cookie. Team invitations use the signed-in inviter’s saved locale.
Page loads do not overwrite a saved locale from another browser’s cookie. Appointment
confirmation, cancellation, reschedule and reminder emails use the customer's
locale, appointment timezone and the business's date format preference.

Set the following environment variables on both the web app and job runner:

- `EMAIL_PROVIDER`: `resend` or `plunk`
- `EMAIL_FROM`: the provider-verified sender, for example `Jupiter <bookings@example.com>`
- `RESEND_API_KEY` or `PLUNK_API_KEY`: the selected provider's API key
- `EMAIL_OVERRIDE_TO`: optional comma-separated test recipients

Build with `npm run build`, then schedule `npm run jobs:appointments` every minute.
Appointment emails and combined-flow team invitations are queued transactionally;
the worker delivers them with retry/backoff. HTML and plain text are saved as a
snapshot when queued. Existing plain-text queue records remain deliverable.
OTP and Better Auth invitation emails send directly. In production, missing email
configuration raises an error instead of silently dropping direct messages.

Changing reminder settings atomically rebuilds future unsent reminders while
preserving already sent offsets. The worker checks current message switches,
sender name and reply-to before sending. Sender settings never replace the verified
from-address or expose provider credentials to the browser.

Run `npm run test:communications` for mocked provider/template checks and database
integration tests with isolated records and cleanup. No test sends real email.

## How the queue works

1. A booking, cancellation, reschedule or combined-flow invitation saves a row in
   the `notification` table inside the same transaction as the application change.
   If the transaction fails, the email is not queued. Appointments without a
   customer email or with their message type disabled do not queue that email.
2. Immediate messages start as `PENDING`. Reminders start as `SCHEDULED` with
   `scheduledAt` set to the appointment start minus the configured offset.
   Subject, plain text, HTML, recipient and locale are snapshots taken at queue time.
   Both appointment and invitation snapshots use `email-queue.ts`; new records
   store HTML in `metadata.emailHtml`. Legacy `invitationHtml` and plain-text-only
   records remain supported by the worker.
3. Each invocation of `npm run jobs:appointments` runs once and exits. Schedule
   it every minute externally; starting the web app does not start this worker.
   It selects up to 100 due `PENDING` or `SCHEDULED` emails, oldest first.
4. The worker claims each row atomically with a unique token and a five-minute
   lease, preventing overlapping workers from processing the same claim. It
   rechecks current message switches and invitation validity, then sends through
   the configured provider using the current sender name and reply-to address.
   Disabled messages and expired, accepted or cancelled invitations become `CANCELLED`.
5. Provider acceptance marks the email `SENT`. Failures are rescheduled after
   2, 4, 8 and 16 minutes; the fifth failed attempt marks the row `FAILED`.
   A crashed worker's expired lease can be claimed again. `SENT` means accepted
   by the provider, not confirmed inbox delivery.

Rescheduling/cancellation cancels outdated unsent appointment messages. Changing
reminder settings rebuilds future unsent reminders and preserves offsets already
sent. The runner also expires booking holds and prunes old rate-limit records.

Delivery is at-least-once: a crash after the provider accepts an email but before
the database records `SENT` can result in a duplicate on the next attempt. OTP and
native Better Auth invitations send directly and do not wait for this queue.
