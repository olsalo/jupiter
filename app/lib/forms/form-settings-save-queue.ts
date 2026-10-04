export function createFormSettingsSaveQueue() {
  let tail = Promise.resolve()
  let pendingCount = 0

  return {
    get pendingCount() {
      return pendingCount
    },
    enqueue(save: () => Promise<void>) {
      pendingCount += 1
      const pending = tail.catch(() => undefined).then(save).finally(() => { pendingCount -= 1 })
      tail = pending
      void pending.catch(() => undefined)
      return pending
    },
    async flush() {
      // Include changes queued while an earlier request is still saving.
      while (true) {
        const pending = tail
        await pending.catch(() => undefined)
        if (pending === tail) return
      }
    },
  }
}
