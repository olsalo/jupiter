import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"
import type { inferRouterInputs } from "@trpc/server"
import { QueryClient, QueryObserver, notifyManager } from "@tanstack/react-query"
import type { AppRouter } from "../app/.server/main"
import type { FormEditorDraft } from "../app/lib/forms/form-types"

process.env.NODE_ENV = "test"
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { applyPublishedForm, hasFormEditorChanges, hasUnpublishedFormChanges } = await vite.ssrLoadModule("/app/lib/forms/form-publish-changes.ts") as typeof import("../app/lib/forms/form-publish-changes")
const { buildFormSnapshot } = await vite.ssrLoadModule("/app/lib/forms/form-snapshot.ts") as typeof import("../app/lib/forms/form-snapshot")
const { getFormDraftPayload, reconcileSavedFormDraft } = await vite.ssrLoadModule("/app/lib/forms/form-editor-save.ts") as typeof import("../app/lib/forms/form-editor-save")
const suffix = randomUUID()
const organizations: string[] = []
let userId: string | undefined

type DraftItems = inferRouterInputs<AppRouter>["forms"]["saveDraft"]["sections"][number]["items"]

try {
  const user = await prisma.user.create({ data: { name: "Form test", email: `form-${suffix}@example.invalid` } })
  userId = user.id
  const organization = await prisma.organization.create({ data: { name: "Form test", slug: `form-${suffix}`, createdAt: new Date() } })
  organizations.push(organization.id)
  const otherOrganization = await prisma.organization.create({ data: { name: "Other form test", slug: `other-form-${suffix}`, createdAt: new Date() } })
  organizations.push(otherOrganization.id)
  const context = {
    headers: new Headers(), request: undefined, prisma, user, session: undefined,
    organizationId: organization.id, formatLocale: "fi-FI", formatPreference: "eu" as const, locale: "en" as const,
  }
  const caller = appRouter.createCaller(context)
  const otherCaller = appRouter.createCaller({ ...context, organizationId: otherOrganization.id })
  const publicCaller = appRouter.createCaller({ ...context, user: undefined, organizationId: null })
  const form = await caller.forms.create()
  const emptyOverview = await caller.forms.overview()
  assert.equal(emptyOverview.activeForms, 0)
  assert.equal(emptyOverview.responses, 0)
  assert.equal(emptyOverview.thisWeek, 0)
  assert.equal(emptyOverview.timeZone, "Europe/Helsinki")
  assert.equal(emptyOverview.dailySubmissions.length, 30)
  assert.ok(emptyOverview.dailySubmissions.every((day) => day.value === 0))
  assert.equal(emptyOverview.recentForms.length, 1)
  assert.equal(emptyOverview.recentForms[0].id, form.id)
  assert.equal(emptyOverview.recentForms[0].status, "DRAFT")
  assert.equal(emptyOverview.recentForms[0]._count.submissions, 0)
  assert.deepEqual(emptyOverview.recentResponses, [])
  assert.equal((await caller.forms.overview({ days: 7 })).dailySubmissions.length, 7)
  assert.equal((await caller.forms.overview({ days: 366 })).dailySubmissions.length, 366)
  for (const days of [0, -1, 367, 1.5]) {
    await assert.rejects(caller.forms.overview({ days }), { code: "BAD_REQUEST" })
  }
  await assert.rejects(caller.forms.overview({ endDate: "2026-02-30" }), { code: "BAD_REQUEST" })
  await assert.rejects(publicCaller.forms.overview(), { code: "UNAUTHORIZED" })
  await assert.rejects(appRouter.createCaller({ ...context, organizationId: null }).forms.overview(), { code: "FORBIDDEN" })
  assert.deepEqual(await caller.forms.responses.list({ id: form.id }), [])
  await assert.rejects(otherCaller.forms.responses.list({ id: form.id }), { code: "NOT_FOUND" })
  await assert.rejects(publicCaller.forms.responses.list({ id: form.id }), { code: "UNAUTHORIZED" })
  assert.equal((await caller.forms.settings.get({ id: form.id })).status, true)
  await assert.rejects(otherCaller.forms.settings.get({ id: form.id }), { code: "NOT_FOUND" })
  await assert.rejects(otherCaller.forms.settings.update({ id: form.id, settings: { status: false } }), { code: "NOT_FOUND" })
  await assert.rejects(publicCaller.forms.settings.get({ id: form.id }), { code: "UNAUTHORIZED" })
  await assert.rejects(publicCaller.forms.settings.update({ id: form.id, settings: { status: false } }), { code: "UNAUTHORIZED" })
  assert.equal((await caller.forms.settings.get({ id: form.id })).isPublished, false)
  for (const settings of [{ status: false }, { startsAt: "2099-01-01T00:00:00Z" }, { closesAt: null }]) {
    await assert.rejects(caller.forms.settings.update({ id: form.id, settings }), { code: "BAD_REQUEST" })
  }
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "NOT_FOUND" })
  assert.equal((await caller.forms.get({ id: form.id })).status, "DRAFT")
  console.info("PASS settings defaults, organization isolation, authentication, and availability disabled before publishing")
  let draft = await caller.forms.get({ id: form.id })
  assert.equal(draft.hasUnpublishedChanges, false, "A new untouched form must not enable publishing")
  await assert.rejects(caller.forms.publish({ id: form.id, revision: draft.draftRevision }), {
    code: "BAD_REQUEST", message: "Add at least one question before publishing.",
  })
  assert.equal(await prisma.formVersion.count({ where: { formId: form.id } }), 0)
  assert.equal(draft.sections.length, 1)
  const sectionId = draft.sections[0].id
  const textId = `item-${randomUUID()}`
  const choiceId = `item-${randomUUID()}`
  const blockId = `item-${randomUUID()}`
  const firstOptionId = `option-${randomUUID()}`
  const secondOptionId = `option-${randomUUID()}`
  let items: DraftItems = [
    { id: blockId, type: "TEXT_BLOCK", label: "About you", description: "A little about yourself." },
    { id: textId, type: "SHORT_TEXT", label: "", description: "Draft description", required: true, validation: { maxLength: 50 } },
    {
      id: choiceId, type: "SINGLE_CHOICE", label: "Choose one", description: "", required: true, allowOther: true,
      options: [{ id: firstOptionId, label: "First", value: "first" }, { id: secondOptionId, label: "Second", value: "second" }],
    },
  ]
  const save = async (next: DraftItems) => {
    draft = await caller.forms.saveDraft({ id: form.id, revision: draft.draftRevision, sections: [{ id: sectionId, items: next }] })
    items = next
    return draft
  }
  const publish = () => caller.forms.publish({ id: form.id, revision: draft.draftRevision })
  await assert.rejects(otherCaller.forms.get({ id: form.id }), { code: "NOT_FOUND" })
  await assert.rejects(otherCaller.forms.saveDraft({ id: form.id, revision: 0, sections: [{ id: sectionId, items: [] }] }), { code: "NOT_FOUND" })
  await assert.rejects(otherCaller.forms.publish({ id: form.id, revision: 0 }), { code: "NOT_FOUND" })
  await assert.rejects(publicCaller.forms.get({ id: form.id }), { code: "UNAUTHORIZED" })
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "NOT_FOUND" })
  await save(items)
  assert.equal(draft.draftRevision, 1)
  assert.equal(draft.hasUnpublishedChanges, true, "Editing must enable publishing with blank question text")
  assert.deepEqual(draft.sections[0].items.map((item) => item.id), [blockId, textId, choiceId])
  assert.equal(draft.sections[0].items[0].required, false)
  assert.equal((draft.sections[0].items[1].validation as { minLength: number }).minLength, 1)
  assert.equal(buildFormSnapshot(draft).sections[0].items[1].label, "", "Blank question text must work in preview and publishing")
  const blankLabelsSnapshot = buildFormSnapshot({
    ...draft,
    sections: draft.sections.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item, label: "" })) })),
  })
  assert.ok(blankLabelsSnapshot.sections[0].items.every((item) => item.label === ""))
  assert.equal(await prisma.formVersion.count({ where: { formId: form.id } }), 0)
  const staleRevision = draft.draftRevision
  await save(items.map((item) => item.id === textId ? { ...item, label: "Your name" } : item))
  await assert.rejects(caller.forms.saveDraft({ id: form.id, revision: staleRevision, sections: [{ id: sectionId, items: [] }] }), { code: "CONFLICT" })
  assert.equal((await caller.forms.get({ id: form.id })).sections[0].items.length, 3)
  await assert.rejects(caller.forms.publish({ id: form.id, revision: staleRevision }), { code: "CONFLICT" })
  const optionRewrite = items.map((item) => item.type === "SINGLE_CHOICE" ? { ...item, options: item.options.map((option) => ({ ...option, value: `${option.value}-changed` })) } : item)
  await assert.rejects(caller.forms.saveDraft({ id: form.id, revision: draft.draftRevision, sections: [{ id: sectionId, items: optionRewrite }] }), { code: "BAD_REQUEST" })
  assert.equal((await caller.forms.get({ id: form.id })).draftRevision, draft.draftRevision)
  console.info("PASS default section, organization isolation, atomic saves, revisions, and stable option values")

  const submittedDraft = draft
  const first = await publish()
  assert.equal((await caller.forms.overview()).activeForms, 1)
  assert.equal((await otherCaller.forms.overview()).responses, 0)
  assert.ok((await otherCaller.forms.overview()).dailySubmissions.every((day) => day.value === 0))
  assert.equal((await caller.forms.get({ id: form.id })).hasUnpublishedChanges, false, "Publishing must disable Publish until content changes again")
  const initialPublic = await publicCaller.publicForms.get({ id: form.id })
  assert.equal(initialPublic.versionId, first.versionId)
  const initialSnapshot = initialPublic.snapshot
  const publishedDraft = await caller.forms.get({ id: form.id })
  assert.deepEqual(publishedDraft.publishedSnapshot, initialSnapshot)
  const statusCache = new QueryClient()
  const statusKey = ["form-publish-status", form.id]
  statusCache.setQueryData(statusKey, submittedDraft)
  const statusObserver = new QueryObserver<FormEditorDraft>(statusCache, { queryKey: statusKey, enabled: false })
  let observedDraft = statusObserver.getCurrentResult().data
  const delayedNotifications: (() => void)[] = []
  notifyManager.setScheduler((callback) => { delayedNotifications.push(callback) })
  const unsubscribeStatus = statusObserver.subscribe(notifyManager.batchCalls((result) => { observedDraft = result.data }))
  try {
    statusCache.setQueryData(statusKey, applyPublishedForm(submittedDraft, submittedDraft, first.version))
    assert.equal(observedDraft?.status, "DRAFT", "Observer notifications reproduce the delayed query update")
    const confirmedDraft = statusCache.getQueryData<FormEditorDraft>(statusKey)!
    assert.equal(confirmedDraft.status, "PUBLISHED")
    assert.deepEqual(confirmedDraft.publishedSnapshot, initialSnapshot)
    assert.equal(hasFormEditorChanges(submittedDraft, confirmedDraft), false, "The badge must clear before query observers catch up")
    assert.equal(hasFormEditorChanges({ ...submittedDraft, title: "Edited while publishing" }, confirmedDraft), true)
    const newerSaved = { ...confirmedDraft, draftRevision: confirmedDraft.draftRevision + 1, title: "Saved while publishing" }
    const withNewerChanges = applyPublishedForm(newerSaved, submittedDraft, first.version)
    assert.equal(withNewerChanges.title, newerSaved.title)
    assert.equal(withNewerChanges.hasUnpublishedChanges, true)
    assert.equal(applyPublishedForm({ ...confirmedDraft, publishedVersion: first.version + 1 }, submittedDraft, first.version).publishedVersion, first.version + 1)
  } finally {
    unsubscribeStatus()
    delayedNotifications.forEach((callback) => callback())
    notifyManager.setScheduler((callback) => { setTimeout(callback, 0) })
    statusCache.clear()
  }
  console.info("PASS publishing updates the badge before delayed query notifications and preserves newer edits and versions")
  const localBeforeSave = {
    ...publishedDraft,
    sections: publishedDraft.sections.map((section) => ({ ...section, items: section.items.map((item) => item.id === textId
      ? { ...item, label: " Your name ", description: " Draft description ", validation: { maxLength: 50 } }
      : item) })),
  }
  const submitted = JSON.stringify(getFormDraftPayload(localBeforeSave))
  assert.equal(hasUnpublishedFormChanges(localBeforeSave, initialSnapshot), true, "Server-normalized values reproduce the stale published badge")
  const reconciled = reconcileSavedFormDraft(localBeforeSave, publishedDraft, submitted)
  assert.equal(hasUnpublishedFormChanges(reconciled, initialSnapshot), false, "Saved normalization must not leave unpublished changes after publishing")
  assert.deepEqual(reconciled.sections, publishedDraft.sections)
  const newerEdits = { ...localBeforeSave, title: "Edited during save" }
  const withNewerEdits = reconcileSavedFormDraft(newerEdits, publishedDraft, submitted)
  assert.equal(withNewerEdits.title, newerEdits.title, "Edits made during a save must survive normalization")
  assert.deepEqual(withNewerEdits.sections, newerEdits.sections)
  assert.equal(withNewerEdits.draftRevision, publishedDraft.draftRevision)
  assert.equal(hasUnpublishedFormChanges(withNewerEdits, initialSnapshot), true)
  console.info("PASS server normalization clears the published badge without losing edits made during saving")
  assert.equal(hasUnpublishedFormChanges({ ...publishedDraft, title: "Client edit" }, publishedDraft.publishedSnapshot), true, "Client edits enable Publish without an autosave")
  assert.equal(hasUnpublishedFormChanges(publishedDraft, publishedDraft.publishedSnapshot), false, "Reverting client edits disables Publish without an autosave")
  assert.equal("organizationId" in initialSnapshot, false)
  assert.equal("draftRevision" in initialSnapshot, false)
  const values = { respondentEmail: "", [textId]: "Olli", [choiceId]: "first", [`${choiceId}:other`]: "" }
  await caller.forms.settings.update({ id: form.id, settings: { status: false } })
  assert.equal((await caller.forms.overview()).activeForms, 0)
  assert.equal((await caller.forms.settings.get({ id: form.id })).status, false)
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "NOT_FOUND" })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values }), { code: "NOT_FOUND" })
  assert.equal(await prisma.formSubmission.count({ where: { formId: form.id } }), 0)
  assert.equal((await caller.forms.get({ id: form.id })).draftRevision, draft.draftRevision)
  await caller.forms.settings.update({ id: form.id, settings: { status: true } })
  assert.deepEqual((await publicCaller.publicForms.get({ id: form.id })).snapshot, initialSnapshot)
  console.info("PASS disabling blocks public reads and in-progress submissions, and re-enabling preserves the published version")
  const { validateAvailability } = await vite.ssrLoadModule("/app/.server/services/forms/public-form.ts") as typeof import("../app/.server/services/forms/public-form")
  await assert.rejects(caller.forms.settings.update({ id: form.id, settings: { closesAt: "2026-02-30T12:00:00Z" } }), { code: "BAD_REQUEST" })
  await caller.forms.settings.update({ id: form.id, settings: { closesAt: "2099-06-01T23:30:00+03:00" } })
  const scheduled = await caller.forms.settings.get({ id: form.id })
  assert.equal(scheduled.closesAt, "2099-06-01T20:30:00.000Z")
  assert.equal(scheduled.timeZone, "Europe/Helsinki")
  const scheduledForm = await prisma.form.findUniqueOrThrow({ where: { id: form.id } })
  validateAvailability(scheduledForm, 0, new Date("2099-06-01T20:29:59.999Z"))
  assert.throws(() => validateAvailability(scheduledForm, 0, new Date("2099-06-01T20:30:00.000Z")), { code: "FORBIDDEN" })
  await caller.forms.settings.update({ id: form.id, settings: { status: false } })
  assert.equal((await caller.forms.settings.get({ id: form.id })).closesAt, scheduled.closesAt)
  await caller.forms.settings.update({ id: form.id, settings: { status: true, closesAt: "2000-01-01T00:00:00Z" } })
  assert.equal((await caller.forms.overview()).activeForms, 0)
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "FORBIDDEN" })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values }), { code: "FORBIDDEN" })
  await caller.forms.settings.update({ id: form.id, settings: { closesAt: null, startsAt: "2099-06-01T08:00:00+03:00" } })
  assert.equal((await caller.forms.overview()).activeForms, 0)
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "FORBIDDEN" })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values }), { code: "FORBIDDEN" })
  await assert.rejects(caller.forms.settings.update({ id: form.id, settings: { closesAt: "2099-06-01T05:00:00Z" } }), (error: unknown) => {
    assert.ok(error && typeof error === "object" && "cause" in error)
    assert.equal((error.cause as { issues: { path: string[] }[] }).issues[0].path[0], "closesAt")
    return true
  })
  await caller.forms.settings.update({ id: form.id, settings: { closesAt: "2099-06-01T20:30:00Z" } })
  await assert.rejects(caller.forms.settings.update({ id: form.id, settings: { startsAt: "2099-06-02T00:00:00Z" } }), (error: unknown) => {
    assert.ok(error && typeof error === "object" && "cause" in error)
    assert.equal((error.cause as { issues: { path: string[] }[] }).issues[0].path[0], "startsAt")
    return true
  })
  const openingForm = await prisma.form.findUniqueOrThrow({ where: { id: form.id } })
  assert.throws(() => validateAvailability(openingForm, 0, new Date("2099-06-01T04:59:59.999Z")), { code: "FORBIDDEN" })
  validateAvailability(openingForm, 0, new Date("2099-06-01T05:00:00Z"))
  await caller.forms.settings.update({ id: form.id, settings: { startsAt: null, closesAt: null } })
  assert.deepEqual((await publicCaller.publicForms.get({ id: form.id })).snapshot, initialSnapshot)
  assert.equal((await caller.forms.get({ id: form.id })).draftRevision, draft.draftRevision)
  await prisma.organizationSettings.create({ data: { organizationId: organization.id, timezone: "America/Los_Angeles" } })
  assert.equal((await caller.forms.settings.get({ id: form.id })).timeZone, "America/Los_Angeles")
  console.info("PASS live opening and closing times, exact cutoffs, date ordering, timezone metadata, and clearing schedules without changing published content")
  await Promise.all([
    caller.forms.settings.update({ id: form.id, settings: { status: false } }),
    caller.forms.settings.update({ id: form.id, settings: { closesAt: "2099-06-01T20:30:00Z" } }),
  ])
  const concurrentSettings = await caller.forms.settings.get({ id: form.id })
  assert.equal(concurrentSettings.status, false)
  assert.equal(concurrentSettings.closesAt, "2099-06-01T20:30:00.000Z")
  await caller.forms.settings.update({ id: form.id, settings: { closesAt: null } })
  assert.equal((await caller.forms.settings.get({ id: form.id })).status, false)
  await assert.rejects(caller.forms.settings.update({ id: form.id, settings: {} }), { code: "BAD_REQUEST" })
  await caller.forms.settings.update({ id: form.id, settings: { status: true } })
  console.info("PASS simultaneous setting updates preserve both changes and clearing a date preserves availability")

  const settingsForm = await caller.forms.create()
  const defaults = await caller.forms.settings.get({ id: settingsForm.id })
  assert.equal(defaults.emailCollection, "NONE")
  assert.equal(defaults.theme, "LIGHT")
  assert.equal(defaults.accentColor, null)
  const requiredEmail = await caller.forms.settings.update({ id: settingsForm.id, settings: { limitOneResponsePerEmail: true } })
  assert.equal(requiredEmail.emailCollection, "REQUIRED")
  assert.equal(requiredEmail.limitOneResponsePerEmail, true)
  const optionalEmail = await caller.forms.settings.update({ id: settingsForm.id, settings: { emailCollection: "OPTIONAL" } })
  assert.equal(optionalEmail.limitOneResponsePerEmail, false)
  for (const invalid of [
    { emailCollection: "OPTIONAL" as const, limitOneResponsePerEmail: true },
    { redirectUrl: "javascript:alert(1)" },
    { redirectUrl: "ftp://example.com" },
    { accentColor: "red" },
    { submitButtonText: " " },
    { successMessage: " " },
  ]) await assert.rejects(caller.forms.settings.update({ id: settingsForm.id, settings: invalid }), { code: "BAD_REQUEST" })
  await Promise.all([
    caller.forms.settings.update({ id: settingsForm.id, settings: { submitButtonText: "Send feedback", successMessage: "Kiitos vastauksestasi!", redirectUrl: "https://example.com/thanks" } }),
    caller.forms.settings.update({ id: settingsForm.id, settings: { theme: "LIGHT", accentColor: "#facc15" } }),
  ])
  const emptySettingsDraft = await caller.forms.get({ id: settingsForm.id })
  const settingsDraft = await caller.forms.saveDraft({
    id: settingsForm.id,
    revision: emptySettingsDraft.draftRevision,
    sections: emptySettingsDraft.sections.map((section) => ({
      id: section.id,
      items: [{ id: `item-${randomUUID()}`, type: "SHORT_TEXT", label: "Feedback", description: "Tell us about your visit.", required: false }],
    })),
  })
  const settingsVersion = await caller.forms.publish({ id: settingsForm.id, revision: settingsDraft.draftRevision })
  const settingsSnapshot = (await publicCaller.publicForms.get({ id: settingsForm.id })).snapshot
  assert.equal(settingsSnapshot.settings.emailCollection, "OPTIONAL")
  assert.equal(settingsSnapshot.settings.submitButtonText, "Send feedback")
  assert.equal(settingsSnapshot.appearance.theme, "LIGHT")
  assert.equal(settingsSnapshot.appearance.accentColor, "#facc15")
  const trimmedRedirect = await caller.forms.settings.update({ id: settingsForm.id, settings: { redirectUrl: "  https://example.com/thanks  " } })
  assert.equal(trimmedRedirect.redirectUrl, "https://example.com/thanks")
  const optionalSubmission = await publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "" } })
  assert.equal(optionalSubmission.successMessage, "Kiitos vastauksestasi!")
  assert.equal(optionalSubmission.redirectUrl, "https://example.com/thanks")
  await assert.rejects(publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "invalid" } }), { code: "BAD_REQUEST" })
  await caller.forms.settings.update({ id: settingsForm.id, settings: { emailCollection: "NONE", theme: "DARK", redirectUrl: null, accentColor: null } })
  const liveSettingsForm = await publicCaller.publicForms.get({ id: settingsForm.id })
  assert.equal(liveSettingsForm.versionId, settingsVersion.versionId)
  assert.equal(liveSettingsForm.snapshot.settings.emailCollection, "NONE")
  assert.equal(liveSettingsForm.snapshot.settings.redirectUrl, null)
  assert.equal(liveSettingsForm.snapshot.appearance.theme, "DARK")
  assert.equal(liveSettingsForm.snapshot.appearance.accentColor, null)
  assert.equal((await caller.forms.get({ id: settingsForm.id })).draftRevision, settingsDraft.draftRevision)
  assert.deepEqual((await prisma.formVersion.findUniqueOrThrow({ where: { id: settingsVersion.versionId } })).snapshot, settingsSnapshot)
  const noEmailSubmission = await publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "previous@example.com" } })
  assert.equal(noEmailSubmission.redirectUrl, null)
  assert.equal((await prisma.formSubmission.findUniqueOrThrow({ where: { id: noEmailSubmission.submissionId } })).respondentEmail, null)
  await caller.forms.settings.update({ id: settingsForm.id, settings: { emailCollection: "OPTIONAL", successMessage: "Updated thanks", redirectUrl: "https://example.com/new" } })
  const historicalEmailSubmission = await publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "history@example.com" } })
  assert.equal(historicalEmailSubmission.successMessage, "Updated thanks")
  assert.equal(historicalEmailSubmission.redirectUrl, "https://example.com/new")
  await caller.forms.settings.update({ id: settingsForm.id, settings: { limitOneResponsePerEmail: true } })
  await assert.rejects(publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "" } }), { code: "BAD_REQUEST" })
  await assert.rejects(publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: " History@Example.com " } }), { code: "BAD_REQUEST" })
  await publicCaller.publicForms.submit({ id: settingsForm.id, versionId: settingsVersion.versionId, values: { respondentEmail: "fresh@example.com" } })
  console.info("PASS settings apply immediately to published forms and in-progress submissions, preserve published question snapshots/revisions, and enforce email limits across existing responses")
  const invalidAnswers = [
    { ...values, [textId]: "" },
    { ...values, [textId]: "x".repeat(51) },
    { ...values, [choiceId]: "First" },
    { ...values, [choiceId]: `other:${choiceId}` },
    { ...values, [blockId]: "not an answer" },
    { ...values, rogue: "unknown item" },
  ]
  for (const invalid of invalidAnswers) {
    await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values: invalid }), { code: "BAD_REQUEST" })
  }
  assert.equal(await prisma.formSubmission.count({ where: { formId: form.id } }), 0)
  const firstSubmission = await publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values })
  const storedSubmission = await prisma.formSubmission.findUniqueOrThrow({ where: { id: firstSubmission.submissionId }, include: { answers: true } })
  assert.equal(storedSubmission.formVersionId, first.versionId)
  assert.equal(storedSubmission.respondentEmail, null)
  assert.equal(storedSubmission.dedupeKey, null)
  assert.deepEqual(new Set(storedSubmission.answers.map((answer) => answer.itemId)), new Set([textId, choiceId]))
  assert.equal(storedSubmission.answers.find((answer) => answer.itemId === choiceId)?.value, "first")
  await publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values: { ...values, [choiceId]: `other:${choiceId}`, [`${choiceId}:other`]: "Something else" } })

  await save(items.filter((item) => item.id !== textId).map((item) => item.type === "SINGLE_CHOICE" ? { ...item, options: [...item.options].reverse().map((option) => ({ ...option, label: `${option.label} renamed` })) } : item))
  assert.deepEqual((await publicCaller.publicForms.get({ id: form.id })).snapshot, initialSnapshot)
  assert.equal(await prisma.formItem.count({ where: { id: textId } }), 0)
  assert.equal(await prisma.formAnswer.count({ where: { itemId: textId } }), 2)
  const second = await publish()
  assert.equal(second.version, 2)
  assert.deepEqual((await prisma.formVersion.findUniqueOrThrow({ where: { id: first.versionId } })).snapshot, initialSnapshot)
  const secondPublic = await publicCaller.publicForms.get({ id: form.id })
  assert.equal(secondPublic.snapshot.sections[0].items.length, 2)
  assert.equal(secondPublic.snapshot.sections[0].items[1].options[0].value, "second")
  await publicCaller.publicForms.submit({ id: form.id, versionId: first.versionId, values })
  console.info("PASS immutable publishing, snapshot-only rendering, old-version submissions, and historical answers after deletion")
  const responseList = await caller.forms.responses.list({ id: form.id })
  assert.equal(responseList.length, 3)
  assert.equal(responseList[0].respondentEmail, null)
  assert.ok(responseList.every((response, index) => index === 0 || response.submittedAt <= responseList[index - 1].submittedAt))
  const historicalResponse = await caller.forms.responses.get({ id: form.id, submissionId: firstSubmission.submissionId })
  const historicalAnswers = historicalResponse.sections.flatMap((section) => section.answers)
  assert.deepEqual(historicalAnswers.map((answer) => answer.id), [textId, choiceId])
  assert.deepEqual(historicalAnswers.find((answer) => answer.id === textId)?.values, [values[textId]])
  assert.deepEqual(historicalAnswers.find((answer) => answer.id === choiceId)?.values, ["First"])
  const otherResponseId = responseList.find((response) => response.id !== firstSubmission.submissionId && response.id !== responseList[0].id)!.id
  assert.deepEqual((await caller.forms.responses.get({ id: form.id, submissionId: otherResponseId })).sections[0].answers.find((answer) => answer.id === choiceId)?.values, ["Something else"])
  await assert.rejects(otherCaller.forms.responses.get({ id: form.id, submissionId: firstSubmission.submissionId }), { code: "NOT_FOUND" })
  await assert.rejects(publicCaller.forms.responses.get({ id: form.id, submissionId: firstSubmission.submissionId }), { code: "UNAUTHORIZED" })
  await assert.rejects(caller.forms.responses.get({ id: settingsForm.id, submissionId: firstSubmission.submissionId }), { code: "NOT_FOUND" })
  console.info("PASS response reading preserves historical questions and labels, lists newest first, and enforces organization and form isolation")

  const copy = await caller.forms.duplicate({ id: form.id })
  const copyDraft = await caller.forms.get({ id: copy.id })
  assert.equal(copy.status, "DRAFT")
  assert.equal(copy.publishedVersion, null)
  assert.notEqual(copy.slug, form.slug)
  assert.notEqual(copyDraft.sections[0].id, sectionId)
  assert.notEqual(copyDraft.sections[0].items[1].id, choiceId)
  assert.deepEqual(copyDraft.sections[0].items[1].options.map((option) => option.value), draft.sections[0].items[1].options.map((option) => option.value))
  await assert.rejects(publicCaller.publicForms.submit({ id: copy.id, versionId: first.versionId, values }), { code: "NOT_FOUND" })
  const copyPublished = await caller.forms.publish({ id: copy.id, revision: 0 })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: copyPublished.versionId, values }), { code: "BAD_REQUEST" })
  console.info("PASS form duplication remaps section/item IDs and rejects versions belonging to another form")

  await prisma.form.update({ where: { id: form.id }, data: { emailCollection: "REQUIRED", limitOneResponsePerEmail: true } })
  const emailVersion = await publish()
  const emailValues = { respondentEmail: "  Person@Example.com  ", [choiceId]: "first", [`${choiceId}:other`]: "" }
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: { ...emailValues, respondentEmail: "" } }), { code: "BAD_REQUEST" })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: { ...emailValues, respondentEmail: "wrong" } }), { code: "BAD_REQUEST" })
  const duplicateResults = await Promise.allSettled([
    publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: emailValues }),
    publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: { ...emailValues, respondentEmail: "person@example.com" } }),
  ])
  assert.equal(duplicateResults.filter((result) => result.status === "fulfilled").length, 1)
  const duplicate = duplicateResults.find((result) => result.status === "rejected")
  assert.ok(duplicate && duplicate.status === "rejected")
  assert.equal(duplicate.reason.cause.flatten().fieldErrors.respondentEmail[0], "A response has already been sent with this email address.")
  const emailSubmission = await prisma.formSubmission.findUniqueOrThrow({ where: { formId_dedupeKey: { formId: form.id, dedupeKey: "person@example.com" } } })
  assert.equal(emailSubmission.respondentEmail, "person@example.com")
  console.info("PASS normalized email identity, input errors, and concurrent duplicate protection")

  const countBeforeLimit = await prisma.formSubmission.count({ where: { formId: form.id } })
  const activeBeforeLimit = (await caller.forms.overview()).activeForms
  await prisma.form.update({ where: { id: form.id }, data: { responseLimit: countBeforeLimit + 1 } })
  const limitedResults = await Promise.allSettled([
    publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: { ...emailValues, respondentEmail: "first@example.com" } }),
    publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: { ...emailValues, respondentEmail: "second@example.com" } }),
  ])
  assert.equal(limitedResults.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(await prisma.formSubmission.count({ where: { formId: form.id } }), countBeforeLimit + 1)
  assert.equal((await caller.forms.overview()).activeForms, activeBeforeLimit - 1)
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "FORBIDDEN" })
  await prisma.form.update({ where: { id: form.id }, data: { responseLimit: null, startsAt: new Date(Date.now() + 60000) } })
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "FORBIDDEN" })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: emailValues }), { code: "FORBIDDEN" })
  await prisma.form.update({ where: { id: form.id }, data: { startsAt: null, closesAt: new Date(Date.now() - 60000) } })
  await assert.rejects(publicCaller.publicForms.get({ id: form.id }), { code: "FORBIDDEN" })
  await prisma.form.update({ where: { id: form.id }, data: { closesAt: null, status: "CLOSED" } })
  await assert.rejects(publicCaller.publicForms.submit({ id: form.id, versionId: emailVersion.versionId, values: emailValues }), { code: "NOT_FOUND" })
  console.info("PASS live schedules, closed forms, and concurrent response limits")

  // Unsupported draft types survive reads/saves but cannot be silently published.
  const unsupported = await prisma.formItem.create({ data: { sectionId: copyDraft.sections[0].id, type: "EMAIL", label: "Future field", sortOrder: 2, validation: { customFutureRule: true } } })
  const latestCopy = await caller.forms.get({ id: copy.id })
  await caller.forms.saveDraft({ id: copy.id, revision: latestCopy.draftRevision, sections: [{ id: copyDraft.sections[0].id, items: [
    ...latestCopy.sections[0].items.filter((item) => item.id !== unsupported.id).map((item) => item.type === "TEXT_BLOCK"
      ? { id: item.id, type: "TEXT_BLOCK" as const, label: item.label, description: item.description ?? "" }
      : { id: item.id, type: "SINGLE_CHOICE" as const, label: item.label, description: item.description ?? "", required: item.required, allowOther: true, options: item.options }),
    { id: unsupported.id, type: "EMAIL" },
  ] }] })
  assert.deepEqual((await prisma.formItem.findUniqueOrThrow({ where: { id: unsupported.id } })).validation, { customFutureRule: true })
  await assert.rejects(caller.forms.publish({ id: copy.id, revision: latestCopy.draftRevision + 1 }), { code: "BAD_REQUEST" })
  assert.equal(await prisma.formVersion.count({ where: { formId: copy.id } }), 1)
  console.info("PASS unsupported features stay in the draft and cannot be published without runtime support")

  const headingForm = await caller.forms.create()
  let headingDraft = await caller.forms.get({ id: headingForm.id })
  assert.equal(headingDraft.title, headingForm.title)
  const emptyHeadingSections = headingDraft.sections.map((section) => ({ id: section.id, items: [] }))
  headingDraft = await caller.forms.saveDraft({
    id: headingForm.id, revision: headingDraft.draftRevision, sections: emptyHeadingSections,
    title: "  Asiakaspalaute  ", description: "  Kerro kokemuksestasi.  ",
  })
  assert.equal(headingDraft.title, "Asiakaspalaute")
  assert.equal(headingDraft.description, "Kerro kokemuksestasi.")
  assert.equal((await caller.forms.list()).find((form) => form.id === headingForm.id)?.title, headingDraft.title)
  await assert.rejects(caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision }), {
    code: "BAD_REQUEST", message: "Add at least one question before publishing.",
  })
  assert.equal(await prisma.formVersion.count({ where: { formId: headingForm.id } }), 0)
  assert.equal((await caller.forms.get({ id: headingForm.id })).status, "DRAFT")
  const textOnlyHeadingSections = headingDraft.sections.map((section) => ({
    id: section.id,
    items: [{ id: `item-${randomUUID()}`, type: "TEXT_BLOCK" as const, label: "Tietoa", description: "Kerro kokemuksestasi." }],
  }))
  headingDraft = await caller.forms.saveDraft({ id: headingForm.id, revision: headingDraft.draftRevision, sections: textOnlyHeadingSections })
  await assert.rejects(caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision }), {
    code: "BAD_REQUEST", message: "Add at least one question before publishing.",
  })
  assert.equal(await prisma.formVersion.count({ where: { formId: headingForm.id } }), 0)
  const headingSections = headingDraft.sections.map((section) => ({
    id: section.id,
    items: [{ id: `item-${randomUUID()}`, type: "SHORT_TEXT" as const, label: "", description: "", required: false }],
  }))
  headingDraft = await caller.forms.saveDraft({ id: headingForm.id, revision: headingDraft.draftRevision, sections: headingSections })
  const headingVersion = await caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision })
  const headingSnapshot = (await publicCaller.publicForms.get({ id: headingForm.id })).snapshot
  assert.equal(headingSnapshot.title, "Asiakaspalaute")
  assert.equal(headingSnapshot.description, "Kerro kokemuksestasi.")
  assert.equal(headingSnapshot.sections[0].items[0].label, "", "A question with blank text must publish successfully")
  headingDraft = await caller.forms.saveDraft({
    id: headingForm.id, revision: headingDraft.draftRevision, sections: headingSections,
    title: "Uusi nimi", description: "",
  })
  assert.equal(headingDraft.description, null)
  assert.equal(headingDraft.hasUnpublishedChanges, true, "Published forms must enable Publish when their heading changes")
  await assert.rejects(caller.forms.saveDraft({
    id: headingForm.id, revision: headingDraft.draftRevision - 1, sections: headingSections,
    title: "Stale name", description: "Stale description",
  }), { code: "CONFLICT" })
  assert.equal((await caller.forms.get({ id: headingForm.id })).title, "Uusi nimi")
  assert.deepEqual((await publicCaller.publicForms.get({ id: headingForm.id })).snapshot, headingSnapshot)
  await caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision })
  const newHeadingSnapshot = (await publicCaller.publicForms.get({ id: headingForm.id })).snapshot
  assert.equal(newHeadingSnapshot.title, "Uusi nimi")
  assert.equal(newHeadingSnapshot.description, null)
  assert.deepEqual((await prisma.formVersion.findUniqueOrThrow({ where: { id: headingVersion.versionId } })).snapshot, headingSnapshot)
  // Removing or reordering all body items cannot remove the form-level heading.
  headingDraft = await caller.forms.saveDraft({ id: headingForm.id, revision: headingDraft.draftRevision, sections: emptyHeadingSections })
  assert.equal(headingDraft.title, "Uusi nimi")
  await assert.rejects(caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision }), {
    code: "BAD_REQUEST", message: "Add at least one question before publishing.",
  })
  assert.equal(await prisma.formVersion.count({ where: { formId: headingForm.id } }), 2)
  assert.deepEqual((await publicCaller.publicForms.get({ id: headingForm.id })).snapshot, newHeadingSnapshot)
  headingDraft = await caller.forms.saveDraft({ id: headingForm.id, revision: headingDraft.draftRevision, sections: textOnlyHeadingSections })
  await assert.rejects(caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision }), {
    code: "BAD_REQUEST", message: "Add at least one question before publishing.",
  })
  assert.equal(await prisma.formVersion.count({ where: { formId: headingForm.id } }), 2)
  assert.deepEqual((await publicCaller.publicForms.get({ id: headingForm.id })).snapshot, newHeadingSnapshot)
  console.info("PASS empty and text-only forms cannot be published, and removing every question preserves the published version")
  headingDraft = await caller.forms.saveDraft({ id: headingForm.id, revision: headingDraft.draftRevision, title: "", sections: headingSections })
  await assert.rejects(caller.forms.publish({ id: headingForm.id, revision: headingDraft.draftRevision }), { code: "BAD_REQUEST" })
  const invalidHeadingRevision = headingDraft.draftRevision
  await assert.rejects(caller.forms.saveDraft({ id: headingForm.id, revision: invalidHeadingRevision, title: "x".repeat(501), sections: headingSections }), { code: "BAD_REQUEST" })
  assert.equal((await caller.forms.get({ id: headingForm.id })).draftRevision, invalidHeadingRevision)
  console.info("PASS form heading names, optional descriptions, concurrent saves, immutable publishing, and title validation")
  const multiForm = await caller.forms.create()
  let multiDraft = await caller.forms.get({ id: multiForm.id })
  const multiId = `item-${randomUUID()}`
  const multiItem = {
    id: multiId, type: "MULTIPLE_CHOICE" as const, label: "Choose your services", description: "", required: true, allowOther: true,
    options: [
      { id: `option-${randomUUID()}`, label: "Cleaning", value: "cleaning" },
      { id: `option-${randomUUID()}`, label: "Repairs", value: "repairs" },
    ],
    defaultValue: ["cleaning"],
  }
  multiDraft = await caller.forms.saveDraft({
    id: multiForm.id, revision: multiDraft.draftRevision,
    sections: [{ id: multiDraft.sections[0].id, items: [multiItem] }],
  })
  assert.deepEqual(multiDraft.sections[0].items[0].defaultValue, ["cleaning"])
  const multiVersion = await caller.forms.publish({ id: multiForm.id, revision: multiDraft.draftRevision })
  await caller.forms.settings.update({ id: multiForm.id, settings: { status: false } })
  await caller.forms.publish({ id: multiForm.id, revision: multiDraft.draftRevision })
  assert.equal((await caller.forms.settings.get({ id: multiForm.id })).status, false)
  await assert.rejects(publicCaller.publicForms.get({ id: multiForm.id }), { code: "NOT_FOUND" })
  await caller.forms.settings.update({ id: multiForm.id, settings: { status: true } })
  console.info("PASS publishing does not re-enable a disabled form")
  const multiSnapshot = (await publicCaller.publicForms.get({ id: multiForm.id })).snapshot
  assert.equal(multiSnapshot.sections[0].items[0].type, "MULTIPLE_CHOICE")
  const { defaultAnswerValues } = await vite.ssrLoadModule("/app/lib/forms/form-validation.ts") as typeof import("../app/lib/forms/form-validation")
  assert.deepEqual(defaultAnswerValues(multiSnapshot)[multiId], ["cleaning"])
  const multiValues = { respondentEmail: "", [multiId]: ["cleaning", "repairs"], [`${multiId}:other`]: "" }
  for (const invalid of [
    { ...multiValues, [multiId]: [] },
    { respondentEmail: "" },
    { ...multiValues, [multiId]: "cleaning" },
    { ...multiValues, [multiId]: ["unknown"] },
    { ...multiValues, [multiId]: ["cleaning", "cleaning"] },
    { ...multiValues, [multiId]: [`other:${multiId}`] },
  ]) {
    await assert.rejects(publicCaller.publicForms.submit({ id: multiForm.id, versionId: multiVersion.versionId, values: invalid }), { code: "BAD_REQUEST" })
  }
  const multiSubmission = await publicCaller.publicForms.submit({ id: multiForm.id, versionId: multiVersion.versionId, values: multiValues })
  const multiAnswer = await prisma.formAnswer.findFirstOrThrow({ where: { submissionId: multiSubmission.submissionId } })
  assert.deepEqual(multiAnswer.value, ["cleaning", "repairs"])
  const otherSubmission = await publicCaller.publicForms.submit({ id: multiForm.id, versionId: multiVersion.versionId, values: {
    ...multiValues, [multiId]: ["cleaning", `other:${multiId}`], [`${multiId}:other`]: "  Gardening  ",
  } })
  assert.deepEqual((await prisma.formAnswer.findFirstOrThrow({ where: { submissionId: otherSubmission.submissionId } })).value, {
    value: ["cleaning", `other:${multiId}`], other: "Gardening",
  })
  const renderedMulti = await caller.forms.responses.get({ id: multiForm.id, submissionId: multiSubmission.submissionId })
  assert.deepEqual(renderedMulti.sections[0].answers[0].values, ["Cleaning", "Repairs"])
  const renderedOther = await caller.forms.responses.get({ id: multiForm.id, submissionId: otherSubmission.submissionId })
  assert.deepEqual(renderedOther.sections[0].answers[0].values, ["Cleaning", "Gardening"])
  multiDraft = await caller.forms.saveDraft({
    id: multiForm.id, revision: multiDraft.draftRevision,
    sections: [{ id: multiDraft.sections[0].id, items: [{ ...multiItem, required: false, defaultValue: null }] }],
  })
  const optionalMultiVersion = await caller.forms.publish({ id: multiForm.id, revision: multiDraft.draftRevision })
  const unanswered = await publicCaller.publicForms.submit({ id: multiForm.id, versionId: optionalMultiVersion.versionId, values: { respondentEmail: "" } })
  assert.deepEqual((await caller.forms.responses.get({ id: multiForm.id, submissionId: unanswered.submissionId })).sections[0].answers[0].values, [])
  console.info("PASS multiple choice defaults, required and optional selection, invalid values, and stored selections with Other")
  const overview = await caller.forms.overview()
  const totalResponses = await prisma.formSubmission.count({ where: { form: { organizationId: organization.id } } })
  assert.equal(overview.responses, totalResponses)
  assert.equal(overview.thisWeek, totalResponses)
  assert.equal(overview.dailySubmissions.reduce((sum, day) => sum + day.value, 0), totalResponses)
  assert.equal(overview.dailySubmissions.at(-1)!.value, totalResponses)
  assert.ok(overview.dailySubmissions.slice(0, -1).every((day) => day.value === 0))
  const { getStartOfWeek } = await vite.ssrLoadModule("/app/lib/overview-time.ts") as typeof import("../app/lib/overview-time")
  await prisma.formSubmission.update({
    where: { id: unanswered.submissionId },
    data: { submittedAt: new Date(getStartOfWeek(new Date(), "Europe/Helsinki").getTime() - 1) },
  })
  assert.equal((await caller.forms.overview()).thisWeek, totalResponses - 1)
  assert.equal((await caller.forms.overview()).responses, totalResponses)
  assert.equal((await otherCaller.forms.overview()).responses, 0)
  assert.ok((await otherCaller.forms.overview()).dailySubmissions.every((day) => day.value === 0))
  const firstDay = new Date(overview.dailySubmissions[0].date)
  await prisma.formSubmission.update({ where: { id: unanswered.submissionId }, data: { submittedAt: firstDay } })
  assert.equal((await caller.forms.overview()).dailySubmissions[0].value, 1)
  const historicalDay = await caller.forms.overview({ days: 1, endDate: overview.range.startDate })
  assert.equal(historicalDay.dailySubmissions.length, 1)
  assert.equal(historicalDay.dailySubmissions[0].value, 1)
  assert.equal(historicalDay.range.startDate, historicalDay.range.endDate)
  assert.equal(historicalDay.responses, totalResponses, "Chart filters must preserve all-time stats")
  await prisma.formSubmission.update({ where: { id: unanswered.submissionId }, data: { submittedAt: new Date(firstDay.getTime() - 1) } })
  const outsideWindow = await caller.forms.overview()
  assert.equal(outsideWindow.dailySubmissions[0].value, 0)
  assert.equal(outsideWindow.dailySubmissions.reduce((sum, day) => sum + day.value, 0), totalResponses - 1)
  assert.equal(outsideWindow.responses, totalResponses)
  assert.equal((await caller.forms.overview({ days: 90 })).dailySubmissions.reduce((sum, day) => sum + day.value, 0), totalResponses)
  assert.equal((await caller.forms.overview({ days: 7 })).dailySubmissions.reduce((sum, day) => sum + day.value, 0), totalResponses - 1)
  assert.equal((await caller.forms.overview({ days: 1, endDate: overview.range.startDate })).dailySubmissions[0].value, 0)
  await prisma.formSubmission.update({ where: { id: unanswered.submissionId }, data: { submittedAt: new Date(Date.now() + 86_400_000) } })
  assert.equal((await caller.forms.overview()).dailySubmissions.reduce((sum, day) => sum + day.value, 0), totalResponses - 1)
  await prisma.organizationSettings.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, timezone: "America/New_York" },
    update: { timezone: "America/New_York" },
  })
  await prisma.formSubmission.update({ where: { id: unanswered.submissionId }, data: { submittedAt: new Date("2026-03-29T03:00:00Z") } })
  const newYorkDay = await caller.forms.overview({ days: 1, endDate: "2026-03-28" })
  assert.equal(newYorkDay.timeZone, "America/New_York")
  assert.equal(newYorkDay.dailySubmissions[0].value, 1)
  assert.equal((await caller.forms.overview({ days: 1, endDate: "2026-03-29" })).dailySubmissions[0].value, 0)
  console.info("PASS overview counts, organization isolation, zero-filled daily submissions, timezone boundaries, and excluded old/future responses")
  console.info("PASS configurable and historical ranges, input validation, workspace timezone grouping, and unchanged summary stats")
  const recentIds = [form.id, multiForm.id, settingsForm.id]
  for (const [index, id] of recentIds.entries()) {
    await prisma.form.update({ where: { id }, data: { updatedAt: new Date(Date.now() + (3 - index) * 86_400_000) } })
  }
  const recentOverview = await caller.forms.overview()
  assert.equal(recentOverview.recentForms.length, 5)
  assert.deepEqual(recentOverview.recentForms.slice(0, 3).map((form) => form.id), recentIds)
  assert.equal(recentOverview.recentForms[0]._count.submissions, await prisma.formSubmission.count({ where: { formId: form.id } }))
  assert.deepEqual((await otherCaller.forms.overview()).recentForms, [])
  console.info("PASS five recent forms ordered by last edit, response counts, and workspace isolation")
  const recentResponseIds = [firstSubmission.submissionId, unanswered.submissionId, responseList.find((response) => response.id !== firstSubmission.submissionId)!.id]
  const responseNow = Date.now()
  await prisma.formSubmission.updateMany({ where: { form: { organizationId: organization.id } }, data: { submittedAt: new Date(responseNow - 86_400_000) } })
  for (const [index, id] of recentResponseIds.entries()) {
    await prisma.formSubmission.update({ where: { id }, data: { submittedAt: new Date(responseNow - (index + 1) * 1000) } })
  }
  const recentResponseOverview = await caller.forms.overview()
  assert.equal(recentResponseOverview.recentResponses.length, 5)
  assert.deepEqual(recentResponseOverview.recentResponses.slice(0, 3).map((response) => response.id), recentResponseIds)
  assert.equal(recentResponseOverview.recentResponses[0].formId, form.id)
  assert.equal(recentResponseOverview.recentResponses[0].respondentEmail, null)
  assert.equal(recentResponseOverview.recentResponses[0].form.title, (await caller.forms.get({ id: form.id })).title)
  assert.deepEqual((await otherCaller.forms.overview()).recentResponses, [])
  await prisma.formSubmission.update({ where: { id: recentResponseIds[0] }, data: { submittedAt: new Date(responseNow + 86_400_000) } })
  assert.ok((await caller.forms.overview()).recentResponses.every((response) => response.id !== recentResponseIds[0]))
  console.info("PASS five recent responses across forms, newest-first ordering, anonymous responders, form names, and exclusion of future/other-workspace submissions")
} finally {
  await prisma.organization.deleteMany({ where: { id: { in: organizations } } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
