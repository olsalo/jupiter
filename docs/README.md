# Documentation

Documentation is split by what should carry into a new product built from this template.

## Generic template guidance

Keep these conventions when starting another product. Code links refer to the current implementation; update them when the derived app changes its structure or behavior.

| Document | Purpose |
| --- | --- |
| [Code organization](generic/code-organization.md) | Shared component and library boundaries, imports, and placement rules |
| [Data handling](generic/data-handling.md) | SSR, hydration, client navigation, caching, tRPC mutations, and forms |
| [Routing](generic/routing.md) | Explicit React Router route configuration |
| [Resource limits](generic/saas_plan_limits.md) | Reusable design proposal for resource counting and plan enforcement; adapt resources and limits to the product |
| [Contextual labels and errors](generic/saas-ui-copy-contextual-ctas-single-line-errors-2026-10-12.md) | Shared UI copy guidance |
| [Page actions and contextual CTAs](generic/saas-ui-copy-page-ctas-contextual-actions-guide-2026-10-12.md) | Shared action-label guidance |

## Jupiter-specific documentation

These documents describe the scheduling product, its operational setup, or its design history. Review or replace them when deriving another product.

### Current implementation and operations

| Document | Purpose |
| --- | --- |
| [Code map](jupiter/code-map.md) | Current feature and library folder inventory |
| [Data handling](jupiter/data-handling.md) | Calendar refresh, public booking hydration, and route-specific exceptions |
| [Appointment server](jupiter/appointment-server.md) | Scheduling API and server behavior |
| [Email and communications](jupiter/email.md) | Appointment notifications, templates, and provider setup |
| [Booking images](jupiter/booking-image-storage.md) | Image storage setup, uploads, access, and cleanup |
| [Schema integrity](jupiter/schema-integrity.md) | Tenant boundaries, booking history, constraints, and backfills |
| [Security controls](jupiter/security-controls.md) | Implemented controls and deployment requirements |

### Product plans and historical records

These documents preserve proposals, earlier designs, audits, and dated verification. Check current implementation documents and code before treating a proposal or old finding as current behavior.

| Document | Purpose |
| --- | --- |
| [Frontend MVP guide](jupiter/appointment_frontend_mvp_guide_v2.md) | Scheduling frontend design guide |
| [Server MVP plan](jupiter/appointment_mvp_server_implementation_v1.md) | Original scheduling server implementation plan |
| [Public booking information architecture](jupiter/public-booking-page-ia-v1-2026-10-21.md) | Customer booking UX and structure |
| [SaaS information architecture v4](jupiter/saas-mvp-ia-v4-2026-10-12.md) | Later scheduling product architecture proposal |
| [SaaS information architecture v3](jupiter/saas-mvp-ia-v3-2026-10-12.md) | Earlier scheduling product architecture proposal |
| [Form builder architecture](jupiter/refactor.md) | Separate feature proposal, not a shared template requirement |
| [Usability verification](jupiter/usability-testing-2026-10-22.md) | Dated UI and booking verification results |
| [Security audit](jupiter/security-abuse-audit-2026-10-29.md) | Original findings; follow-up implementation is documented in security controls |
| [Screenshots](jupiter/screenshots/) | Existing product reference images |

## Adding documentation

- Put reusable architecture, coding conventions, and UI guidance in `generic/`
- Put domain rules, feature inventories, deployment details tied to Jupiter, and product history in `jupiter/`
- Split mixed documents into shared rules and a linked product-specific companion
- Link new documents from this index and keep relative code links valid
- Describe proposals and historical results as such rather than presenting them as implemented behavior
