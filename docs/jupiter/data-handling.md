# Jupiter data handling

The reusable SSR, query cache, navigation, mutation, and form conventions are in [generic data handling](../generic/data-handling.md). This document records scheduling-specific behavior to review when creating a different product from the template.

## Calendar refresh behavior

Individual queries can override the defaults. For example, [calendar/query-options.ts](../../app/lib/calendar/query-options.ts) disables polling for reference data and panels, and pauses booking refresh triggers during an active interaction. Preserve those choices when reusing calendar queries.

The calendar SSR loader seeds staff, organization settings, availability, and appointments for the selected date range. Client queries own fetching after navigation. Preserve matching inputs between the loader and component queries.

## Public booking status and errors

Public booking loaders use [loadPublicBookingQuery](../../app/lib/booking/public-booking-loader.server.ts) to preserve HTTP error statuses and hydrate sanitized error state as well as successful data. Do not replace that behavior with the internal-page prefetch error handling.

See [public booking SSR and hydration tests](../../tests/public-booking-hydration.integration.ts) for status, error sanitization, cache hydration, and retry coverage.

## Exceptions to the no-op client loader

- The calendar client loader returns a current clock snapshot without fetching data
- The note modal client loader reads a cached title for route metadata without awaiting a request
- The overview client loader redirects to `/calendar`
- The auth server loader supplies invitation data and session redirects
- The onboarding parent loader supplies step state and redirects, and intentionally revalidates; its child pages leave data fetching to queries
- API/resource routes serve requests directly and do not use page client loaders


## Login and onboarding transitions

Safe return URLs survive login, business setup, availability, holidays and subscription checkout. Returning to the login or onboarding route after completion falls back to the workspace to avoid loops. Logout reloads the document, which clears in-memory query data before another account signs in.

OTP submissions and resends share a request guard. Conflicting controls stay disabled during a resend, both failed and successful resends reset the code and return focus to the first input. Code errors use the existing error toast rather than inline error text. Unexpected request failures also use a toast. Jupiter retains automatic submission of a complete six-digit code and focus handling.

Onboarding continues to scope data to the active business, restrict setup writes to owners, use the shared subscription entitlement check and disable the demo bypass in production. Updating an incomplete existing business also saves its name. Run `npm run test:auth` for login redirects, session cookies, OTP validation, setup permissions, step transitions and SSR coverage. The real API test creates temporary database records with email delivery disabled and removes them afterward.

## Deployment freshness

Server-rendered HTML uses `Cache-Control: private, no-store`. `/api/version` also uses `no-store` and returns the same build ID embedded in the browser bundle. The production server already serves hashed assets with a one-year immutable cache policy. The offline worker fetches navigations with `cache: "no-store"`, and its registration uses `updateViaCache: "none"`; its script is served with `max-age=0` so normal requests revalidate.

`DeploymentUpdate` checks at startup, every minute while visible and online, when the page becomes visible, when a saved page is restored, and after reconnecting. Checks share a 30-second cooldown and one in-flight request; restored pages and reconnections can bypass the cooldown. Failed or offline checks leave the current page usable. Development skips the watcher.

A different version reloads an idle page automatically. Pointer movement, pointer presses, keyboard input, scrolling, and touch reset the one-minute idle threshold. Before any interaction, startup checks can reload immediately. Dirty or submitting `AppForm` instances, recent activity, active mutations, and navigation prevent an automatic reload and show a translated update notice instead. Later periodic checks can reload once the page is idle and the form changes have been saved or discarded. `AppForm` exposes its dirty and submitting state through data attributes so checks see the current form state without changing form behavior. The session allows at most one automatic deployment reload per minute to prevent loops during rolling deployments; blocked session storage falls back to the notice.

Each build gets a unique ID by default. Set `APP_BUILD_ID` in the build process environment to use a release ID or commit hash instead. Build once and deploy the same artifact to every instance of a release. Changing the environment variable only at runtime does not change the compiled ID. Deploy the client assets and server bundle together, and ensure any proxy respects the HTML and version endpoint cache headers.

Run `node --experimental-strip-types tests/deployment-version.test.ts` for version monitoring and reload guard coverage. Production browser verification covers unchanged versions, automatic reload, retained unsaved form values, and cache headers.

Unexpected submission failures force a document reload through the shared request transport and `AppForm` fallback. This covers HTTP 5xx responses (including proxy HTML errors), streamed tRPC internal errors, and unreadable tRPC responses. It bypasses the dirty-form protection used for ordinary deployment updates, so unsaved edits can be lost. Validation errors, expected HTTP 4xx failures, failed connections, and cancelled requests keep their existing handling. Recovery does not retry the mutation because the server may already have saved it, and duplicate error handlers trigger only one reload per document. Forced submission recovery runs only in production; development keeps the existing form errors and toasts. Run `node --experimental-strip-types tests/submission-recovery.test.ts` for coverage.
