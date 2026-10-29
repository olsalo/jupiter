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

