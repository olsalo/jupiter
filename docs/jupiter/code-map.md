# Jupiter code map

This inventory describes the current scheduling product. Follow the shared [code organization rules](../generic/code-organization.md) when adding or moving modules. Template-derived projects should keep those rules and replace this inventory with their own feature folders.

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

See [page layouts](../../app/components/layout/page-layout.md) and [calendar details](../../app/components/calendar/README.md) for their local conventions.

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

