import { useState, type Ref } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "~/components/ui/input"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import dialCodes from "~/lib/localization/data/dial-codes.json"

const codesByLength = [...dialCodes].sort((first, second) => second.dialCode.length - first.dialCode.length)
const items = dialCodes.map(({ dialCode }) => ({ value: dialCode, label: dialCode }))

export function PhoneInput({ value, onChange, onBlur, name, ref, country = "fi", invalid = false, disabled = false, placeholder }: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  name: string
  ref?: Ref<HTMLInputElement>
  country?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  const { t } = useTranslation("team")
  const [selectedCode, setSelectedCode] = useState<string>()
  const defaultCode = dialCodes.find((item) => item.countries.includes(country.toLowerCase()))?.dialCode ?? "+358"
  const numberCode = codesByLength.find((item) => value.startsWith(item.dialCode))?.dialCode
  const dialCode = numberCode ?? selectedCode ?? defaultCode
  const number = numberCode ? value.slice(numberCode.length) : value

  return (
    <div className="flex w-full min-w-0 gap-2">
      <Select
        disabled={disabled}
        items={items}
        name={`${name}DialCode`}
        value={dialCode}
        onValueChange={(code) => {
          if (typeof code !== "string") return
          setSelectedCode(code)
          if (number) onChange(`${code}${number}`)
        }}
      >
        <SelectTrigger aria-invalid={invalid || undefined} aria-label={t("people.dialCode")} className="w-20 min-w-20 shrink-0 px-2" onBlur={onBlur}>
          <SelectValue>{() => dialCode}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem className="gap-1 px-1" key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      <Input
        aria-invalid={invalid || undefined}
        aria-label={t("people.phone")}
        autoComplete="tel-national"
        className="min-w-0 flex-1"
        disabled={disabled}
        name={name}
        onBlur={onBlur}
        onChange={(event) => {
          const nextNumber = event.target.value.trimStart()
          if (nextNumber.startsWith("+")) {
            setSelectedCode(codesByLength.find((item) => nextNumber.startsWith(item.dialCode))?.dialCode ?? dialCode)
            onChange(nextNumber)
          } else {
            setSelectedCode(dialCode)
            onChange(nextNumber ? `${dialCode}${nextNumber}` : "")
          }
        }}
        placeholder={placeholder}
        ref={ref}
        type="tel"
        value={number}
      />
    </div>
  )
}
