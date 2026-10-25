import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { z } from "~/lib/validation/zod"
import { AppForm } from "~/components/forms/app-form"
import { PhoneInput } from "~/components/forms/phone-input"
import FormLabel from "~/components/forms/form-label"
import { Badge } from "~/components/ui/badge"
import { Checkbox } from "~/components/ui/checkbox"
import { CheckboxGroup } from "~/components/ui/checkbox-group"
import { Label } from "~/components/ui/label"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "~/components/ui/select"
import { phone } from "~/lib/schemas/appointments"
import type { BookingDetails, BookingPageData } from "./booking-types"

type Answer = string | number | boolean | string[]
export type BookingDraft = {
  name: string
  email: string
  phone: string
  notes: string
  answers: Record<string, Answer>
}

function DraftSync({
  values,
  onChange,
}: {
  values: BookingDraft
  onChange: (draft: BookingDraft) => void
}) {
  const serialized = JSON.stringify(values)
  useEffect(() => {
    onChange(JSON.parse(serialized) as BookingDraft)
  }, [serialized, onChange])
  return null
}

export function BookingDetailsForm({
  data,
  serviceId,
  defaultValues,
  onDraftChange,
  submit,
}: {
  data: BookingPageData
  serviceId: string
  defaultValues: BookingDraft | null
  onDraftChange: (draft: BookingDraft) => void
  submit: (values: BookingDetails) => void
}) {
  const { t, i18n } = useTranslation("booking")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const pending = false
  const questions = data.questions.filter(
    (question) => !question.serviceId || question.serviceId === serviceId,
  )
  const questionSchemas = Object.fromEntries(
    questions.map((question) => {
      const options = Array.isArray(question.options)
        ? question.options.filter(
            (option): option is string => typeof option === "string",
          )
        : []
      let schema: z.ZodType = z.string().trim().max(4000)
      if (question.type === "EMAIL")
        schema = z
          .string()
          .trim()
          .toLowerCase()
          .max(254)
          .pipe(z.email({ error: t("emailError") }))
      if (question.type === "PHONE") schema = phone
      if (question.type === "NUMBER")
        schema = z
          .union([z.string().trim().min(1, t("requiredError")), z.number()])
          .pipe(z.coerce.number<string | number>().finite())
      if (question.type === "BOOLEAN") schema = z.boolean()
      if (question.type === "MULTI_SELECT")
        schema = z
          .array(
            z
              .string()
              .refine((value) => options.includes(value), t("invalidError")),
          )
          .max(50)
      if (question.type === "SINGLE_SELECT")
        schema = z
          .string()
          .refine((value) => options.includes(value), t("invalidError"))
      if (question.type === "DATE" || question.type === "DATETIME")
        schema = z
          .string()
          .refine(
            (value) => Number.isFinite(Date.parse(value)),
            t("invalidError"),
          )
      if (question.required)
        schema = schema.refine(
          (value) =>
            value !== "" &&
            value !== undefined &&
            (!Array.isArray(value) || value.length > 0),
          t("requiredError"),
        )
      else schema = z.union([z.literal(""), schema])
      return [question.id, schema]
    }),
  )
  const schema = z.object({
    name: z.string().trim().min(1, t("requiredError")).max(120),
    email: data.settings.requireCustomerEmail
      ? z
          .string()
          .trim()
          .toLowerCase()
          .max(254)
          .pipe(z.email({ error: t("emailError") }))
      : z.union([
          z.literal(""),
          z
            .string()
            .trim()
            .toLowerCase()
            .max(254)
            .pipe(z.email({ error: t("emailError") })),
        ]),
    phone: data.settings.requireCustomerPhone
      ? phone
      : z.union([z.literal(""), phone]),
    notes: z.string().trim().max(2000),
    answers: z.object(questionSchemas),
  })
  return (
    <AppForm
      defaultValues={{
        name: defaultValues?.name ?? "",
        email: defaultValues?.email ?? "",
        phone: defaultValues?.phone ?? "",
        notes: defaultValues?.notes ?? "",
        answers: Object.fromEntries(
          questions.map((question) => [
            question.id,
            defaultValues?.answers[question.id] ??
              (question.type === "MULTI_SELECT"
                ? []
                : question.type === "BOOLEAN"
                  ? false
                  : ""),
          ]),
        ) as Record<string, Answer>,
      }}
      schema={schema}
      className="gap-5"
      id="public-booking-details"
      submitFn={async (values) => {
        submit({
          customer: {
            firstName: values.name,
            email: values.email || undefined,
            phone: values.phone || undefined,
            locale: language,
            timezone: data.settings.timezone,
          },
          notes: values.notes || undefined,
          answers: Object.entries(values.answers)
            .filter(([, value]) => value !== "" && value !== undefined)
            .map(([questionId, value]) => ({
              questionId,
              value: value as Answer,
            })),
        })
      }}
    >
      {(form) => (
        <>
          <DraftSync onChange={onDraftChange} values={form.value()} />
          <div className="grid gap-4 sm:grid-cols-2">
            {(["name", "email", "phone"] as const).map(
              (field) => (
                <FormLabel
                  className={field === "name" ? "sm:col-span-2" : undefined}
                  error={form.error(field)}
                  key={field}
                  label={
                    <>
                      {t(field === "name" ? "customerName" : field)}
                      {(field === "email" &&
                        !data.settings.requireCustomerEmail) ||
                      (field === "phone" &&
                        !data.settings.requireCustomerPhone) ? (
                        <Badge
                          size="sm"
                          variant="secondary"
                          className="font-normal"
                        >
                          {t("optional")}
                        </Badge>
                      ) : null}
                    </>
                  }
                >
                  {field === "phone" ? (
                    <PhoneInput
                      name={form.getControlProps("phone").name}
                      ref={form.getControlProps("phone").ref}
                      value={form.getControlProps("phone").value}
                      onChange={form.getControlProps("phone").onChange}
                      onBlur={form.getControlProps("phone").onBlur}
                      disabled={pending}
                      invalid={Boolean(form.error("phone"))}
                    />
                  ) : (
                    <Input
                      {...form.getInputProps(field)}
                      aria-invalid={Boolean(form.error(field))}
                      autoComplete={
                        {
                          name: "name",
                          email: "email",
                          phone: "tel",
                        }[field]
                      }
                      disabled={pending}
                      type={field === "email" ? "email" : "text"}
                    />
                  )}
                </FormLabel>
              ),
            )}
          </div>
          {questions.map((question) => {
            const path = `answers.${question.id}` as const
            const control = form.getControlProps(path)
            const options = Array.isArray(question.options)
              ? question.options.filter(
                  (option): option is string => typeof option === "string",
                )
              : []
            return (
              <FormLabel
                description={question.description}
                error={form.error(path)}
                key={question.id}
                label={
                  <>
                    {question.label}
                    {!question.required ? (
                      <Badge
                        size="sm"
                        variant="secondary"
                        className="font-normal"
                      >
                        {t("optional")}
                      </Badge>
                    ) : null}
                  </>
                }
              >
                {question.type === "BOOLEAN" ? (
                  <Select
                    disabled={pending}
                    items={[
                      { value: "yes", label: t("yes") },
                      { value: "no", label: t("no") },
                    ]}
                    onValueChange={(value) => control.onChange(value === "yes")}
                    value={control.value ? "yes" : "no"}
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(form.error(path))}
                      className="max-sm:min-h-11"
                      onBlur={control.onBlur}
                      ref={control.ref}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="yes">{t("yes")}</SelectItem>
                      <SelectItem value="no">{t("no")}</SelectItem>
                    </SelectPopup>
                  </Select>
                ) : question.type === "SINGLE_SELECT" ? (
                  <Select
                    disabled={pending}
                    items={options.map((value) => ({ value, label: value }))}
                    onValueChange={(value) => control.onChange(value ?? "")}
                    value={String(control.value || "")}
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(form.error(path))}
                      className="max-sm:min-h-11"
                      onBlur={control.onBlur}
                      ref={control.ref}
                    >
                      <SelectValue placeholder={t("select")} />
                    </SelectTrigger>
                    <SelectPopup>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                ) : question.type === "MULTI_SELECT" ? (
                  <CheckboxGroup
                    aria-label={question.label}
                    disabled={pending}
                    onBlur={control.onBlur}
                    onValueChange={control.onChange}
                    value={Array.isArray(control.value) ? control.value : []}
                  >
                    {options.map((option, index) => (
                      <Label
                        className="font-normal max-sm:min-h-11"
                        key={option}
                      >
                        <Checkbox
                          aria-invalid={Boolean(form.error(path))}
                          aria-labelledby={`booking-${question.id}-${index}`}
                          ref={index === 0 ? control.ref : undefined}
                          value={option}
                        />
                        <span id={`booking-${question.id}-${index}`}>
                          {option}
                        </span>
                      </Label>
                    ))}
                  </CheckboxGroup>
                ) : question.type === "LONG_TEXT" ? (
                  <Textarea
                    {...form.getInputProps(path)}
                    aria-invalid={Boolean(form.error(path))}
                    disabled={pending}
                    placeholder={question.placeholder ?? undefined}
                  />
                ) : (
                  <Input
                    {...form.getInputProps(path)}
                    aria-invalid={Boolean(form.error(path))}
                    disabled={pending}
                    placeholder={question.placeholder ?? undefined}
                    type={
                      question.type === "NUMBER"
                        ? "number"
                        : question.type === "DATE"
                          ? "date"
                          : question.type === "DATETIME"
                            ? "datetime-local"
                            : question.type === "EMAIL"
                              ? "email"
                              : question.type === "PHONE"
                                ? "tel"
                                : "text"
                    }
                  />
                )}
              </FormLabel>
            )
          })}
          <FormLabel
            error={form.error("notes")}
            label={
              <>
                {t("notes")}
                <Badge size="sm" variant="secondary" className="font-normal">
                  {t("optional")}
                </Badge>
              </>
            }
          >
            <Textarea
              {...form.getInputProps("notes")}
              aria-invalid={Boolean(form.error("notes"))}
              className="resize-y"
              disabled={pending}
            />
          </FormLabel>
        </>
      )}
    </AppForm>
  )
}
