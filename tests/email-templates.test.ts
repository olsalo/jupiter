import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/email-templates", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const originalFetch = globalThis.fetch
try {
  const { createOtpEmailTemplate } = await vite.ssrLoadModule("/app/lib/email-templates/otp.ts") as typeof import("../app/lib/email-templates/otp")
  const { createInvitationEmailTemplate } = await vite.ssrLoadModule("/app/lib/email-templates/invitation.ts") as typeof import("../app/lib/email-templates/invitation")
  const { createAppointmentEmailTemplate } = await vite.ssrLoadModule("/app/lib/email-templates/appointment.ts") as typeof import("../app/lib/email-templates/appointment")
  const { sendEmail } = await vite.ssrLoadModule("/app/lib/email.server.ts") as typeof import("../app/lib/email.server")
  for (const locale of ["fi", "en"] as const) {
    for (const type of ["sign-in", "email-verification", "forget-password", "change-email"] as const) {
      const template = await createOtpEmailTemplate({ locale, type, expiresInMinutes: 5, otp: "12<34&" })
      assert.match(template.html, new RegExp(`<html[^>]*lang="${locale}"`))
      assert.ok(template.html.includes("12&lt;34&amp;"))
      assert.ok(template.text.includes("12<34&"))
      assert.ok(template.text.includes("5"))
      assert.ok(template.subject.length)
    }
    for (const kind of ["BOOKING_CONFIRMATION", "CANCELLATION", "RESCHEDULE", "REMINDER"] as const) {
      const template = await createAppointmentEmailTemplate({ kind, locale, organizationName: "Kädet & Co", services: ["Service <one>", "Service two"], startsAt: new Date("2026-11-01T10:00:00Z"), timezone: "Europe/Helsinki", country: "FI", bookingCode: "BOOKING-123", rescheduleUrl: "https://example.invalid/booking/BOOKING-123/reschedule", managementUrl: "https://example.invalid/booking/BOOKING-123" })
      const subjects = locale === "fi"
        ? { BOOKING_CONFIRMATION: "Varaus vastaanotettu", CANCELLATION: "Varaus peruttu", RESCHEDULE: "Varausaika muutettu", REMINDER: "Muistutus varauksesta" }
        : { BOOKING_CONFIRMATION: "Booking received", CANCELLATION: "Booking cancelled", RESCHEDULE: "Booking rescheduled", REMINDER: "Appointment reminder" }
      assert.equal(template.subject, subjects[kind])
      assert.ok(template.html.includes('href="https://example.invalid/booking/BOOKING-123"'))
      assert.ok(template.text.includes(locale === "fi" ? "Näytä varaus" : "View appointment"))
      if (kind === "CANCELLATION") {
        assert.ok(!template.html.includes("https://example.invalid/booking/BOOKING-123/reschedule"))
      } else {
        assert.ok(template.html.includes('href="https://example.invalid/booking/BOOKING-123/reschedule"'))
        assert.ok(template.text.includes("https://example.invalid/booking/BOOKING-123/reschedule"))
        assert.ok(template.text.includes(locale === "fi" ? "Siirrä aikaa" : "Reschedule appointment"))
      }
      assert.match(template.html, new RegExp(`<html[^>]*lang="${locale}"`))
      assert.ok(template.html.includes("Service &lt;one&gt;, Service two"))
      assert.ok(template.text.includes("Service <one>, Service two"))
      assert.ok(template.text.includes(`${locale === "fi" ? "Varauskoodi" : "Booking code"}: BOOKING-123`))
    }
    const invitation = await createInvitationEmailTemplate({ locale, organizationName: '<script>alert("x")</script> & Kädet', inviteUrl: "https://example.invalid/invite/123", })
    assert.ok(!invitation.html.includes('<script>alert("x")</script>'))
    assert.ok(invitation.html.includes("&lt;script&gt;"))
    assert.ok(invitation.text.includes("https://example.invalid/invite/123"))
    assert.ok(invitation.text.includes(locale === "fi" ? "Liity tiimiin" : "Join the team"))
  }
  // Mock provider requests: this test never sends an email
  process.env.EMAIL_FROM = "Jupiter <verified@example.invalid>"
  process.env.EMAIL_OVERRIDE_TO = "override@example.invalid"
  process.env.PLUNK_API_KEY = "test-key"
  process.env.RESEND_API_KEY = "re_test"
  const message = { to: "customer@example.invalid", senderName: "Kädet & Co", replyTo: "reply@example.invalid", subject: "Test", text: "Hello", html: "<p>Hello</p>" }
  const requests: { url: string; body: Record<string, unknown> }[] = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return Response.json({ id: "test-message", success: true })
  }
  process.env.EMAIL_PROVIDER = "plunk"
  await sendEmail(message)
  assert.deepEqual(requests[0].body.from, { name: message.senderName, email: "verified@example.invalid" })
  assert.equal(requests[0].body.reply, message.replyTo)
  assert.equal(requests[0].body.to, "override@example.invalid")
  process.env.EMAIL_PROVIDER = "resend"
  await sendEmail(message)
  assert.equal(requests[1].body.from, '"Kädet & Co" <verified@example.invalid>')
  assert.equal(requests[1].body.to, "override@example.invalid")
  assert.equal(requests[1].body.reply_to, message.replyTo)
  assert.equal(requests[1].body.text, message.text)
  globalThis.fetch = async () => Response.json({ success: false, error: { message: "Rejected" }, name: "validation_error", message: "Rejected" }, { status: 422 })
  for (const provider of ["plunk", "resend"]) {
    process.env.EMAIL_PROVIDER = provider
    await assert.rejects(sendEmail(message), /email delivery failed/)
  }
  process.env.NODE_ENV = "production"
  process.env.EMAIL_PROVIDER = ""
  await assert.rejects(sendEmail(message), /EMAIL_PROVIDER is required/)
  console.info("PASS Finnish and English OTP/invitation templates, HTML escaping, plain text, mocked Plunk/Resend sending, sender/reply-to, recipient override and provider failures")
} finally {
  globalThis.fetch = originalFetch
  await vite.close()
}
