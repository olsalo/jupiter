# Jupiter billing and Stripe setup

Jupiter has one subscription per business, with all core booking features included.

| Product | Monthly price | Annual price | Environment variables |
| --- | --- | --- | --- |
| Jupiter Solo | EUR 40 | EUR 400 | `STRIPE_SOLO_PRICE_ID`, `STRIPE_SOLO_ANNUAL_PRICE_ID` |
| Jupiter Team | EUR 80 | EUR 800 | `STRIPE_TEAM_PRICE_ID`, `STRIPE_TEAM_ANNUAL_PRICE_ID` |
| Additional bookable person | EUR 15 per person | EUR 150 per person | `STRIPE_EXTRA_STAFF_PRICE_ID`, `STRIPE_EXTRA_STAFF_ANNUAL_PRICE_ID` |

## Stripe products and prices

Create these three products in Stripe. Each has a fixed recurring EUR price, billed in advance, with tax behavior set to **exclusive**. Use quantity-based licensed billing for the additional-person product, with no tiers or metering. Use the appropriate software/SaaS tax code for each product. The app verifies the configured price amount, currency, interval, billing type and tax behavior before checkout or plan changes.

Solo includes one active bookable person. Team includes three. Additional-person quantity is the number of purchased places beyond those three. Admin and reception accounts are free unless they take appointments. Jupiter does not use Better Auth's automatic organization-member seat billing because account membership and bookability are separate.

Monthly billing requires all three monthly price IDs plus `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Annual billing appears only when all three annual price IDs are configured. Copy the `price_...` IDs, not the `prod_...` IDs, into `.env` and deployment settings. Test and live mode need their own products, prices, API keys and webhook secrets. Restart the app after changing settings.

When Stripe is configured, subscription access and staff limits work the same in development and production. Development can open the workspace without completing onboarding, but an inactive subscription leaves it read-only and disables public booking. In non-production environments, `DEMO_BYPASS_ONBOARDING_PAYMENT=true` makes the normal plan button activate the selected plan locally without a Stripe charge, both in onboarding and billing settings. The demo subscription lasts 30 days and uses the selected plan's bookable-person capacity. With the flag set to `false`, plan changes use Stripe. Production ignores demo subscriptions and always uses Stripe. The subscription onboarding step can be revisited in development to replace a demo plan.

Plan selection uses Jupiter's plan catalog and does not fetch Stripe prices while rendering. Checkout verifies the configured Stripe prices before creating a session. If Stripe reports `resource_missing` or `No such price`, copy the price IDs from the same Stripe account and test/live mode as the API key, then update the environment and restart the app. A price ID from another account or mode cannot be used with the current key.

## Taxes and Checkout

Complete Stripe Tax setup, including the business address, product tax codes and applicable tax registrations. Checkout collects the billing address and tax ID and enables automatic tax. Prices shown in Jupiter exclude VAT; Stripe calculates the applicable tax. The app does not hardcode a tax percentage. Confirm tax behavior with both domestic and cross-border test customers before accepting live payments.

The initial checkout includes a 14-day trial for a business with no previous Stripe subscriptions and collects a payment method. Cancelling checkout does not consume the trial. A business with a previous subscription does not receive another trial. Checkout requires a card; the no-card trial proposal is not part of this implementation.

## Webhook

Create a Stripe webhook pointing to:

```text
https://YOUR_APP_DOMAIN/api/auth/stripe/webhook
```

Use the app domain configured in `BETTER_AUTH_URL`. Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET`. Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `subscription_schedule.created`
- `subscription_schedule.updated`
- `subscription_schedule.released`
- `subscription_schedule.canceled`
- `subscription_schedule.completed`

Subscription updates include trial, payment-status and pending-upgrade changes. Schedule events reconcile allowances when a scheduled change is modified externally. Webhook processing retrieves the latest subscription state to avoid applying older event snapshots. Billing settings also reconcile state when opened, so missed webhooks can recover.

For local testing, forward these events with Stripe CLI to `http://localhost:5175/api/auth/stripe/webhook` and use the CLI's signing secret. No Stripe resources are created automatically except customers, subscriptions, checkout sessions, subscription schedules and a restricted billing-portal configuration when needed.

## Plan changes

The business explicitly purchases capacity. Creating or editing a staff profile never silently increases the bill. At capacity, the form directs the user to billing settings. Only active profiles with `acceptsAppointments: true` consume capacity. Staff creation and reactivation are checked under the existing organization lock, including linked accounts and self-profile edits.

Upgrades within the same billing interval apply immediately with an invoiced prorated charge. A failed payment or authentication requirement leaves the old capacity in place until Stripe applies the pending update. Jupiter opens the hosted invoice when payment needs attention.

Reductions and interval changes take effect at renewal through a Stripe subscription schedule. Enough bookable profiles must first be deactivated. When a reduction is scheduled, the lower capacity is reserved immediately so newly added profiles cannot invalidate it. Appointments, customer records and inactive staff history are preserved. Confirming the current plan cancels an existing scheduled change.

Jupiter creates a billing-portal configuration with invoice history, payment-method updates and cancellation at period end. Subscription-price changes are disabled in that portal, and Better Auth's generic upgrade and portal endpoints are blocked. Plan changes go through permission-checked tRPC mutations and server-side capacity validation.

No legacy Pro subscription migration is included. The existing subscription `plan`, `seats` and `stripeScheduleId` fields are reused, so there are no database schema changes.

## Verification before live use

Test Solo and Team checkout, Team with additional people, annual billing, billing-address and tax-ID collection, successful and failed prorated upgrades, authentication-required payments, scheduled reductions, cancellation/restoration and webhook delivery/retries in Stripe test mode. Check that a successful return from Checkout is followed by an active/trialing local subscription before entering the app.

## Implementation files

Files changed for the Solo/Team implementation:

- Pricing and Stripe integration: [plans.ts](../../app/lib/billing/plans.ts), [stripe.server.ts](../../app/lib/billing/stripe.server.ts), [subscriptions.server.ts](../../app/lib/billing/subscriptions.server.ts), [billing.server.ts](../../app/lib/billing/billing.server.ts), [auth/server.ts](../../app/lib/auth/server.ts), [billing schema](../../app/lib/schemas/billing.ts)
- API and staff enforcement: [billing router](../../app/.server/routers/billing.ts), [onboarding router](../../app/.server/routers/onboarding.ts), [staff router](../../app/.server/routers/staff.ts), [team router](../../app/.server/routers/team.ts), [team service](../../app/.server/services/team.ts)
- Resource limits: [config.ts](../../app/.server/resource-limits/config.ts), [errors.ts](../../app/.server/resource-limits/errors.ts), [registry.ts](../../app/.server/resource-limits/registry.ts), [service.ts](../../app/.server/resource-limits/service.ts), [types.ts](../../app/.server/resource-limits/types.ts)
- UI: [billing-plan-form.tsx](../../app/components/billing/billing-plan-form.tsx), [settings-modal.tsx](../../app/components/settings/settings-modal.tsx), [team-person-form.tsx](../../app/components/team/team-person-form.tsx), [subscription.tsx](../../app/routes/onboarding/subscription.tsx), [layout.tsx](../../app/routes/layout.tsx), [English labels](../../app/locales/en/common.json), [Finnish labels](../../app/locales/fi/common.json)
- Setup and documentation: [.env.example](../../.env.example), [README.md](../../README.md), [package.json](../../package.json), [template limits note](../generic/saas_plan_limits.md), [this guide](billing.md)
- Tests: [billing-plans.test.ts](../../tests/billing-plans.test.ts), [billing-plan-form.integration.ts](../../tests/billing-plan-form.integration.ts), [resource-limits.integration.ts](../../tests/resource-limits.integration.ts), [onboarding-data.integration.ts](../../tests/onboarding-data.integration.ts), [onboarding-routing.integration.ts](../../tests/onboarding-routing.integration.ts), [security-abuse.integration.ts](../../tests/security-abuse.integration.ts)
