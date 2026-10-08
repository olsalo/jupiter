import type { ReactNode } from "react"
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
import {
  OnboardingProgress,
  type OnboardingStep,
} from "~/components/onboarding-progress"
import { Button } from "~/components/ui/button"
import { authClient } from "~/lib/auth/client"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { requireAuthMiddleware } from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [requireAuthMiddleware]

type OnboardingStepId = "business" | "subscription"

type OnboardingStepState = {
  complete: boolean
  id: OnboardingStepId
}

function getOnboardingSteps({
  billingEnabled,
  businessComplete,
  subscriptionComplete,
}: {
  billingEnabled: boolean
  businessComplete: boolean
  subscriptionComplete: boolean
}): OnboardingStepState[] {
  const businessStep = { complete: businessComplete, id: "business" as const }

  if (!billingEnabled) {
    return [businessStep]
  }

  return [
    businessStep,
    { complete: subscriptionComplete, id: "subscription" },
  ]
}

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const status = await queryClient.query(
    trpc.onboarding.status.queryOptions(),
  )

  if (status.subscriptionComplete) {
    throw redirect("/")
  }

  const steps = getOnboardingSteps(status)
  const currentStepIndex = steps.findIndex((item) => !item.complete)

  if (currentStepIndex === -1) {
    throw redirect("/")
  }

  const currentStep = steps[currentStepIndex]!
  const step: OnboardingStep = currentStepIndex + 1
  const nextStep =
    currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1]!.id : null

  const url = new URL(loaderArgs.url)
  const stepPath = `/onboarding/${currentStep.id}`

  if (url.pathname !== stepPath || url.searchParams.has("step")) {
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

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("onboarding")

  return (
    <OnboardingShell>
      <title>{t("title")}</title>
      <OnboardingProgress
        step={loaderData.step}
        total={loaderData.totalSteps}
      />
      <Outlet context={loaderData} />
    </OnboardingShell>
  )
}

function OnboardingShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("onboarding")
  const navigate = useNavigate()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)

  const logOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate("/auth", { replace: true })
        },
      },
    })
  }

  return (
    <main
      className="auth-layout relative flex min-h-dvh bg-background text-foreground"
      data-electron={isElectron}
    >
      {isElectron ? (
        <div
          aria-hidden="true"
          className="electron-drag absolute inset-x-0 top-0 z-20 h-8"
        />
      ) : null}
      <section
        className={`flex flex-1 flex-col gap-4 p-5 md:p-4 ${isElectron ? "pt-[52px] md:pt-12" : ""}`}
      >
        <header className="flex items-start justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9">
            <AppLogo aria-hidden="true" className="size-5 md:size-6" />
          </div>
          <Button
            aria-label={t("actions.logOut")}
            onClick={logOut}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Icon name="logOut" size={18} />
          </Button>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-5">
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
