# Jupiter security and abuse audit

Date: 29 October 2026

Scope: current working tree, including existing uncommitted changes. Reviewed authentication, organization authorization, subscription enforcement, public booking, notifications, and image storage. No application code was changed. Findings below distinguish local reproduction from deployment-dependent risk.

Follow-up: repository fixes for these findings are now implemented. See [security controls](security-controls.md) for the resulting behavior, regression checks and required deployment steps. The findings below preserve the original audit evidence. External credential rotation and ingress configuration remain deployment responsibilities.

## 1. High: subscription checks can be bypassed through the API

Evidence: `app/routes/layout.tsx:50`, `app/.server/trpc.ts:134`, `app/.server/trpc.ts:153`, `app/.server/routers/customers.ts:27`

The workspace layout redirects users without a subscription, but `/api/trpc` sits outside that layout. Application procedures use `organizationProcedure` and `permissionProcedure`, which check membership and role but do not require a subscription. `subscribedProcedure` exists but is not used by these procedures. Public booking resolution also does not check subscription entitlement.

An owner whose trial or subscription has ended can continue calling application APIs directly. This also allows paid application mutations before completing checkout. Reproduced `customer.create` with an authenticated owner and an isolated database stub: the write succeeded without querying subscription state.

Fix: enforce entitlement in shared middleware for paid application operations when billing is enabled. Keep account recovery, onboarding and billing recovery endpoints accessible. Decide explicitly whether public bookings should remain available after subscription expiry, then enforce that policy server-side too.

## 2. High, deployment-dependent: forwarded IP spoofing bypasses OTP send limits

Evidence: `app/lib/auth/server.ts:78`, `app/lib/auth/server.ts:116`, `app/routes/api/auth.ts:8`

Auth uses the installed Better Auth defaults for IP resolution: `X-Forwarded-For`, with no application configuration of trusted proxies. The OTP send limit is keyed by IP and path. There is no application-level recipient cooldown or recipient delivery budget.

In an isolated production-mode auth instance with a memory database and stubbed email transport, four sends from one forwarded IP returned `200, 200, 200, 429`. Six further sends to the same recipient with six different forwarded IP values all returned `200`.

If the public ingress preserves an attacker-supplied first forwarded address, an unauthenticated caller can repeatedly trigger OTP emails and consume email delivery capacity. The same trust boundary affects booking limits when `BOOKING_TRUSTED_IP_HEADER=x-forwarded-for`. This is not a demonstrated OTP guessing or account takeover vulnerability.

Fix: configure IP resolution for the actual ingress, ensure the ingress overwrites untrusted values, and add a shared recipient cooldown plus recipient and overall delivery budgets. Deployment proxy behavior was not inspected, so external exploitability remains conditional.

## 3. High if real: storage credentials are present in the tracked example configuration

Evidence: `.env.example:57` through `.env.example:60`

The current example file contains a concrete externally addressed storage endpoint, bucket, access key and nonempty secret. The same storage integration supports object reads, writes and deletion. Anyone receiving this file receives these credential values too. The file is tracked, though its current contents include uncommitted changes.

Credential validity and scope were not tested. If these values authenticate to the indicated service, access is possible outside the application's organization checks, subject to the storage account's permissions.

Fix: replace the endpoint and credentials with safe placeholders. If the credentials are real, rotate them and inspect storage access logs. Use a dedicated bucket-scoped service account. Check repository history and other shared copies for previous exposure. Secret values are intentionally omitted from this report.

## 4. Medium: missing IP configuration creates a shared booking denial of service

Evidence: `app/.server/services/booking-rate-limit.ts:6`, `app/.server/services/booking-rate-limit.ts:11`, `app/.server/routers/booking.ts:14`

When the trusted header setting is absent, or the configured header is missing, every visitor hashes to the same `unknown` client key. The lookup limiter is shared across organizations and booking procedures within the application process. One visitor can make 120 lookups in a minute and block subsequent booking requests from unrelated visitors and organizations on that process. Requests for nonexistent pages or codes consume this bucket too.

Reproduced locally: after 120 calls with different forwarded IP values and no trusted-header setting, a call representing an unrelated visitor threw `TOO_MANY_REQUESTS`. Database mutation limits likewise collapse visitors into one per-organization client bucket when the header is unavailable.

Fix: validate the deployment's trusted client identity configuration, surface missing-header failures operationally, and avoid treating all unidentified visitors as one global client. Separate organization protection from per-client limits and use a shared limiter suitable for multiple instances.

## 5. Medium: uploads allow unbounded processing and orphaned storage

Evidence: `app/.server/routers/booking-page.ts:16`, `app/lib/storage/image-upload.server.ts:29`, `app/lib/storage/image-upload.server.ts:34`

Every successful upload performs image decoding and AVIF encoding, then writes a new UUID-named object. The route requires a configuration role, but has no upload frequency, concurrency or aggregate storage limit. Cleanup in `updateImage` tracks previously saved images; an upload that is never attached to a page is not registered for cleanup.

An authenticated owner or admin can repeatedly call upload without saving a page, accumulating permanent objects and consuming shared image processing capacity. Individual file and pixel limits help bound each request but do not bound cumulative use. Subscription bypass in finding 1 also applies to this route.

Fix: apply per-organization upload and storage budgets, constrain concurrent encoding, and track pending uploads with expiry. Delete unattached objects through a scheduled cleanup or storage lifecycle policy. This finding follows the code path; no load test or real storage writes were performed.

## Validation and limits

- Reproduced the subscription mutation bypass with a database stub
- Reproduced OTP throttling and forwarded-IP rotation with memory storage and email transport stubbed
- Reproduced the shared booking bucket when trusted-header configuration is absent
- Ran `tests/auth-production.test.ts`: all three HTTP/HTTPS session cookie scenarios passed
- All audit-created Vite instances were closed
- No application database writes, real emails, storage requests, or production probes were performed
- Existing user changes were preserved

This is a focused source and isolated behavior audit. It does not establish the security of production ingress, storage IAM, deployed environment values, or dependency advisories.
