import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  route("/", "routes/layout.tsx", [
    index("routes/overview.tsx"),
    route("example", "routes/example.tsx", [
      route("new", "routes/example-new-note-modal.tsx"),
      route(":noteId", "routes/example-note-modal.tsx"),
    ]),
    route("team", "routes/team.tsx"),
  ]),
  route("/auth", "routes/auth.tsx"),
  route("/invite/:invitationId", "routes/invite.tsx"),
  route("/onboarding", "routes/onboarding.tsx"),
  route("api/locale", "routes/api/locale.ts"),
  route("api/format-preference", "routes/api/format-preference.ts"),
  route("api/theme", "routes/api/theme.ts"),
  route("api/auth/*", "routes/api/auth.ts"),
  route("api/trpc/*", "routes/api/trpc.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
