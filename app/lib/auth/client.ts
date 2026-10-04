import { createAuthClient } from "better-auth/react"
import { i18nClient } from "@better-auth/i18n/client"
import { stripeClient } from "@better-auth/stripe/client"
import {
  emailOTPClient,
  organizationClient,
} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    i18nClient(),
    emailOTPClient(),
    organizationClient(),
    stripeClient({ subscription: true }),
  ],
})
