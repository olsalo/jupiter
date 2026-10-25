export function applyServiceOrder<T extends { id: string }>(items: T[], ids: string[] | null): T[] {
  if (!ids) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = ids.flatMap((id) => {
    const item = byId.get(id)
    byId.delete(id)
    return item ? [item] : []
  })
  return [...ordered, ...byId.values()]
}

export function createServiceOrderQueue({ getIds, save, refresh, onIdle, onError }: {
  getIds: () => string[]
  save: (ids: string[]) => Promise<unknown>
  refresh: () => Promise<unknown>
  onIdle: () => void
  onError: () => void
}) {
  let pending: string[] | null = null
  let active: Promise<void> | undefined
  const reconcile = (ids: string[]) => applyServiceOrder(getIds().map((id) => ({ id })), ids).map((item) => item.id)

  async function drain() {
    try {
      while (true) {
        while (pending) {
          const requested = pending
          pending = null
          const ids = reconcile(requested)
          try {
            await save(ids)
          } catch (error) {
            if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") {
              try {
                await refresh()
                // A newer drop takes priority over retrying an older order
                if (pending) continue
                const current = reconcile(requested)
                if (current.length === ids.length && current.every((id) => ids.includes(id))) {
                  onError()
                  continue
                }
                await save(current)
              } catch {
                onError()
              }
            } else {
              onError()
            }
          }
        }
        try {
          await refresh()
        } catch {
          onError()
        }
        if (!pending) break
      }
    } finally {
      onIdle()
    }
  }

  return {
    enqueue(ids: string[]) {
      pending = [...ids]
      active ??= drain().finally(() => { active = undefined })
      return active
    },
  }
}
