import { organizationAccessControl, organizationRoles } from "~/lib/auth/permissions"
import { fetchWithSubmissionRecovery } from "~/lib/browser/submission-recovery"
import { createAuthClient } from "better-auth/react"
import { i18nClient } from "@better-auth/i18n/client"
import { stripeClient } from "@better-auth/stripe/client"
import {
  emailOTPClient,
  organizationClient,
} from "better-auth/client/plugins"

export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: fetchWithSubmissionRecovery },
  plugins: [
    i18nClient(),
    emailOTPClient(),
    organizationClient({ ac: organizationAccessControl, roles: organizationRoles }),
    stripeClient({ subscription: true }),
  ],
})
