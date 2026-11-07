import { useMutation } from "@tanstack/react-query"
import { useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  data,
  Outlet,
  redirect,
  useRouteLoaderData,
} from "react-router"

import type { Route } from "./+types/onboarding"
import type { loader as rootLoader } from "~/root"
import { getStandalonePageStyles, standalonePageLogoClassName, standalonePagePadding } from "~/components/layout/standalone-page-styles"
import { AppLogo } from "~/components/navigation/app-logo"
import Icon from "~/components/icons"
import { LanguageSwitch } from "~/components/settings/preferences/language-switch"
import { ThemeSwitch } from "~/components/settings/preferences/theme-switch"
import {
  OnboardingProgress,
  type OnboardingStep,
} from "~/components/onboarding/onboarding-progress"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { getAfterOnboardingRedirect } from "~/lib/auth/redirect"
import { authClient } from "~/lib/auth/client"
import { toast } from "~/lib/toast"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { organizationMiddleware, requireAuthMiddleware } from "~/middleware/auth"
import { useBottomScrollFade } from "~/lib/hooks/use-bottom-scroll-fade"
import { cn } from "~/lib/utils"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware, organizationMiddleware]

type OnboardingStepId = "business" | "location" | "availability" | "holidays" | "subscription"

type OnboardingStepState = {
  complete: boolean
  id: OnboardingStepId
}

function getOnboardingSteps({
  billingEnabled,
  businessComplete,
  locationComplete,
  availabilityComplete,
  holidaysComplete,
  subscriptionComplete,
}: {
  billingEnabled: boolean
  businessComplete: boolean
  locationComplete: boolean
  availabilityComplete: boolean
  holidaysComplete: boolean
  subscriptionComplete: boolean
}): OnboardingStepState[] {
  const setupSteps: OnboardingStepState[] = [
    { complete: businessComplete, id: "business" },
    { complete: locationComplete, id: "location" },
    { complete: availabilityComplete, id: "availability" },
    { complete: holidaysComplete, id: "holidays" },
  ]

  if (!billingEnabled) {
    return setupSteps
  }

  return [
    ...setupSteps,
    { complete: subscriptionComplete, id: "subscription" },
  ]
}

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const status = await queryClient.query(
    trpc.onboarding.status.queryOptions(),
  )

  const url = new URL(loaderArgs.url)
  const steps = getOnboardingSteps({ ...status, subscriptionComplete: status.subscriptionComplete || status.previouslySubscribed })
  const firstIncompleteIndex = steps.findIndex((item) => !item.complete)
  const requestedStepIndex = steps.findIndex((item) => url.pathname === `/onboarding/${item.id}`)
  const canRevisitOnboarding = process.env.NODE_ENV !== "production"
  const canVisitRequestedStep = canRevisitOnboarding && requestedStepIndex !== -1
  const defaultStepIndex = canRevisitOnboarding && firstIncompleteIndex === -1 ? 0 : firstIncompleteIndex
  const currentStepIndex = canVisitRequestedStep ? requestedStepIndex : defaultStepIndex

  if (currentStepIndex === -1) {
    throw redirect(getAfterOnboardingRedirect(url.searchParams))
  }

  const currentStep = steps[currentStepIndex]!
  const step: OnboardingStep = currentStepIndex + 1
  const nextStep = steps.slice(currentStepIndex + 1).find((item) => canRevisitOnboarding || item.id !== "subscription" || !item.complete)?.id ?? null

  const stepPath = `/onboarding/${currentStep.id}`

  if (
    url.pathname !== stepPath ||
    (!status.demoOnboardingPaymentBypassEnabled && url.searchParams.has("step"))
  ) {
    url.pathname = stepPath
    url.searchParams.delete("step")
    throw redirect(`${url.pathname}${url.search}`)
  }

  return data({
    step,
    stepId: currentStep.id,
    totalSteps: steps.length,
    nextStep,
  })
}

export function shouldRevalidate() {
  return true
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("onboarding")

  return (
    <OnboardingShell
      header={loaderData.totalSteps > 1 ? (
        <OnboardingProgress
          step={loaderData.step}
          total={loaderData.totalSteps}
        />
      ) : null}
    >
      <title>{t(`pageTitles.${loaderData.stepId}`)}</title>
      <Outlet context={loaderData} />
    </OnboardingShell>
  )
}

function OnboardingShell({ children, header }: {
  children: ReactNode
  header: ReactNode
}) {
  const { t } = useTranslation("onboarding")
  const { t: tCommon } = useTranslation("common")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const bottomFadeRef = useRef<HTMLDivElement>(null)
  useBottomScrollFade(scrollViewportRef, bottomFadeRef, false)

  const logOut = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut()
      if (result.error) throw new Error(tCommon("account.logOutError"))
    },
    onSuccess: async () => {
      window.location.replace("/auth")
    },
    onError: () => toast.error(tCommon("account.logOutError")),
  })

  return (
    <main
      className={cn("floating-layout pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] relative h-dvh w-full overflow-x-clip bg-background text-foreground", getStandalonePageStyles(isElectron), "max-lg:[--page-gutter:1.25rem]", isElectron && "max-lg:[--page-top:calc(52px+env(safe-area-inset-top,0px))]")}
      data-electron={isElectron}
    >
      <ScrollArea
        className="h-full w-full"
        fill={true}
        scrollbarClassName="z-20 max-lg:hidden [&[data-orientation=horizontal]]:hidden"
        viewportProps={{
          className: "app-page-scroll !overflow-x-hidden",
          ref: scrollViewportRef,
        }}
      >
        <div className={cn("flex min-h-full flex-col", standalonePagePadding, "max-lg:pb-5")}>
          <div className="mb-[calc(1.5rem*(1-sign(env(safe-area-inset-top,0px))))] flex shrink-0 items-center justify-between lg:mb-0">
            <div
              className={cn(standalonePageLogoClassName, "md:size-8 electron-no-drag lg:fixed lg:top-(--page-top) lg:left-[calc(var(--page-gutter)+env(safe-area-inset-left,0px))] lg:z-20 lg:size-9")}
            >
              <AppLogo aria-hidden="true" className="size-5 lg:size-6" />
            </div>
            <div
              className="electron-no-drag flex items-center gap-3 lg:fixed lg:top-(--page-top) lg:right-[calc(var(--page-gutter)+env(safe-area-inset-right,0px))] lg:z-20"
            >
              <ThemeSwitch />
              <LanguageSwitch />
              <Button
                aria-label={t("actions.logOut")}
                className="size-8"
                loading={logOut.isPending}
                onClick={() => logOut.mutate()}
                size="icon"
                type="button"
                variant="outline"
              >
                <Icon className="size-4" name="logOut" size={16} />
              </Button>
            </div>
          </div>

          <div className={cn("mx-auto flex w-full max-w-md flex-1 flex-col lg:w-[calc(100%-128px)] lg:pt-[calc(6rem-var(--page-top))]", isElectron && "max-lg:pt-[26px] lg:pt-[calc(9rem-var(--page-top))]")}>
            {header ? (
              <header className="route-header shrink-0">
                <div className="relative">
                  {header}
                </div>
              </header>
            ) : null}

            <section className="flex min-w-0 shrink-0 flex-col gap-5">
              {children}
            </section>
          </div>
        </div>
      </ScrollArea>

      {isElectron ? (
        <div
          aria-hidden="true"
          className="electron-drag fixed top-0 left-0 right-3 z-20 h-7"
        />
      ) : null}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-8 bg-background/75 lg:bg-transparent lg:bg-linear-to-t lg:from-background/75 lg:from-50% lg:to-transparent backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_top,black_0%,black_45%,transparent_100%)] lg:backdrop-blur-none lg:backdrop-saturate-100 lg:[mask-image:none] will-change-opacity"
        ref={bottomFadeRef}
      />
    </main>
  )
}
