import { useMemo, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  redirect,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
} from "react-router"
import type { FormApi } from "@rvf/react"

import type { Route } from "./+types/auth"
import type { loader as rootLoader } from "~/root"
import { AppLogo } from "~/components/app-logo"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { ThemeSwitch } from "~/components/theme-switch"
import { LanguageSwitch } from "~/components/language-switch"
import { Button } from "~/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group"
import {
  OTPField,
  OTPFieldInput,
} from "~/components/ui/otp-field"
import { Spinner } from "~/components/ui/spinner"
import { authClient } from "~/lib/auth/client"
import { getSafeRedirectTo } from "~/lib/auth/redirect"
import { auth } from "~/lib/auth/server"
import { createAuthFormSchemas } from "~/lib/schemas/auth"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { toast } from "~/lib/toast"

type AuthFormValues = {
  email: string
  otp: string
}

type AuthErrorContext = {
  error: {
    message: string
  }
}

export async function loader(args: Route.LoaderArgs) {
  const { request } = args
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (session) {
    throw redirect(getAuthRedirect(new URL(request.url).searchParams))
  }

  const invitationId = getInvitationIdFromSearchParams(new URL(request.url).searchParams)
  if (!invitationId) return { invitation: null }

  const queryClient = getQueryClient()
  const trpc = await createTRPC(args)
  const invitation = await queryClient.fetchQuery(
    trpc.team.invitationPreview.queryOptions({ invitationId }),
  )

  return { invitation }
}

export default function Auth({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("auth")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)
  const [step, setStep] = useState<"email" | "otp">("email")
  const [searchParams] = useSearchParams()
  const formApi = useRef<FormApi<AuthFormValues>>(null)
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { sendOtp: sendOtpSchema, signIn: signInSchema } = useMemo(
    () => createAuthFormSchemas(t),
    [t],
  )

  const sendVerificationOtp = async (
    data: AuthFormValues,
    options?: {
      showErrorToast?: boolean
      showSuccessToast?: boolean
    },
  ) => {
    await authClient.emailOtp.sendVerificationOtp({
      email: data.email,
      type: "sign-in",
      fetchOptions: {
        onSuccess: () => {
          setStep("otp")
          if (options?.showSuccessToast) {
            toast.success(t("toasts.resendSuccess"))
          }
        },
        onError: (ctx: AuthErrorContext) => {
          setStep("email")
          formApi.current?.unstable_setCustomError(
            "email",
            ctx.error.message,
          )
          if (options?.showErrorToast) {
            toast.error(t("toasts.resendError"))
          }
        },
      },
    })
  }

  const signIn = async (data: AuthFormValues) => {
    await authClient.signIn.emailOtp({
      email: data.email,
      otp: data.otp,
      fetchOptions: {
        onSuccess: () => {
          navigate(getAuthRedirect(searchParams), { replace: true })
        },
        onError: (ctx: AuthErrorContext) => {
          formApi.current?.unstable_setCustomError("otp", ctx.error.message)
          toast.error(t("toasts.otpError"))
        },
      },
    })
  }

  return (
    <main
      className="auth-layout relative flex min-h-dvh bg-background text-foreground"
      data-electron={isElectron}
    >
      <title>{t("title")}</title>
      {isElectron ? (
        <div
          aria-hidden="true"
          className="electron-drag absolute inset-x-0 top-0 z-20 h-8"
        />
      ) : null}
      <section
        className={`flex flex-1 flex-col gap-4 p-5 md:p-4 ${isElectron ? "pt-[52px] md:pt-12" : ""}`}
      >
        <header className="flex items-center justify-between">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9">
            <AppLogo aria-hidden="true" className="size-5 md:size-6" />
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-xs flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("description")}
              </p>
            </div>

            {loaderData.invitation ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-primary shadow-xs">
                  <Icon aria-hidden="true" name="users" size={19} stroke={1.75} />
                </span>
                <p className="text-balance text-sm leading-5 text-muted-foreground">
                  <Trans
                    components={{
                      strong: <strong className="font-semibold text-foreground" />,
                    }}
                    i18nKey="invite.message"
                    ns="auth"
                    values={loaderData.invitation}
                  />
                </p>
              </div>
            ) : null}

            <AppForm
              className="flex w-full flex-col gap-3.5"
              defaultValues={{ email: searchParams.get("email") ?? "", otp: "" }}
              onBeforeSubmit={() => {
                formApi.current?.unstable_setCustomError("email", null)
                formApi.current?.unstable_setCustomError("otp", null)
              }}
              otherFormProps={{ noValidate: true }}
              ref={formApi}
              schema={step === "email" ? sendOtpSchema : signInSchema}
              submitFn={async (data) => {
                if (step === "email") {
                  await sendVerificationOtp(data)
                  return
                }

                await signIn(data)
              }}
            >
              {(form) => {
                const isSubmitting =
                  form.formState.isSubmitting || navigation.state !== "idle"

                return (
                  <>
                  <FormLabel
                    error={form.error("email")}
                    label={t("email.label")}
                  >
                    <InputGroup className="has-disabled:opacity-100!">
                      <InputGroupInput
                        {...form.getInputProps("email", {
                          autoComplete: "on",
                          disabled: step === "otp",
                          onChange: () => {
                            form.unstable_setCustomError("email", null)
                          },
                          placeholder: t("email.placeholder"),
                        })}
                      />
                      {step === "otp" ? (
                        <InputGroupAddon align="inline-end">
                          <Button
                            aria-label={t("email.change")}
                            onClick={() => {
                              form.resetField("email")
                              form.resetField("otp")
                              form.unstable_setCustomError("email", null)
                              form.unstable_setCustomError("otp", null)
                              setStep("email")
                            }}
                            size="icon-xs"
                            variant="secondary"
                          >
                            <Icon className="size-3.5" name="x" />
                          </Button>
                        </InputGroupAddon>
                      ) : null}
                    </InputGroup>
                  </FormLabel>

                  {step === "otp" ? (
                    <FormLabel
                      description={t("otp.description")}
                      error={form.error("otp")}
                      label={t("otp.label")}
                      showError={false}
                    >
                      <OTPField
                        aria-invalid={Boolean(form.error("otp")) || undefined}
                        aria-label={t("otp.ariaLabel")}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        length={6}
                        name="otp"
                        normalizeValue={(value) => value.replace(/\D/g, "")}
                        onInput={() => {
                          form.unstable_setCustomError("otp", null)
                        }}
                        onValueChange={(value) => {
                          form.setValue("otp", value)
                          form.unstable_setCustomError("otp", null)
                        }}
                        validationType="none"
                        value={form.value("otp")}
                      >
                        <OTPFieldInput className="selection:bg-transparent" />
                        <OTPFieldInput
                          aria-label={t("otp.characterLabel", {
                            position: 2,
                          })}
                          className="selection:bg-transparent"
                        />
                        <OTPFieldInput
                          aria-label={t("otp.characterLabel", {
                            position: 3,
                          })}
                          className="selection:bg-transparent"
                        />
                        <OTPFieldInput
                          aria-label={t("otp.characterLabel", {
                            position: 4,
                          })}
                          className="selection:bg-transparent"
                        />
                        <OTPFieldInput
                          aria-label={t("otp.characterLabel", {
                            position: 5,
                          })}
                          className="selection:bg-transparent"
                        />
                        <OTPFieldInput
                          aria-label={t("otp.characterLabel", {
                            position: 6,
                          })}
                          className="selection:bg-transparent"
                        />
                      </OTPField>
                    </FormLabel>
                  ) : null}

                  <div className="mt-1 flex flex-col gap-3">
                    <Button disabled={isSubmitting} type="submit">
                      {isSubmitting ? (
                        <>
                          <Spinner className="size-4" />
                          {t(
                            step === "email"
                              ? "actions.sending"
                              : "actions.signingIn",
                          )}
                        </>
                      ) : (
                        t(
                          step === "email"
                            ? "actions.sendCode"
                            : "actions.signIn",
                        )
                      )}
                    </Button>
                    {step === "otp" ? (
                      <Button
                        disabled={isSubmitting}
                        onClick={async () => {
                          await sendVerificationOtp(form.value(), {
                            showErrorToast: true,
                            showSuccessToast: true,
                          })
                          form.resetField("otp")
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {t("actions.resend")}
                      </Button>
                    ) : null}
                  </div>
                  </>
                )
              }}
            </AppForm>
          </div>
        </div>
        <footer className="flex h-8 shrink-0 items-center gap-2">
          <ThemeSwitch />
          <LanguageSwitch />
        </footer>
      </section>

      <section className="hidden flex-1 md:flex">
        <div
          className="min-w-0 flex-1 bg-neutral-100 bg-[url('/mockup.png')] bg-size-[90%_auto] bg-bottom-right bg-no-repeat dark:bg-neutral-900"
        />
      </section>
    </main>
  )
}

function getInvitationIdFromSearchParams(searchParams: URLSearchParams) {
  const directInvitationId = searchParams.get("invite")
  if (directInvitationId) {
    return directInvitationId && !directInvitationId.includes("/")
      ? directInvitationId
      : null
  }

  const redirectUrl = new URL(getSafeRedirectTo(searchParams), "http://astra.local")
  if (!redirectUrl.pathname.startsWith("/invite/")) return null

  try {
    const invitationId = decodeURIComponent(redirectUrl.pathname.slice("/invite/".length))
    return invitationId && !invitationId.includes("/") ? invitationId : null
  } catch {
    return null
  }
}

function getAuthRedirect(searchParams: URLSearchParams) {
  const invitationId = getInvitationIdFromSearchParams(searchParams)
  return invitationId
    ? `/invite/${encodeURIComponent(invitationId)}`
    : getSafeRedirectTo(searchParams)
}
