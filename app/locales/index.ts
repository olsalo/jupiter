import enCommon from "./en/common.json"
import enAuth from "./en/auth.json"
import enDashboard from "./en/dashboard.json"
import enNotes from "./en/notes.json"
import enNotFound from "./en/not-found.json"
import enOnboarding from "./en/onboarding.json"
import enZod from "./en/zod.json"
import enTeam from "./en/team.json"
import enForms from "./en/forms.json"
import fiCommon from "./fi/common.json"
import fiAuth from "./fi/auth.json"
import fiDashboard from "./fi/dashboard.json"
import fiNotes from "./fi/notes.json"
import fiNotFound from "./fi/not-found.json"
import fiOnboarding from "./fi/onboarding.json"
import fiZod from "./fi/zod.json"
import fiTeam from "./fi/team.json"
import fiForms from "./fi/forms.json"

export const supportedLanguages = ["en", "fi"] as const
export const fallbackLanguage = "en"
export const namespaces = [
  "common",
  "auth",
  "dashboard",
  "notes",
  "notFound",
  "onboarding",
  "zod",
  "team",
  "forms",
] as const

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    notes: enNotes,
    notFound: enNotFound,
    onboarding: enOnboarding,
    zod: enZod,
    team: enTeam,
    forms: enForms,
  },
  fi: {
    common: fiCommon,
    auth: fiAuth,
    dashboard: fiDashboard,
    notes: fiNotes,
    notFound: fiNotFound,
    onboarding: fiOnboarding,
    zod: fiZod,
    team: fiTeam,
    forms: fiForms,
  },
}
