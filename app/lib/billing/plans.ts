export type PlanLocale = "en" | "fi"

const features = {
  en: ["Unlimited bookings, customers and services", "Online booking pages", "Customer notes and intake forms", "Availability, breaks and time off", "Booking emails and reminders"],
  fi: ["Rajattomasti varauksia, asiakkaita ja palveluita", "Nettiajanvaraussivut", "Asiakasmuistiinpanot ja esitiedot", "Työajat, tauot ja vapaat", "Varausviestit ja muistutukset sähköpostilla"],
}

export const plans = [
  { id: "solo", name: "Solo", includedStaff: 1, monthlyAmount: 4000, annualAmount: 40000, features },
  { id: "team", name: "Team", includedStaff: 3, monthlyAmount: 8000, annualAmount: 80000, features },
] as const

export type PlanId = (typeof plans)[number]["id"]
export const extraStaffPrice = { month: 1500, year: 15000 } as const

export function isPlanId(value: string): value is PlanId {
  return plans.some((plan) => plan.id === value)
}

export function getPlan(planId: PlanId) {
  return plans.find((plan) => plan.id === planId)!
}

export function getPlanCapacity(planId: PlanId, extraStaff: number) {
  return getPlan(planId).includedStaff + (planId === "team" ? extraStaff : 0)
}

export function getPlanAmount(planId: PlanId, interval: "month" | "year", extraStaff: number) {
  const plan = getPlan(planId)
  return (interval === "year" ? plan.annualAmount : plan.monthlyAmount) + (planId === "team" ? extraStaff * extraStaffPrice[interval] : 0)
}
