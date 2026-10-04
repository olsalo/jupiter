export function createBackgroundSetting<T>(initialValue: T, queue: { enqueue: (save: () => Promise<void>) => Promise<void> }) {
  let confirmed = initialValue
  let snapshot = { value: initialValue, isSaving: false }
  let revision = 0
  let pendingCount = 0
  const listeners = new Set<() => void>()
  const publish = (value: T) => {
    snapshot = { value, isSaving: pendingCount > 0 }
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    sync(value: T) {
      if (pendingCount > 0 || Object.is(snapshot.value, value)) return
      confirmed = value
      publish(value)
    },
    set(value: T, save: () => Promise<unknown>, onError: () => void) {
      const currentRevision = ++revision
      pendingCount += 1
      publish(value)
      return queue.enqueue(async () => {
        try {
          await save()
          confirmed = value
        } catch {
          if (currentRevision === revision) publish(confirmed)
          onError()
        } finally {
          pendingCount -= 1
          publish(snapshot.value)
        }
      })
    },
  }
}
