import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRevalidator } from "react-router"
import { BillingMemberSelection } from "~/components/billing/billing-member-selection"
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import Icon from "~/components/icons"
import { OnboardingActions } from "~/components/onboarding/onboarding-actions"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field"
import { Radio, RadioCard, RadioGroup } from "~/components/ui/radio-group"
import { SegmentedControl, SegmentedControlItem } from "~/components/ui/segmented-control"
import { billingPlanFormSchema, type BillingPlanFormValues, type BillingPlanInput } from "~/lib/schemas/billing"
import { extraStaffPrice, getPlanAmount, getPlanCapacity, plans } from "~/lib/billing/plans"
import { formatDateTime } from "~/lib/localization/format-preference"
import { useAppContext } from "~/lib/hooks/use-app-context"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"

export function BillingPlanForm({ successUrl, onboarding = false }: { successUrl?: string; onboarding?: boolean }) {
  const { t, i18n } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const revalidator = useRevalidator()
  const app = useAppContext()
  const [redirecting, setRedirecting] = useState(false)
  const [selection, setSelection] = useState<{ input: BillingPlanInput; members: { id: string; name: string }[]; count: number; key: number } | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const selectionKey = useRef(0)
  const teamCapacity = useRef<number | null>(null)
  const revealTeamSize = useCallback((element: HTMLDivElement | null) => {
    if (!element || !element.closest('[data-slot="scroll-area-viewport"]')?.contains(document.activeElement)) return
    requestAnimationFrame(() => {
      if (!element.isConnected) return
      const viewport = element.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
      const footer = viewport?.querySelector<HTMLElement>('[data-slot="onboarding-actions"]')
      if (!viewport || !footer) return
      const overlap = element.getBoundingClientRect().bottom - footer.getBoundingClientRect().top + 16
      if (overlap > 0) viewport.scrollBy({ top: overlap, behavior: "instant" })
    })
  }, [])
  useEffect(() => {
    const reset = () => setRedirecting(false)
    window.addEventListener("pageshow", reset)
    return () => window.removeEventListener("pageshow", reset)
  }, [])
  const state = useQuery({ ...trpc.billing.plan.queryOptions(), staleTime: 0 })
  const save = useMutation(trpc.billing.savePlan.mutationOptions())
  const locale = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const money = (amount: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount / 100)
  const dailyMoney = (amount: number, interval: "month" | "year") => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100 * (interval === "month" ? 12 : 1) / 365)

  if (state.isError) return <Alert><AlertTitle>{t("settings.billingPlanLoadError")}</AlertTitle><AlertAction><Button disabled={state.isFetching} onClick={() => void state.refetch()} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert>
  if (!state.data) return null
  const data = state.data
  const initial = data.pending ?? data.current
  const initialPlanId = initial?.planId ?? (data.used > 1 ? "team" : "solo")
  const suggestedTeamCapacity = Math.max(3, data.used, initial?.planId === "team" ? initial.capacity : 0)
  teamCapacity.current ??= suggestedTeamCapacity
  const defaults: BillingPlanFormValues = {
    planId: initialPlanId,
    interval: data.annualEnabled ? initial?.interval ?? "month" : "month",
    bookablePeople: initialPlanId === "team" ? suggestedTeamCapacity : 1,
  }

  const chooseMembers = async (input: BillingPlanInput) => {
    const members = await queryClient.fetchQuery({ ...trpc.billing.bookableMembers.queryOptions(), staleTime: 0 })
    const count = members.length - getPlanCapacity(input.planId, input.extraStaff)
    if (count <= 0) return false
    setSelection({ input, members, count, key: ++selectionKey.current })
    setSelectionOpen(true)
    return true
  }

  const submitPlan = async (input: BillingPlanInput) => {
    try {
      const result = await save.mutateAsync({ ...input, interval: data.annualEnabled ? input.interval : "month", locale, returnUrl: successUrl ?? window.location.href, cancelUrl: window.location.href })
      if (result.url || (onboarding && successUrl && !result.paymentPending)) {
        setRedirecting(true)
        window.location.assign(result.url ?? successUrl!)
        return true
      }
      toast.success(t(result.paymentPending ? "settings.billingPaymentPending" : result.scheduled ? "settings.billingPlanScheduled" : "settings.billingPlanUpdated"))
      await Promise.all([
        queryClient.invalidateQueries(trpc.billing.pathFilter()),
        queryClient.invalidateQueries(trpc.resourceLimits.pathFilter()),
        queryClient.invalidateQueries(trpc.team.pathFilter()),
        queryClient.invalidateQueries(trpc.staff.pathFilter()),
        queryClient.invalidateQueries(trpc.appointment.pathFilter()),
        queryClient.invalidateQueries(trpc.availability.pathFilter()),
        queryClient.invalidateQueries(trpc.onboarding.status.queryFilter()),
        queryClient.invalidateQueries(trpc.profile.pathFilter()),
      ])
      await revalidator.revalidate()
      return true
    } catch (error) {
      if (error && typeof error === "object" && "data" in error && (error.data as { appCode?: string })?.appCode === "capacityTooSmall") {
        if (await chooseMembers(input)) return false
      }
      toast.error(t("settings.billingActionError"))
      throw error
    }
  }

  return (
    <>
      <AppForm<BillingPlanFormValues, BillingPlanInput, unknown>
        className="gap-0"
        defaultValues={defaults}
        schema={billingPlanFormSchema}
        submitFn={async (input) => {
          try {
            if (await chooseMembers(input)) return
          } catch (error) {
            toast.error(t("settings.billingActionError"))
            throw error
          }
          await submitPlan(input)
        }}
      >
        {(form) => {
          const input = form.value()
          const submitting = form.formState.isSubmitting || redirecting
          const disabled = submitting
          const plan = form.getControlProps("planId")
          const interval = form.getControlProps("interval")
          const people = form.getControlProps("bookablePeople")
          const billingInterval = data.annualEnabled ? input.interval : "month"
          const count = input.planId === "team" ? Math.max(3, Number(input.bookablePeople) || 3) : 1
          const unchanged = Boolean(initial && input.planId === initial.planId && billingInterval === initial.interval && count === initial.capacity)
          const extraPeople = input.planId === "team" ? count - 3 : 0
          const total = getPlanAmount(input.planId, billingInterval, extraPeople)
          const annualSaving = getPlanAmount(input.planId, "month", extraPeople) * 12 - getPlanAmount(input.planId, "year", extraPeople)
          const submitButton = <Button className={onboarding ? undefined : "w-full"} disabled={disabled || unchanged} loading={submitting} type="submit">
            {t(data.current ? "settings.billingConfirmPlan" : onboarding ? "settings.billingContinueCheckout" : "settings.billingSubscribe")}
            {onboarding ? <Icon aria-hidden={true} name="chevronRight" size={16} /> : null}
          </Button>
          const checkoutNote = !data.current ? <p className="mt-3 whitespace-nowrap text-center text-[10px] font-medium leading-5 text-muted-foreground min-[375px]:text-[11px] sm:text-xs">
            {data.trialEligible ? <>
              {t("settings.billingTrialPeriod")} · {t("settings.billingNoChargeToday")} · {t("settings.billingCancelAnytime")}
            </> : t("settings.billingCancelAnytime")}
          </p> : null
          return <>
            <div className={onboarding ? "mb-6 flex flex-col gap-5" : "flex flex-col gap-4"}>
              {data.pending ? <Alert><AlertTitle>{t("settings.billingUpcomingChange")}</AlertTitle><AlertDescription>{t("settings.billingUpcomingChangeDescription", { plan: data.pending.planId === "solo" ? "Solo" : "Team", count: data.pending.capacity, date: formatDateTime(data.pending.effectiveAt, { formatPreference: app?.formatPreference ?? "eu", language: locale, includeTime: false, timeZone: app?.organizationTimezone }) })}</AlertDescription></Alert> : null}
              {data.paymentPending ? <Alert><AlertTitle>{t("settings.billingPaymentPending")}</AlertTitle>{data.paymentUrl ? <AlertAction><Button render={<a href={data.paymentUrl} />} type="button" variant="outline">{t("settings.billingCompletePayment")}</Button></AlertAction> : null}</Alert> : null}
              {onboarding ? <ul className="grid gap-2 text-xs">{plans[0].features[locale].map((feature) => <li className="flex items-start gap-2" key={feature}><Icon aria-hidden={true} className="shrink-0 text-primary" name="check" size={16} /><span>{feature}</span></li>)}</ul> : null}
              {onboarding ? <div className="space-y-2">
                <p className="text-xs font-semibold">{t("settings.billingEarlyBirdTitle")}</p>
                <ul className="grid gap-2 text-xs">
                  {["settings.billingEarlyBirdInfluence", "settings.billingEarlyBirdSupport"].map((key) => <li className="flex items-start gap-2" key={key}><Icon aria-hidden={true} className="shrink-0 text-primary" name="check" size={16} /><span>{t(key)}</span></li>)}
                </ul>
              </div> : null}
              <div className="flex flex-col gap-3">
                {data.annualEnabled ? <FormLabel label={t("settings.billingBillingInterval")} labelGroupClassName="sr-only" error={form.error("interval")} errorPlacement="below">
                  <SegmentedControl aria-label={t("settings.billingBillingInterval")} aria-invalid={Boolean(form.error("interval"))} className="grid w-full grid-cols-2" onBlur={interval.onBlur} ref={interval.ref} role="group">
                    <SegmentedControlItem aria-pressed={interval.value === "month"} data-pressed={interval.value === "month" ? "" : undefined} disabled={disabled} onClick={() => interval.onChange("month")} type="button">
                      {t("settings.billingCycleMonthly")}
                    </SegmentedControlItem>
                    <SegmentedControlItem aria-pressed={interval.value === "year"} className="gap-2" data-pressed={interval.value === "year" ? "" : undefined} disabled={disabled} onClick={() => interval.onChange("year")} type="button">
                      {t("settings.billingCycleYearly")}
                      <Badge size="sm" variant="error">{t("settings.billingSaveAmount", { amount: money(annualSaving) })}</Badge>
                    </SegmentedControlItem>
                  </SegmentedControl>
                </FormLabel> : null}
                <FormLabel label={t("settings.billingChoosePlan")} labelGroupClassName="sr-only" error={form.error("planId")} errorPlacement="below" errorClassName="whitespace-normal">
                  <RadioGroup aria-label={t("settings.billingChoosePlan")} aria-invalid={Boolean(form.error("planId"))} className="w-full gap-2" onBlur={plan.onBlur} onValueChange={(value) => {
                    if (value !== "solo" && value !== "team") return
                    if (value === input.planId) return
                    if (input.planId === "team" && Number.isFinite(input.bookablePeople) && input.bookablePeople >= 3) teamCapacity.current = input.bookablePeople
                    plan.onChange(value)
                    form.setValue("bookablePeople", value === "solo" ? 1 : teamCapacity.current ?? Math.max(3, data.used))
                  }} ref={plan.ref} value={plan.value}>
                    {plans.map((item) => <RadioCard key={item.id}>
                      <Radio disabled={disabled} value={item.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.id === "team" ? t("settings.billingTeamPeopleShort") : t("settings.billingPeopleShort", { count: item.includedStaff })}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                        <span className="whitespace-nowrap"><span className="text-base font-semibold tabular-nums">{money(getPlanAmount(item.id, billingInterval, item.id === "team" ? extraPeople : 0))}</span> <span className="text-xs text-muted-foreground">/ {t(billingInterval === "year" ? "settings.billingYearShort" : "settings.billingMonthShort")} + {t("settings.billingVat")}</span></span>
                        <Badge size="sm" variant="success">{t("settings.billingDailyEquivalent", { price: dailyMoney(getPlanAmount(item.id, billingInterval, item.id === "team" ? extraPeople : 0), billingInterval) })}</Badge>
                      </span>
                    </RadioCard>)}
                  </RadioGroup>
                </FormLabel>
              </div>
              {input.planId === "team" ? <div data-slot="billing-people-price" ref={onboarding ? revealTeamSize : undefined}>
                <FormLabel
                  label={t("settings.billingBookablePeople")}
                  error={form.error("bookablePeople")}
                  errorPlacement="below"
                  errorClassName="col-start-2 whitespace-normal"
                  className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-x-4 gap-y-1"
                  description={t("settings.billingExtraPeopleDescription", { price: money(extraStaffPrice[billingInterval]), interval: t(billingInterval === "year" ? "settings.billingYearShort" : "settings.billingMonthShort") })}
                  descriptionPlacement="before"
                  labelGroupClassName="min-w-0 flex-1 space-y-1"
                >
                  <div className="w-36 shrink-0">
                    <NumberField
                      className="w-full"
                      disabled={disabled}
                      format={{ maximumFractionDigits: 0, useGrouping: false }}
                      locale={locale}
                      min={3}
                      max={1003}
                      name={people.name}
                      onValueChange={(value) => {
                        if (value !== null && value >= 3) teamCapacity.current = value
                        people.onChange(value ?? Number.NaN)
                        form.unstable_setCustomError("bookablePeople", null)
                      }}
                      step={1}
                      value={Number.isFinite(people.value) ? people.value : null}
                    >
                      <NumberFieldGroup className="border-0 bg-background shadow-none ring-1 ring-border/70 has-aria-invalid:ring-destructive/50">
                        <NumberFieldDecrement aria-label={t("settings.billingDecreasePeople")} disabled={disabled || Number(people.value) <= 3} type="button" />
                        <NumberFieldInput aria-invalid={Boolean(form.error("bookablePeople"))} className="font-semibold" onBlur={people.onBlur} ref={people.ref} />
                        <NumberFieldIncrement aria-label={t("settings.billingIncreasePeople")} type="button" />
                      </NumberFieldGroup>
                    </NumberField>
                  </div>
                </FormLabel>
              </div> : null}
              {data.current ? <p className="text-xs text-muted-foreground">{t("settings.billingChangeExplanation")}</p> : null}
            </div>
            {onboarding ? <OnboardingActions>
              <div className="mb-3 flex items-center justify-between gap-3 px-1 text-sm font-medium">
                <span className="truncate text-muted-foreground">{input.planId === "team" ? "Team" : "Solo"} · {t("settings.billingPeopleShort", { count })}</span>
                <span className="shrink-0 tabular-nums">{money(total)} <span className="text-muted-foreground">/ {t(billingInterval === "year" ? "settings.billingYearShort" : "settings.billingMonthShort")} + {t("settings.billingVat")}</span></span>
              </div>
              {submitButton}
              {checkoutNote}
            </OnboardingActions> : <div className="pt-5">
              <div className="mb-3 flex items-center justify-between gap-3 text-sm font-medium">
                <span className="truncate text-muted-foreground">{input.planId === "team" ? "Team" : "Solo"} · {t("settings.billingPeopleShort", { count })}</span>
                <span className="shrink-0 tabular-nums">{money(total)} <span className="text-muted-foreground">/ {t(billingInterval === "year" ? "settings.billingYearShort" : "settings.billingMonthShort")} + {t("settings.billingVat")}</span></span>
              </div>
              {submitButton}{checkoutNote}
            </div>}
          </>
        }}
      </AppForm>
      {selection ? <BillingMemberSelection
        key={selection.key}
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        members={selection.members}
        count={selection.count}
        onConfirm={async (disableStaffIds) => {
          if (await submitPlan({ ...selection.input, disableStaffIds })) setSelectionOpen(false)
        }}
      /> : null}
    </>
  )
}
