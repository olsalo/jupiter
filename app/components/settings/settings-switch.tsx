import { useRef, type ComponentProps } from "react"

import { FormSwitch } from "~/components/forms/form-switch"
import { createSettingsSaveQueue } from "~/lib/preferences/settings-save-queue"
import { toast } from "~/lib/toast"

type SettingsSwitchProps<Saved> = Omit<ComponentProps<typeof FormSwitch>, "checked" | "defaultChecked" | "onCheckedChange"> & {
  checked: boolean
  save: (checked: boolean) => Promise<Saved>
  getChecked: (saved: Saved) => boolean
  updateCache: (checked: boolean, saved?: Saved) => void
  onSaved?: (saved: Saved) => void | Promise<unknown>
  errorMessage: string
}

export function SettingsSwitch<Saved>({ checked, save, getChecked, updateCache, onSaved, errorMessage, ...props }: SettingsSwitchProps<Saved>) {
  const queue = useRef(createSettingsSaveQueue())
  const revision = useRef(0)
  const confirmed = useRef(checked)

  const handleCheckedChange = (value: boolean) => {
    if (queue.current.pendingCount === 0) confirmed.current = checked
    const currentRevision = ++revision.current
    updateCache(value)
    void queue.current.enqueue(async () => {
      try {
        const saved = await save(value)
        confirmed.current = getChecked(saved)
        if (currentRevision !== revision.current) return
        updateCache(confirmed.current, saved)
        await onSaved?.(saved)
      } catch {
        if (currentRevision !== revision.current) return
        updateCache(confirmed.current)
        toast.error(errorMessage)
      }
    })
  }

  return <FormSwitch {...props} checked={checked} onCheckedChange={handleCheckedChange} />
}
