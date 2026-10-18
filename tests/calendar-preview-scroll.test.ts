import assert from "node:assert/strict"

import { createCalendarPreviewScrollState } from "../app/lib/calendar-preview-scroll.ts"

const state = createCalendarPreviewScrollState()
let position = { left: 420, top: 715 }
const attach = () => state.attach({
  read: () => ({ ...position }),
  restore: (original) => { position = { ...original } },
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
assert.deepEqual(position, { left: 420, top: 715 }, "Both offsets survive grid unmounts while loading a different date")

position = { left: 500, top: 800 }
state.restore()
assert.deepEqual(position, { left: 500, top: 800 }, "Restoring runs once so later user scrolling stays untouched")

state.startPreview()
position = { left: 900, top: 100 }
state.finishPreview()
state.restore()
assert.deepEqual(position, { left: 500, top: 800 }, "The next booking captures a fresh original scroll position")

state.startPreview()
position = { left: 1200, top: 300 }
state.finishPreview()
state.startPreview()
state.restore()
assert.deepEqual(position, { left: 1200, top: 300 }, "Reopening before restoration keeps the preview visible")
state.finishPreview()
state.restore()
assert.deepEqual(position, { left: 500, top: 800 }, "Rapid reopening retains the original position")
detach()

console.info("PASS preview scroll capture, date-loading remounts, both offsets, one-time restoration and successive booking flows")
