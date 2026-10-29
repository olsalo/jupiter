# App template

A TypeScript app template built with React Router, tRPC, TanStack Query, Prisma, Better Auth, and coss UI.

The app includes sign-in, onboarding, teams, settings, billing, English and Finnish translations, and two layout styles. The overview contains placeholder content, and the Notes example shows a working list with modal create and edit flows.

## Getting started

Install dependencies with `npm ci`, copy `.env.example` to `.env`, then configure the required settings below. Run `npm run db:generate` and `npm run dev`.

The development app runs at `http://localhost:5175`.

### Environment settings

For local development, set `DATABASE_URL` to your PostgreSQL connection string and `BETTER_AUTH_SECRET` to a random secret generated with `openssl rand -base64 32`. Keep `BETTER_AUTH_URL=http://localhost:5175` unless you use another address. In production, set it to the full public app URL.

Email is optional locally: leave `EMAIL_PROVIDER` blank to print sign-in codes in the server console. Production sign-in and email delivery require `EMAIL_PROVIDER` (`plunk` or `resend`), the matching `PLUNK_API_KEY` or `RESEND_API_KEY`, and `EMAIL_FROM` with a verified sender address.

The remaining settings are optional:

- **Billing:** set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRO_PRICE_ID` together. Add `STRIPE_PRO_ANNUAL_PRICE_ID` for annual billing. Leave the Stripe settings blank to disable billing.
- **IP location:** set `LOCATION_API_KEY` to enable lookups. `LOCATION_API_URL` already has a built-in default.
- **Appearance:** `APP_LAYOUT_STYLE` accepts `floating` or `classic` and defaults to `classic`. Rebuild the production app after changing it.
- **Other options:** additional auth hosts, test email recipients, demo checkout bypass, mockup generation, and a trusted booking IP header are described beside their settings in `.env.example`.

## Barber shop demo data

After configuring `DATABASE_URL` in `.env`, sync the database and seed a demo business:

```sh
npm run db:push
npm run db:generate
npm run db:seed:barber -- --owner-name "John Smith" --owner-email "john@example.com"
```

This creates **Oak & Steel Barbers** with the specified non-bookable owner and five English-named barbers, eight services in three categories, a Helsinki location, a booking page, and 360 customers with regular-customer tags and grooming notes. The shop opens Monday–Saturday, with shorter Mondays and Saturdays. Barbers have different working days and shifts, with zero to three breaks per shift lasting 10–45 minutes.

The calendar contains appointments from four weeks ago through two weeks ahead, including completed visits with manual payments, cancellations, no-shows and upcoming bookings. Every appointment, including its cleanup buffer, fits both shop hours and the barber's shift, avoids breaks, and respects the Finnish holiday closures configured through the app's holiday calendar. Dates follow `Europe/Helsinki`, including daylight saving changes and holidays across year boundaries. Bookings leave gaps for trying new appointments, and customers return no sooner than three weeks after their previous visit.

Sign in using the owner's email through the normal email code flow and select **Oak & Steel Barbers**. An existing user with that email is reused without changing their profile or login details. New accounts use English. If Stripe billing is configured, set `DEMO_BYPASS_ONBOARDING_PAYMENT=true` locally to open the demo without checkout. The seed does not create Stripe customers or subscriptions, send invitations, or queue emails. Booking emails and reminders are disabled for this business, and fictional contact addresses use `example.invalid`.

Each owner email gets a separate demo business. Running the command again for the same email leaves its data unchanged, including any edits you have made. The seed runs in one transaction and does not clear existing data. Use `npm run db:seed:barber -- --help` for usage.

Run `npm run test:barber-seed` to check the dataset without a database. `npm run test:barber-seed:integration` creates and removes a disposable demo in the configured database to verify actual writes and repeat runs.

## Starting points

- `app/routes.ts`: app routes
- `app/routes/overview.tsx`: overview placeholder
- `app/routes/example.tsx`: Notes example
- `app/routes/layout.tsx`: navigation and app layout
- `app/components`: reusable app components
- `app/components/ui`: coss primitives
- `app/locales`: English and Finnish UI text
- `app/.server/routers`: tRPC queries and mutations

See the [documentation index](docs/README.md) for generic template guidance and Jupiter-specific documentation. Start with [code organization](docs/generic/code-organization.md), [data handling](docs/generic/data-handling.md), and [routing](docs/generic/routing.md). The [Jupiter code map](docs/jupiter/code-map.md) lists the current feature folders.

The template uses `prisma/schema_blank.prisma`, which contains the shared app models without the form builder feature.

Use React Router loaders for route state and tRPC with TanStack Query for fetching data and submitting changes. See `AGENTS.md` for project conventions.

## Checks and builds

- `npm run typecheck`: generate route types and check TypeScript
- `npm run build`: create the production build
- `npm run start`: serve the production build, loading `.env` if present (existing environment variables take precedence)
