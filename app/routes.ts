import { type RouteConfig, index, route } from "@react-router/dev/routes"

export default [
  route("/", "routes/layout.tsx", [
    index("routes/overview.tsx"),
    route("example", "routes/example/example.tsx", [
      route("new", "routes/example/new-note-modal.tsx"),
      route(":noteId", "routes/example/note-modal.tsx", [
        index("routes/example/note-view.tsx"),
        route("edit", "routes/example/note-edit.tsx"),
      ]),
    ]),
    route("team", "routes/team.tsx"),
  ]),
  route("/auth", "routes/auth.tsx"),
  route("/invite/:invitationId", "routes/invite.tsx"),
  route("/onboarding", "routes/onboarding/onboarding.tsx", [
    route("business", "routes/onboarding/business.tsx"),
    route("subscription", "routes/onboarding/subscription.tsx"),
  ]),
  route("api/locale", "routes/api/locale.ts"),
  route("api/format-preference", "routes/api/format-preference.ts"),
  route("api/theme", "routes/api/theme.ts"),
  route("api/auth/*", "routes/api/auth.ts"),
  route("api/trpc/*", "routes/api/trpc.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig
