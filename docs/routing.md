# Routing

This app uses React Router Framework Mode with explicit route configuration in `app/routes.ts`.

Routes are not inferred from filenames. A URL exists only when `app/routes.ts` declares it with helpers from `@react-router/dev/routes`, such as `route`, `index`, or `layout`.

Data handling conventions are documented in `docs/data-handling.md`. In short: use React Router loaders for route/app state only, and use tRPC with TanStack Query for client data fetching and mutations. Do not add React Router actions for application form submissions.

The first argument is the URL pattern. The second argument is the route module file:

```ts
route("/auth", "routes/auth.tsx")
```

That maps `/auth` to `app/routes/auth.tsx`. The file could be named differently if `routes.ts` points to it.

Nested routes are declared as children:

```ts
route("/", "routes/layout.tsx", [
  index("routes/dashboard.tsx"),
])
```

Here `/` renders `routes/layout.tsx`, and the index child renders `routes/dashboard.tsx` inside the layout route's `<Outlet />`.

Auth is intentionally one public route:

```ts
route("/auth", "routes/auth.tsx")
```

Login and signup are handled by the same route module. Do not add separate `auth.login.tsx` or `auth.signup.tsx` modules unless `app/routes.ts` explicitly declares separate URLs for them.
