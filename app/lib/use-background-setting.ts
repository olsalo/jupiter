import { useEffect, useMemo, useSyncExternalStore } from "react"
import { createBackgroundSetting } from "~/lib/background-setting"
import { createSettingsSaveQueue } from "~/lib/settings-save-queue"

const settings = new Map<string, ReturnType<typeof createBackgroundSetting<unknown>>>()
const backgroundSettingsSaveQueue = createSettingsSaveQueue()

export function useBackgroundSetting<T>(key: string, initialValue: T) {
  const stores = typeof window === "undefined" ? new Map<string, ReturnType<typeof createBackgroundSetting<unknown>>>() : settings
  let store = stores.get(key)
  if (!store) {
    store = createBackgroundSetting<unknown>(initialValue, backgroundSettingsSaveQueue)
    stores.set(key, store)
  }
  const serverSnapshot = useMemo(() => ({ value: initialValue, isSaving: false }), [initialValue])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverSnapshot)
  useEffect(() => { store.sync(initialValue) }, [store, initialValue])

  return {
    value: snapshot.value as T,
    isSaving: snapshot.isSaving,
    set: (value: T, save: () => Promise<unknown>, onError: () => void) => store.set(value, save, onError),
  }
}
