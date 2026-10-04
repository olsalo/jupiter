# App template

A TypeScript app template built with React Router, tRPC, TanStack Query, Prisma, Better Auth, and coss UI.

The app includes sign-in, onboarding, teams, settings, billing, English and Finnish translations, and two layout styles. The overview contains placeholder content, and the Notes example shows a working list with modal create and edit flows.

## Getting started

Install dependencies with `npm ci`, configure the environment using `.env.example`, then run `npm run db:generate` and `npm run dev`.

The development app runs at `http://localhost:5174`.

## Starting points

- `app/routes.ts`: app routes
- `app/routes/overview.tsx`: overview placeholder
- `app/routes/example.tsx`: Notes example
- `app/routes/layout.tsx`: navigation and app layout
- `app/components`: reusable app components
- `app/components/ui`: coss primitives
- `app/locales`: English and Finnish UI text
- `app/.server/routers`: tRPC queries and mutations

The template uses `prisma/schema_blank.prisma`, which contains the shared app models without the form builder feature.

Use React Router loaders for route state and tRPC with TanStack Query for fetching data and submitting changes. See `AGENTS.md` for project conventions.

## Checks and builds

- `npm run typecheck`: generate route types and check TypeScript
- `npm run build`: create the production build
- `npm run start`: serve the production build
