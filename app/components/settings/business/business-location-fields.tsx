import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"

import { PhoneInput } from "~/components/forms/phone-input"
import FormLabel from "~/components/forms/form-label"
import { Input } from "~/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import { onboardingCountries } from "~/lib/localization/countries"
import type { BusinessLocationValues } from "~/lib/schemas/business-location"

export function BusinessLocationFields({ form, contactLabels }: { form: FormApi<BusinessLocationValues>; contactLabels?: { phone: string; email: string } }) {
  const { t } = useTranslation()
  const country = form.getControlProps("country")
  const phone = form.getControlProps("phone")
  const items = onboardingCountries.map((entry) => ({ label: entry.name, value: entry.code.toUpperCase() }))
  const field = (name: Exclude<keyof BusinessLocationValues, "country" | "id">, autoComplete: string, type = "text") => <FormLabel error={form.error(name)} label={(name === "phone" || name === "email") && contactLabels ? contactLabels[name] : t(`businessLocation.${name}`)}>
    <Input {...form.getInputProps(name)} aria-invalid={Boolean(form.error(name))} autoComplete={autoComplete} placeholder={t(`businessLocation.placeholders.${name}`)} disabled={form.formState.isSubmitting} type={type} />
  </FormLabel>
  return <>
    {field("name", "organization")}
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-[2fr_1fr]">{field("addressLine1", "address-line1")}{field("addressLine2", "address-line2")}</div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_2fr]">{field("postalCode", "postal-code")}{field("city", "address-level2")}</div>
    <FormLabel error={form.error("country")} label={t("businessLocation.country")}>
      <Select disabled={form.formState.isSubmitting} items={items} onValueChange={(value) => { if (value) country.onChange(value) }} value={country.value}>
        <SelectTrigger aria-invalid={Boolean(form.error("country"))} onBlur={country.onBlur} ref={country.ref}><SelectValue placeholder={t("businessLocation.placeholders.country")} /></SelectTrigger>
        <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
      </Select>
    </FormLabel>
    <FormLabel error={form.error("phone")} label={contactLabels?.phone ?? t("businessLocation.phone")}>
      <PhoneInput country={country.value} disabled={form.formState.isSubmitting} invalid={Boolean(form.error("phone"))} name={phone.name} onBlur={phone.onBlur} onChange={phone.onChange} placeholder={t("businessLocation.placeholders.phone")} ref={phone.ref} value={phone.value} />
    </FormLabel>
    {field("email", "email", "email")}
  </>
}
