export type PlanLocale = "en" | "fi"

export const plans = [
  {
    features: {
      en: [
        "Unlimited team members",
        "Bookings and work schedules",
        "Time tracking and approvals",
        "Invoices and exports",
      ],
      fi: [
        "Rajattomasti tiimin jäseniä",
        "Varaukset ja työvuorot",
        "Työajanseuranta ja hyväksynnät",
        "Laskut ja viennit",
      ],
    },
    id: "pro",
    name: "Pro",
  },
] as const

export const proPlan = plans[0]

export type PlanId = (typeof plans)[number]["id"]
