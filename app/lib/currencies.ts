import currencies from "./files/currencies.json"

export const currencyItems = currencies
  .map((currency) => ({
    label: currency.name,
    value: currency.code,
  }))
  .sort((first, second) => first.label.localeCompare(second.label))

const currencyCodes = new Set(currencyItems.map((currency) => currency.value))

export function isCurrencyCode(value: string) {
  return currencyCodes.has(value)
}
