import { useMutation } from "@tanstack/react-query"
import { useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  data,
  Outlet,
  redirect,
  useNavigate,
  useRouteLoaderData,
} from "react-router"

import type { Route } from "./+types/onboarding"
import type { loader as rootLoader } from "~/root"
import { AppLogo } from "~/components/app-logo"
import Icon from "~/components/icons"
import { LanguageSwitch } from "~/components/language-switch"
import { ThemeSwitch } from "~/components/theme-switch"
import {
  OnboardingProgress,
  type OnboardingStep,
} from "~/components/onboarding-progress"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { authClient } from "~/lib/auth/client"
import { toast } from "~/lib/toast"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { requireAuthMiddleware } from "~/middleware/auth"
import { useBottomScrollFade } from "~/lib/use-bottom-scroll-fade"
import { cn } from "~/lib/utils"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

type OnboardingStepId = "business" | "availability" | "holidays" | "subscription"

type OnboardingStepState = {
  complete: boolean
  id: OnboardingStepId
}

function getOnboardingSteps({
  billingEnabled,
  businessComplete,
  availabilityComplete,
  holidaysComplete,
  subscriptionComplete,
}: {
  billingEnabled: boolean
  businessComplete: boolean
  availabilityComplete: boolean
  holidaysComplete: boolean
  subscriptionComplete: boolean
}): OnboardingStepState[] {
  const setupSteps: OnboardingStepState[] = [
    { complete: businessComplete, id: "business" },
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
  const steps = getOnboardingSteps(status)
  const requestedStepIndex = status.demoOnboardingPaymentBypassEnabled
    ? steps.findIndex((item) => url.pathname === `/onboarding/${item.id}`)
    : -1

  if (status.setupComplete && status.subscriptionComplete && requestedStepIndex === -1) {
    throw redirect("/")
  }

  const currentStepIndex =
    requestedStepIndex !== -1
      ? requestedStepIndex
      : steps.findIndex((item) => !item.complete)

  if (currentStepIndex === -1) {
    throw redirect("/")
  }

  const currentStep = steps[currentStepIndex]!
  const step: OnboardingStep = currentStepIndex + 1
  const nextStep =
    currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1]!.id : null

  const stepPath = `/onboarding/${currentStep.id}`

  if (
    requestedStepIndex === -1 &&
    (url.pathname !== stepPath || url.searchParams.has("step"))
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
      <title>{t("title")}</title>
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
  const navigate = useNavigate()
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
      await navigate("/auth", { replace: true })
    },
    onError: () => toast.error(tCommon("account.logOutError")),
  })

  return (
    <main
      className="floating-layout relative h-dvh w-full overflow-x-clip bg-background text-foreground"
      data-electron={isElectron}
    >
      <ScrollArea
        className="h-full w-full"
        scrollbarClassName="z-20 max-md:hidden [&[data-orientation=horizontal]]:hidden"
        viewportProps={{
          className: "app-page-scroll !overflow-x-hidden",
          ref: scrollViewportRef,
        }}
      >
        <div className={cn("flex min-h-dvh flex-col", isElectron && "pt-7")}>
          <div className="mx-auto flex w-[calc(100%-44px)] max-w-md flex-1 flex-col pb-[max(24px,env(safe-area-inset-bottom))] md:w-[calc(100%-160px)] md:pt-[max(24px,env(safe-area-inset-bottom))]">
            <div className="flex shrink-0 items-center justify-between pt-5 md:contents">
              <div
                className={cn(
                  "electron-no-drag flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:fixed md:top-3.5 md:left-3.5 md:z-20 md:size-9",
                  isElectron && "md:top-[46px]",
                )}
              >
                <AppLogo aria-hidden="true" className="size-5 md:size-6" />
              </div>
              <div
                className={cn(
                  "electron-no-drag flex items-center gap-3 md:fixed md:top-3.5 md:right-3.5 md:z-20",
                  isElectron && "md:top-[46px]",
                )}
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

            <div
              aria-hidden="true"
              className="min-h-8 flex-1"
            />

            {header ? (
              <header className="sticky top-0 z-10 shrink-0 md:mb-3">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 bottom-0 left-1/2 w-screen -translate-x-1/2 bg-background/25 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)] md:-bottom-3 md:bg-background/40 md:backdrop-blur-[40px] md:mask-[linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]"
                />
                <div className={cn("relative pt-3.5 pb-3", isElectron && "md:pt-10")}>
                  {header}
                </div>
              </header>
            ) : null}

            <section className="mt-3 flex min-w-0 shrink-0 flex-col gap-5 md:mt-0">
              {children}
            </section>

            <div aria-hidden="true" className="min-h-8 flex-1" />
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-8 bg-background/75 md:bg-transparent md:bg-linear-to-t md:from-background/75 md:from-50% md:to-transparent backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_top,black_0%,black_45%,transparent_100%)] md:backdrop-blur-none md:backdrop-saturate-100 md:[mask-image:none] will-change-opacity"
        ref={bottomFadeRef}
      />
    </main>
  )
}
