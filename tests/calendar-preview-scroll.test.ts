import assert from "node:assert/strict"

import { createCalendarPreviewScrollState } from "../app/lib/calendar/preview-scroll.ts"

const state = createCalendarPreviewScrollState()
let position = { left: 420, top: 715 }
let restoreCount = 0
const attach = () => state.attach({
  read: () => ({ ...position }),
  restore: (original) => { restoreCount += 1; position = { ...original } },
})

let detach = attach()
state.startPreview()
position = { left: 1100, top: 200 }
state.startPreview()
assert.equal(state.restore(), false, "An active preview does not claim a saved position was restored")
assert.deepEqual(position, { left: 1100, top: 200 }, "Changing slots does not restore the calendar while previewing")

detach()
state.finishPreview()
assert.equal(state.restore(), false, "Restoration waits while the original grid is unmounted")
position = { left: 0, top: 0 }
detach = attach()
assert.equal(state.restore(), true, "The saved position takes priority over centering today")
assert.deepEqual(position, { left: 1100, top: 200 }, "Cancelling preserves the latest offsets across grid unmounts instead of returning to the position before editing")

position = { left: 500, top: 800 }
state.restore()
assert.deepEqual(position, { left: 500, top: 800 }, "Restoring runs once so later user scrolling stays untouched")

state.startPreview()
position = { left: 900, top: 100 }
state.finishPreview()
state.restore()
assert.deepEqual(position, { left: 900, top: 100 }, "Closing the next booking keeps the user's latest scroll position")
assert.equal(restoreCount, 1, "Cancelling on the mounted grid must not replay offsets after the panel resizes")

state.startPreview()
position = { left: 1100, top: 600 }
state.finishPreview()
position = { left: 750, top: 480 }
state.restore()
assert.deepEqual(position, { left: 750, top: 480 }, "Native clamping after the panel closes is not undone by an old scroll snapshot")
assert.equal(restoreCount, 1, "Resizing cannot trigger a second programmatic scroll in either axis")

state.startPreview()
position = { left: 1200, top: 300 }
state.finishPreview()
state.startPreview()
state.restore()
assert.deepEqual(position, { left: 1200, top: 300 }, "Reopening before restoration keeps the preview visible")
state.finishPreview()
state.restore()
assert.deepEqual(position, { left: 1200, top: 300 }, "Rapid reopening cannot reset the latest scroll position")
detach()

console.info("PASS cancellation preserves latest scroll offsets, date-loading remounts, one-time restoration and successive booking flows")
