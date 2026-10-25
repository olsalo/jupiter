import { SettingsSectionHeader } from "~/components/settings/settings-section-header"

export function TeamScheduleViewHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-12 shrink-0 items-start justify-between gap-4">
      <div className="min-w-0"><SettingsSectionHeader title={title} description={description} /></div>
    </div>
  )
}
