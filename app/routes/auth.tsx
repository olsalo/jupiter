import { useEffect, useMemo, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import {
  redirect,
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
} from "react-router"
import type { FormApi } from "@rvf/react"

import type { Route } from "./+types/auth"
import type { loader as rootLoader } from "~/root"
import { getStandalonePageStyles, standalonePageLogoClassName, standalonePagePadding } from "~/components/layout/standalone-page-styles"
import { AuthPreview } from "~/components/auth/auth-preview"
import { AppLogo } from "~/components/navigation/app-logo"
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import Icon from "~/components/icons"
import { ThemeSwitch } from "~/components/settings/preferences/theme-switch"
import { LanguageSwitch } from "~/components/settings/preferences/language-switch"
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
    status?: number
    code?: string
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
  const invitation = await queryClient.query(
    trpc.team.invitationPreview.queryOptions({ invitationId }),
  )

  return { invitation }
}

export default function Auth({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("auth")
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const isElectron = Boolean(rootData?.isElectron)
  const [step, setStep] = useState<"email" | "otp">("email")
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const requestPending = useRef(false)
  const [searchParams] = useSearchParams()
  const formApi = useRef<FormApi<AuthFormValues>>(null)
  const firstOtpInput = useRef<HTMLInputElement>(null)
  const otpFocusFrame = useRef<number | null>(null)
  const navigate = useNavigate()
  const { sendOtp: sendOtpSchema, signIn: signInSchema } = useMemo(
    () => createAuthFormSchemas(t),
    [t],
  )

  const cancelOtpFocus = () => {
    if (otpFocusFrame.current !== null) cancelAnimationFrame(otpFocusFrame.current)
    otpFocusFrame.current = null
  }

  useEffect(() => () => {
    if (otpFocusFrame.current !== null) cancelAnimationFrame(otpFocusFrame.current)
  }, [])

  const resetOtp = () => {
    formApi.current?.resetField("otp")
    cancelOtpFocus()
    if (window.matchMedia("(width < 768px), (pointer: coarse)").matches) return
    const focusWhenEnabled = () => {
      const input = firstOtpInput.current
      if (!input || input.disabled || requestPending.current) {
        otpFocusFrame.current = requestAnimationFrame(focusWhenEnabled)
        return
      }
      otpFocusFrame.current = null
      input.focus()
    }
    otpFocusFrame.current = requestAnimationFrame(focusWhenEnabled)
  }

  const sendVerificationOtp = async (
    data: AuthFormValues,
    options?: {
      showErrorToast?: boolean
      showSuccessToast?: boolean
    },
  ) => {
    if (requestPending.current) return
    requestPending.current = true
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email: data.email,
        type: "sign-in",
        fetchOptions: {
          onSuccess: () => {
            resetOtp()
            formApi.current?.unstable_setCustomError("otp", null)
            setStep("otp")
            if (options?.showSuccessToast) toast.success(t("toasts.resendSuccess"))
          },
          onError: (ctx: AuthErrorContext) => {
            if (options?.showErrorToast) {
              resetOtp()
              const limited = ctx.error.status === 429 || ctx.error.code === "TOO_MANY_REQUESTS"
              toast.error(t(limited ? "toasts.resendLimited" : "toasts.resendError"))
              return
            }
            if (ctx.error.status && ctx.error.status >= 500) {
              toast.error(t("toasts.sendError"))
            } else {
              formApi.current?.unstable_setCustomError("email", ctx.error.message)
            }
          },
        },
      })
    } catch {
      toast.error(t(options?.showErrorToast ? "toasts.resendError" : "toasts.sendError"))
    } finally {
      requestPending.current = false
    }
  }

  const signIn = async (data: AuthFormValues) => {
    if (requestPending.current) return
    requestPending.current = true
    try {
      await authClient.signIn.emailOtp({
        email: data.email,
        otp: data.otp,
        fetchOptions: {
          onSuccess: () => {
            setIsSigningIn(true)
            void Promise.resolve(navigate(getAuthRedirect(searchParams), { replace: true })).catch(() => {
              setIsSigningIn(false)
              toast.error(t("toasts.signInError"))
            })
          },
          onError: () => {
            setIsSigningIn(false)
            resetOtp()
            toast.error(t("toasts.otpError"))
          },
        },
      })
    } catch {
      setIsSigningIn(false)
      toast.error(t("toasts.signInError"))
    } finally {
      requestPending.current = false
    }
  }

  return (
    <main
      className={`auth-layout pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] relative grid min-h-dvh grid-cols-1 bg-background text-foreground md:grid-cols-2 ${getStandalonePageStyles(isElectron)}`}
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
        className={`grid flex-1 grid-cols-1 grid-rows-[1fr_auto_1fr] gap-4 md:flex md:flex-col ${standalonePagePadding}`}
      >
        <header className="col-start-1 row-start-1 flex items-center justify-between self-start">
          <div className={standalonePageLogoClassName}>
            <AppLogo aria-hidden="true" className="size-5 md:size-6" />
          </div>
        </header>

        <div className="row-start-2 flex flex-1 items-center justify-center">
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
                  form.formState.isSubmitting ||
                  isSigningIn

                return (
                  <>
                  <FormLabel
                    error={form.error("email")}
                    label={t("email.label")}
                  >
                    <InputGroup className="has-disabled:opacity-100!">
                      <InputGroupInput
                        {...form.getInputProps("email", {
                          autoComplete: "email",
                          autoCapitalize: "none",
                          autoCorrect: "off",
                          spellCheck: false,
                          inputMode: "email",
                          type: "text",
                          disabled: step === "otp" || isSubmitting || isResending,
                          "aria-invalid": Boolean(form.error("email")),
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
                            disabled={isSubmitting || isResending}
                            type="button"
                            onClick={() => {
                              cancelOtpFocus()
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
                        disabled={isSubmitting || isResending}
                        inputMode="numeric"
                        length={6}
                        name="otp"
                        normalizeValue={(value) => value.replace(/\D/g, "")}
                        onInput={() => {
                          form.unstable_setCustomError("otp", null)
                        }}
                        onValueChange={(value) => {
                          const previousValue = form.value("otp")
                          form.setValue("otp", value)
                          form.unstable_setCustomError("otp", null)

                          if (value.length === 6 && value !== previousValue && !isSubmitting && !isResending && !requestPending.current) {
                            form.submit()
                          }
                        }}
                        validationType="none"
                        value={form.value("otp")}
                      >
                        <OTPFieldInput className="selection:bg-transparent" ref={firstOtpInput} />
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
                    <Button
                      className="keyboard-focusable"
                      disabled={isSubmitting || isResending}
                      loading={isSubmitting}
                      tabIndex={0}
                      type="submit"
                    >
                      {t(
                        step === "email"
                          ? "actions.sendCode"
                          : "actions.signIn",
                      )}
                    </Button>
                    {step === "otp" ? (
                      <Button
                        disabled={isSubmitting || isResending}
                        loading={isResending}
                        onClick={async () => {
                          setIsResending(true)
                          try {
                            await sendVerificationOtp(form.value(), {
                              showErrorToast: true,
                              showSuccessToast: true,
                            })
                          } finally {
                            setIsResending(false)
                          }
                        }}
                        type="button"
                        variant="outline"
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
        <footer className="col-start-1 row-start-1 flex shrink-0 items-center gap-2 justify-self-end max-md:self-start max-md:[&_[data-slot=tabs-tab]]:size-8 max-md:[&_[data-slot=tabs-tab]]:p-0 max-md:[&_[data-slot=tabs-tab]]:text-sm max-md:[&_svg]:size-5 md:h-8">
          <ThemeSwitch />
          <LanguageSwitch />
        </footer>
      </section>

      <AuthPreview />
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
  const destination = getSafeRedirectTo(searchParams)
  return invitationId
    ? `/invite/${encodeURIComponent(invitationId)}`
    : destination === "/" || destination.startsWith("/?") || destination.startsWith("/#")
      ? `/calendar${destination.slice(1)}`
      : destination
}
