import assert from "node:assert/strict"
import { createRouteSheetState } from "../app/lib/route-sheet-state.ts"

let nextTimer = 0
const timers = new Map<number, () => void>()
const openStates: boolean[] = []
let navigations = 0
let newFlows = 0
const lifecycle = createRouteSheetState({
  setOpen: (open) => openStates.push(open),
  onCloseComplete: () => { navigations++ },
  onReopen: () => { newFlows++ },
  schedule: (callback) => {
    const timer = ++nextTimer
    timers.set(timer, callback)
    return timer as unknown as ReturnType<typeof setTimeout>
  },
  cancel: (timer) => { timers.delete(timer as unknown as number) },
})

lifecycle.reopen()
assert.equal(newFlows, 0, "Initial opening does not reset the form")
lifecycle.close()
const staleClose = timers.get(nextTimer)!
lifecycle.reopen()
assert.equal(openStates.at(-1), true)
assert.equal(timers.size, 0, "Reopening cancels pending navigation")
assert.equal(newFlows, 1, "Reopening begins a new create flow")
lifecycle.finishClosing()
staleClose()
assert.equal(navigations, 0, "Old animation and timer completions cannot close the reopened sheet")

lifecycle.close()
staleClose()
assert.equal(navigations, 0, "A timer from an older close cannot finish a newer close")
lifecycle.finishClosing()
lifecycle.finishClosing()
assert.equal(navigations, 1, "Animation completion navigates only once")
assert.equal(timers.size, 0)
lifecycle.reopen()
assert.equal(newFlows, 2, "A reopen during return-route loading starts a fresh flow")
lifecycle.close()
timers.get(nextTimer)!()
assert.equal(navigations, 2, "The fallback closes normally when no animation callback arrives")
lifecycle.reopen()
lifecycle.close()
const unmountedClose = timers.get(nextTimer)!
lifecycle.dispose()
unmountedClose()
assert.equal(navigations, 2, "Unmounted sheets cannot navigate later")
assert.equal(timers.size, 0)
console.info("PASS immediate reopening, stale close callbacks, reopening during navigation, form reset timing, single navigation and cleanup")
