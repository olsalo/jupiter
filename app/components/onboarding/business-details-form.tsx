import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation } from "react-router"
import type { FormApi } from "@rvf/react"

import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { Button } from "~/components/ui/button"
import { InputGroup, InputGroupInput } from "~/components/ui/input-group"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { onboardingCountries } from "~/lib/countries"
import { currencyItems } from "~/lib/currencies"
import { onboardingFormSchema } from "~/lib/schemas/onboarding"
import { timezoneItems } from "~/lib/timezones"
import { useTRPC } from "~/lib/trpc/client"

type OnboardingFormValues = {
  businessName: string
  currency: string
  location: string
  name: string
  timezone: string
}

export function BusinessDetailsForm({ defaultValues, nextStep }: {
  defaultValues: OnboardingFormValues
  nextStep: "business" | "subscription" | null
}) {
  const { t } = useTranslation("onboarding")
  const formApi = useRef<FormApi<OnboardingFormValues>>(null)
  const navigate = useNavigate()
  const navigation = useNavigation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const completeMutation = useMutation(
    trpc.onboarding.complete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.onboarding.pathKey(),
          refetchType: "none",
        })
        navigate(nextStep ? `/onboarding/${nextStep}` : "/?welcome=true", {
          replace: true,
        })
      },
    }),
  )
  const isFinalStep = nextStep === null

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <AppForm
        className="flex flex-col gap-3.5"
        defaultValues={defaultValues}
        otherFormProps={{ noValidate: true }}
        ref={formApi}
        schema={onboardingFormSchema}
        submitFn={async (input) => {
          try {
            await completeMutation.mutateAsync(input)
          } catch (error) {
            const errorMessage =
              error instanceof Error &&
              error.message === "ORGANIZATION_NAME_TAKEN"
                ? t("errors.organizationNameTaken")
                : t("errors.create")

            formApi.current?.unstable_setCustomError(
              "businessName",
              errorMessage,
            )
            throw error
          }
        }}
      >
        {(form) => {
          const isSubmitting =
            form.formState.isSubmitting || navigation.state !== "idle"
          const locationField = form.getControlProps("location")
          const currencyField = form.getControlProps("currency")
          const timezoneField = form.getControlProps("timezone")

          return (
            <>
              <FormLabel error={form.error("name")} label={t("name.label")}>
                <InputGroup>
                  <InputGroupInput
                    {...form.getInputProps("name", {
                      "aria-invalid": Boolean(form.error("name")) || undefined,
                      autoComplete: "name",
                      onChange: () => {
                        form.unstable_setCustomError("name", null)
                      },
                      placeholder: t("name.placeholder"),
                      type: "text",
                    })}
                  />
                </InputGroup>
              </FormLabel>

              <Separator />

              <FormLabel
                error={form.error("businessName")}
                label={t("businessName.label")}
              >
                <InputGroup>
                  <InputGroupInput
                    {...form.getInputProps("businessName", {
                      "aria-invalid":
                        Boolean(form.error("businessName")) || undefined,
                      autoComplete: "organization",
                      onChange: () => {
                        form.unstable_setCustomError("businessName", null)
                      },
                      placeholder: t("businessName.placeholder"),
                      type: "text",
                    })}
                  />
                </InputGroup>
              </FormLabel>

              <FormLabel
                error={form.error("location")}
                label={t("location.label")}
              >
                <Select
                  items={onboardingCountries.map((country) => ({
                    label: country.name,
                    value: country.code,
                  }))}
                  onValueChange={(value) => {
                    if (typeof value !== "string") {
                      return
                    }

                    locationField.onChange(value)
                    form.unstable_setCustomError("location", null)
                  }}
                  value={locationField.value}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(form.error("location")) || undefined}
                    onBlur={locationField.onBlur}
                    ref={locationField.ref}
                  >
                    <SelectValue placeholder={t("location.placeholder")} />
                  </SelectTrigger>
                  <SelectPopup>
                    {onboardingCountries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </FormLabel>

              <FormLabel
                error={form.error("currency")}
                label={t("currency.label")}
              >
                <Select
                  items={currencyItems}
                  onValueChange={(value) => {
                    if (typeof value !== "string") {
                      return
                    }

                    currencyField.onChange(value)
                    form.unstable_setCustomError("currency", null)
                  }}
                  value={currencyField.value}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(form.error("currency")) || undefined}
                    onBlur={currencyField.onBlur}
                    ref={currencyField.ref}
                  >
                    <SelectValue placeholder={t("currency.placeholder")}>
                      {(value) => currencyItems.find((item) => item.value === value)?.label ?? t("currency.placeholder")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {currencyItems.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{currency.label}</span>
                          <span className="shrink-0 text-muted-foreground">{currency.value}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </FormLabel>

              <FormLabel
                error={form.error("timezone")}
                label={t("timezone.label")}
              >
                <Select
                  items={timezoneItems}
                  onValueChange={(value) => {
                    if (typeof value !== "string") {
                      return
                    }

                    timezoneField.onChange(value)
                    form.unstable_setCustomError("timezone", null)
                  }}
                  value={timezoneField.value}
                >
                  <SelectTrigger
                    aria-invalid={Boolean(form.error("timezone")) || undefined}
                    onBlur={timezoneField.onBlur}
                    ref={timezoneField.ref}
                  >
                    <SelectValue placeholder={t("timezone.placeholder")} />
                  </SelectTrigger>
                  <SelectPopup>
                    {timezoneItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </FormLabel>

              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? (
                  <>
                    <Spinner className="size-4" />
                    {t("actions.creating")}
                  </>
                ) : (
                  t(isFinalStep ? "actions.finishSetup" : "actions.create")
                )}
              </Button>
            </>
          )
        }}
      </AppForm>
    </>
  )
}
