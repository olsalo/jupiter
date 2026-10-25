type Timer = ReturnType<typeof setTimeout>

export function createRouteSheetState({ setOpen, onCloseComplete, onCloseStart, onReopen, schedule = setTimeout, cancel = clearTimeout }: {
  setOpen: (open: boolean) => void
  onCloseComplete: () => void
  onCloseStart?: () => void
  onReopen?: () => void
  schedule?: (callback: () => void, delay: number) => Timer
  cancel?: (timer: Timer) => void
}) {
  let closing = false
  let completed = false
  let generation = 0
  let timer: Timer | null = null

  function clearTimer() {
    if (timer !== null) cancel(timer)
    timer = null
  }

  function finishClosing(expectedGeneration = generation) {
    if (!closing || completed || expectedGeneration !== generation) return
    clearTimer()
    closing = false
    completed = true
    onCloseComplete()
  }

  return {
    close() {
      if (closing || completed) return
      closing = true
      const closeGeneration = ++generation
      onCloseStart?.()
      setOpen(false)
      timer = schedule(() => finishClosing(closeGeneration), 500)
    },
    finishClosing: () => finishClosing(),
    reopen() {
      const newFlow = closing || completed
      clearTimer()
      generation++
      closing = false
      completed = false
      if (newFlow) onReopen?.()
      setOpen(true)
    },
    dispose() {
      clearTimer()
      generation++
      closing = false
    },
  }
}
