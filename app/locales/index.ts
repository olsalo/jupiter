import enBooking from "./en/booking.json"
import fiBooking from "./fi/booking.json"
import enEmail from "./en/email.json"
import fiEmail from "./fi/email.json"
import enServices from "./en/services.json"
import fiServices from "./fi/services.json"
import enIa from "./en/ia.json"
import fiIa from "./fi/ia.json"
import enCommon from "./en/common.json"
import enAuth from "./en/auth.json"
import enDashboard from "./en/dashboard.json"
import enNotes from "./en/notes.json"
import enNotFound from "./en/not-found.json"
import enOnboarding from "./en/onboarding.json"
import enZod from "./en/zod.json"
import enTeam from "./en/team.json"
import fiCommon from "./fi/common.json"
import fiAuth from "./fi/auth.json"
import fiDashboard from "./fi/dashboard.json"
import fiNotes from "./fi/notes.json"
import fiNotFound from "./fi/not-found.json"
import fiOnboarding from "./fi/onboarding.json"
import fiZod from "./fi/zod.json"
import fiTeam from "./fi/team.json"

export const supportedLanguages = ["en", "fi"] as const
export const fallbackLanguage = "en"
export const namespaces = [
  "booking",
  "email",
  "common",
  "ia",
  "auth",
  "dashboard",
  "notes",
  "notFound",
  "onboarding",
  "zod",
  "team",
  "services",
] as const

export const resources = {
  en: {
    booking: enBooking,
    email: enEmail,
    common: enCommon,
    ia: enIa,
    auth: enAuth,
    dashboard: enDashboard,
    notes: enNotes,
    notFound: enNotFound,
    onboarding: enOnboarding,
    zod: enZod,
    team: enTeam,
    services: enServices,
  },
  fi: {
    booking: fiBooking,
    email: fiEmail,
    common: fiCommon,
    ia: fiIa,
    auth: fiAuth,
    dashboard: fiDashboard,
    notes: fiNotes,
    notFound: fiNotFound,
    onboarding: fiOnboarding,
    zod: fiZod,
    team: fiTeam,
    services: fiServices,
  },
}
