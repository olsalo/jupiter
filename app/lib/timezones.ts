import timezones from "./files/timezones.json"

export const timezoneItems = timezones.map(({ name, zone }) => ({
  label: name,
  value: zone,
}))
