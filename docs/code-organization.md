# Components and library folders

Group files by the feature or shared responsibility they belong to. Keep rendering and UI interactions in `app/components`, and reusable logic, hooks, data, and service integrations in `app/lib`. Routes compose these modules and provide route state.

## Components

| Folder | Contents |
| --- | --- |
| `billing/` | Plan usage and billing notices |
| `booking-page/` | Booking page editor and its settings controls |
| `calendar/` | Staff calendar views, booking editor, and calendar-specific hooks |
| `customers/` | Customer forms, lists, details, and pickers |
| `data-display/` | Shared tables, charts, formatted numbers, avatars, and contact details |
| `emails/` | React Email templates and layout |
| `feedback/` | App status feedback |
| `forms/` | `AppForm`, `FormLabel`, and reusable form inputs |
| `information-architecture/` | Route information architecture view |
| `layout/` | App shells, page layouts, route headers, and page headings |
| `navigation/` | App logo, navigation icons, and profile menu |
| `notes/` | Note form and modal support |
| `onboarding/` | Setup forms, progress, and step state |
| `overlays/` | Responsive dialogs and sheets, popup wrappers, loading, and confirmation |
| `overview/` | Dashboard cards, table, and welcome dialog |
| `placeholders/` | Route and booking loading placeholders |
| `public-booking/` | Customer-facing booking, confirmation, management, and rescheduling |
| `services/` | Service forms, lists, categories, sorting, and selection |
| `settings/` | Settings modal, shared section controls, notifications, and communications |
| `settings/business/` | Business details, hours, holidays, location, and booking settings |
| `settings/preferences/` | Language, formatting, theme, and accent controls |
| `settings/profile/` | Profile settings headers, tabs, and preferences |
| `team/` | Team members, invitations, access, working hours, breaks, and time off |
| `ui/` | Existing coss primitives; unchanged by this reorganization |

Feature-specific hooks and types stay beside their components, such as `services/use-service-order.ts` and `team/team-types.ts`. Shared compositions of UI primitives belong in the appropriate component folder, rather than `ui/`.

See [page layouts](../app/components/layout/page-layout.md) and [calendar details](../app/components/calendar/README.md) for their local conventions.

## Library

| Folder | Contents |
| --- | --- |
| `auth/` | Better Auth client/server setup, permissions, redirects, and email locale |
| `billing/` | Plans, subscription helpers, and Stripe integration |
| `booking/` | Shared booking calendar, status, colors, and public booking loader support |
| `browser/` | Platform detection, keyboard focus, and offline document generation |
| `business/` | Business holiday rules |
| `calendar/` | Calendar types, availability, scheduling, drag calculations, and cache helpers |
| `database/` | Prisma client, generated ID handling, and ID generation |
| `email/` | Email provider delivery |
| `email-templates/` | Email rendering, translations, and template data |
| `forms/` | Shared input logic, such as time picker parsing |
| `hooks/` | Shared app hooks for context, preferences, loading, access, and scrolling |
| `http/` | Server cookie handling |
| `localization/` | Locale synchronization, date/number formatting, countries, currencies, and timezones |
| `localization/data/` | Country, currency, dialing code, and timezone JSON datasets |
| `overview/` | Dashboard greeting time calculations |
| `preferences/` | Theme, background settings, avatar colors, and settings save queue |
| `query/` | Shared query cache helpers |
| `routing/` | Navigation definitions, page layout resolution, sheet state, and revalidation |
| `schemas/` | Zod schemas grouped by feature |
| `services/` | Service ordering logic |
| `team/` | Invitation joining, breaks, and time off logic |
| `trpc/` | tRPC server/client and TanStack Query setup |
| `validation/` | Localized Zod setup |

Keep `.server.ts` suffixes on server-only modules. Client components must not import runtime server modules. Type-only imports remain appropriate where needed. Database access belongs behind tRPC server code; route loaders should use the tRPC caller rather than importing Prisma directly.

## Root files required by UI primitives

The existing primitives import several files outside `components/ui` directly. These files retain their original paths so `components/ui` can remain untouched:

- `app/components/icons.tsx`: shared icon map and icon component
- `app/components/dialog-popup-styles.ts` and `sheet-popup-styles.ts`: popup geometry and styling
- `app/components/drawer-dropdown-state.tsx`: coordination between drawers and dropdowns
- `app/lib/utils.ts`: `cn` and shared utility functions, also exposed through `@coss/ui/lib/utils`
- `app/lib/hooks.ts`: existing shared hooks used by primitives
- `app/lib/toast.ts`: toast managers and helpers
- `app/lib/use-hydrated.ts`, `use-overlay-open.ts`, and `use-sheet-open.ts`: hydration and overlay state used by primitives

These are deliberate exceptions. Place new files in a folder instead of adding more root modules. No compatibility re-export files are needed for the moved modules.

## Adding and importing files

1. Choose an existing feature folder first. Keep a hook or type used by one feature beside that feature.
2. Put components shared across routes in a shared component folder, such as `forms/`, `overlays/`, or `data-display/`.
3. Put shared non-rendering logic in the relevant library folder. Add a new folder when it represents a distinct responsibility.
4. Import the module directly using its full path. Follow neighboring files for alias or relative import style; avoid catch-all barrel exports that mix client and server modules.
5. When moving a file, update route, server, script, test, build-plugin, and documentation references, including dynamic imports and `ssrLoadModule` paths.

```tsx
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { ResponsiveModal } from "~/components/overlays/responsive-modal"
import { formatDateTime } from "~/lib/localization/format-preference"
import { useAppContext } from "~/lib/hooks/use-app-context"
```

Use RVF through `AppForm` and `FormLabel`, and tRPC with TanStack Query for mutations. React Router loaders handle route and app state. See [data handling](data-handling.md) for details.

After reorganizing modules, run `npm run typecheck`, the relevant existing tests, and `npm run build`. Confirm that `git diff -- app/components/ui` is empty when the UI primitives are outside the scope of the change.
