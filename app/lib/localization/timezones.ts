import timezones from "./data/timezones.json"

export const timezoneItems = timezones.map(({ name, zone }) => ({
  label: name,
  value: zone,
}))
