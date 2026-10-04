# Data Handling

Client data fetching and mutations go through tRPC and TanStack Query.

React Router loaders are reserved for route and app state that belongs to routing, SSR metadata, i18n setup, auth/session state, and similar shell concerns.

Do not use React Router actions for application mutations in this project. For forms that send data to the backend, call a tRPC procedure from the client and manage request state with TanStack Query.

Forms should use RVF through `app/components/app-form.tsx`. Use `AppForm` for the form wrapper and `FormLabel` for field labels, descriptions, and validation errors instead of wiring native submit handlers directly in routes.

Server procedures may validate, log, call services, or persist data as needed. If a form is only an example or diagnostic flow, keep persistence out of the procedure and return an explicit response such as `saved: false`.
