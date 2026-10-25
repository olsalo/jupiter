import assert from "node:assert/strict"
import { shouldRevalidateRootRoute, shouldRevalidateWorkspaceRoute } from "../app/lib/routing/should-revalidate.ts"

const url = (path: string) => new URL(path, "https://example.invalid")
const revalidates = (current: string, next: string, formMethod?: "GET" | "POST") => shouldRevalidateWorkspaceRoute({ currentUrl: url(current), nextUrl: url(next), formMethod })

for (const [current, next] of [
  ["/team/person", "/team/person?profileTab=services"],
  ["/team/person?profileTab=services", "/team/person?profileTab=about"],
  ["/team/person/edit?editTab=profile", "/team/person/edit?editTab=availability&profileTab=availability"],
  ["/customers/customer?search=Aino", "/customers/customer?search=Aino&customerTab=appointments"],
  ["/customers/customer?customerTab=appointments", "/customers/customer"],
  ["/customers", "/customers/customer"],
  ["/customers/customer", "/customers/customer/edit"],
  ["/customers/customer/edit", "/customers/customer"],
  ["/customers/customer", "/customers"],
  ["/team/person", "/team/other?profileTab=services"],
  ["/team/person", "/team/person/edit"],
  ["/team", "/team/new"],
  ["/services", "/services/service/edit"],
  ["/booking-page/page/edit", "/booking-page"],
  ["/example/note", "/example/note/edit"],
  ["/calendar?date=2026-10-24", "/calendar/new?date=2026-10-24"],
  ["/calendar/appointment/edit?date=2026-10-24", "/calendar?date=2026-10-24"],
  ["/team/person", "/customers/customer"],
  ["/unknown", "/unknown/drawer"],
  ["/customers/customer?search=Aino", "/customers/customer?search=Matti&customerTab=appointments"],
  ["/team?tab=members", "/team?tab=invites"],
  ["/calendar?date=2026-10-24", "/calendar/new?date=2026-10-25"],
]) {
  assert.equal(revalidates(current, next), false, `No workspace request for tab navigation from ${current} to ${next}`)
}

for (const [current, next] of [
  ["/team/person?profileTab=services", "/team/person?profileTab=services"],
  ["/calendar", "/calendar"],
  ["/services?search=hair", "/services?search=hair"],
]) {
  assert.equal(revalidates(current, next), true, `Keep workspace checks from ${current} to ${next}`)
}

assert.equal(revalidates("/team/person", "/team/person?profileTab=services", "POST"), true)
assert.equal(revalidates("/team/person", "/team/person/edit", "POST"), true)
assert.equal(revalidates("/team/person", "/team/person?profileTab=services", "GET"), false)

const workspaceRoutes = ["/calendar", "/customers", "/services", "/booking-page", "/team", "/team-original", "/example"]
for (const current of workspaceRoutes) {
  for (const next of workspaceRoutes) {
    assert.equal(revalidates(current, next), current === next, `Only explicit same-page navigation revalidates ${current} to ${next}`)
  }
}

for (const [current, next] of [["/auth", "/calendar"], ["/calendar", "/auth"], ["/onboarding/subscription", "/calendar"], ["/invite/invitation", "/calendar"]]) {
  assert.equal(shouldRevalidateRootRoute({ currentUrl: url(current), nextUrl: url(next), defaultShouldRevalidate: true } as Parameters<typeof shouldRevalidateRootRoute>[0]), true, "Account transitions refresh session and business state")
}

console.log("PASS workspace route changes, filters and drawers skip shared loading while explicit revalidation and mutations retain checks")
