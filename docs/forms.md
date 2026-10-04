# Forms

The existing admin routes remain `/forms/:id/edit`, `/responses`, and `/settings`.
Respondents open `/f/:id` without signing in.
Add `?email=person%40example.com` to prefill the collected email field. The value
remains editable and uses the normal email validation. Forms that do not collect
email ignore this parameter. Encode the email with `URLSearchParams` or
`encodeURIComponent`, especially for addresses containing `+` (`%2B`).

Form UI lives in `app/components/forms`: `editor` owns draft editing and preview,
`renderer` owns respondent inputs and public rendering, and shared workspace
components sit alongside those folders. Each has an `items` folder for its item
components. Shared types, configuration, snapshots, and answer validation live in
`app/lib/forms`, independent of the UI. Draft input schemas live in its `schemas`
folder. Form route modules live in `app/routes/forms`, with the list route named
`form-list.tsx`. Their URLs and route IDs are explicitly preserved in
`app/routes.ts`. Files use kebab-case names, and editor components use item
terminology to match the Prisma model.

```text
app/
├── .server/services/forms/    # Draft, publishing, public loading, submissions
├── components/forms/
│   ├── editor/items/          # Item configuration and editing
│   └── renderer/items/        # Respondent inputs and content
├── lib/forms/
│   └── schemas/               # Draft and editor item input schemas
└── routes/forms/              # List, workspace, editor, responses, settings, public
```

- `app/.server/services/forms/form-editor.ts` loads and persists mutable sections,
  items, options, settings, appearance, and rule definitions. Creation always
  includes a default section. Draft saves atomically compare and increment
  `draftRevision`, preserve option values, and never update published versions.
- `app/components/forms/editor/use-form-editor-draft.ts` owns the complete local
  draft. Editing is immediate, with serialized saves after a 500 ms debounce.
  A revision conflict stops saving until the user reloads the saved draft.
- `app/components/forms/editor/form-heading-editor.tsx` is always the first,
  fixed block. Its name and optional description edit `Form.title` and
  `Form.description` through the same revision-checked draft save. It has an
  “Add description” switch and no delete, duplicate, or drag controls. Turning
  the switch off clears the saved description. The heading is form metadata,
  separate from the sortable section items, and appears in both preview and
  published forms through `app/components/forms/renderer/form-heading.tsx`.
- `app/lib/forms/form-snapshot.ts` builds and validates the public DTO with a schema
  version and explicit public properties. Both preview and publishing use it.
- `app/.server/services/forms/form-publishing.ts` locks the form, verifies the
  expected draft revision, creates a new immutable version, and updates the
  published pointer in one transaction. The toolbar flushes pending saves first.
- `app/.server/services/forms/public-form.ts` checks live availability and combines
  published questions with the form's current settings. Public snapshots exclude organization data,
  editor revisions, timestamps, and private response restrictions.
- `forms.settings.get` and `forms.settings.update` use a dedicated settings router,
  schema and service, scoped to the active organization. The DTO uses a boolean
  `status` for availability (stored as `Form.enabled`), ISO `startsAt`/`closesAt`
  timestamps, response settings, submission text/redirect and presentation settings.
  Each row has its own RVF form and saves a partial patch through tRPC. Saves for
  a row are queued; the database locks the form before merging coupled settings.
  One response per email requires email collection, and selecting optional/no email
  collection disables the limit. Invalid settings show input styling with visually hidden
  error labels (including redirect), available to assistive technology. Error styling
  clears when typing starts, and values validate again on blur without taking focus.
  Invalid values stay unsaved and do not block tab navigation, closing, or publishing;
  the last saved values remain in use. Server validation rejections follow the same
  behavior, while unexpected save failures still show an error toast. The redirect
  field uses a text input for the full URL with a trailing clear button. Validation runs through
  RVF/Zod, without native HTML validation. Labels and descriptions share a group so
  textarea labels stay at the top. The preview scroll container shares the form's theme
  so its scroll fades reveal the matching background.
  Opening and closing times use the reusable coss `TimePicker` in `components`.
  It accepts inclusive `startTime`/`endTime` bounds in `HH:mm` and an
  `intervalMinutes` value. Availability uses 00:00–23:59 with 60-minute intervals
  (00:00 through 23:00); saved times between intervals remain displayed exactly.
  New closing dates default to 23:59 even though it is not an hourly dropdown option.
  Dropdowns match their trigger width, using the original coss item spacing and
  small time text to keep labels on one line while leaving room for the date field.
  Accent colors use a coss select with a color dot and fruit name in both the trigger
  and menu. Blackberry is the default and clears the custom color; previously saved colors outside
  the palette remain available as Fruit mix. Color choices save immediately.
  Each preset has a paired button text color: white for deeper colors, warm brown for
  Mango, and dark green for Lime. Custom colors use white or a darker ink in the same
  hue, with a minimum 4.5:1 contrast target in preview and public forms.
  The send button keeps its solid accent on hover and press so its text contrast
  stays consistent in light and dark themes.
  Time labels use `lib/format-preference` for EU 24-hour or US AM/PM clocks,
  while date/time values keep the organization's timezone.
  Availability controls are disabled until the form is published, and the API rejects
  availability patches for unpublished forms. Saved settings apply immediately to both
  public reads and submissions, independently of publishing new questions. Opening is inclusive and closing is exclusive. Date/time controls
  use the organization's timezone and preferred date format, including DST.
  Opening and closing dates share their selected values on the client, including
  unsaved edits. Invalid ranges immediately mark the date inputs and skip saving;
  each row's validation also checks the current opposite date before flushing.
  The server keeps the same ordering check as the final authority.
  Email, submission and presentation updates do not change the question draft revision
  or published version. Preview uses the current settings. Public rendering and submission
  validation overlay current settings on the published question snapshot; earlier question
  versions stay valid, with current email restrictions, success text and redirects.
  The workspace flushes settings saves before publishing and refreshes availability afterward.
- `app/components/forms/renderer` renders snapshots with the existing field
  components. RVF answer state stays separate from snapshot definitions. Preview
  uses the same renderer and validation and does not save responses. The collected
  email field appears directly below the heading in preview/public forms, outside
  the editable question list. Submit button text, accent color, and device/light/dark
  themes are shared between preview and public rendering. Semantic color mappings use
  inline Tailwind tokens so each form resolves its own theme and accent color. Preview
  backgrounds fill the available height. Public forms share the app-wide query cache
  settings: data becomes stale after one minute, active queries refresh every minute
  and on focus when stale, and inactive cached data is retained for ten minutes.
- `app/.server/services/forms/form-submission.ts` locks the form for availability,
  response-limit, and duplicate checks. It validates the exact submitted version
  and creates the submission and historical answers in one transaction.
- `forms.responses.list/get` restrict response reads to the current organization.
  The responses view uses the shared TanStack table and loads the selected response
  separately. Questions and choice labels come from its published version, including
  questions since deleted from the draft. Empty optional answers remain visible.
  On mobile, selecting a responder opens their answers with a button back to the list.

Submissions from earlier published versions of the same form remain accepted
while the form is open. This lets a respondent finish a version they already
opened after a newer version is published. The live form's enabled flag, status, schedule,
and response limit still apply. Email settings, success text and redirects use the current
form settings. Question labels, options and question validation come from the respondent's version.

Text answers are strings. Choice answers use stable option values. “Other”
answers store `{ value: "other:<itemId>", other: "entered text" }`. Multiple-choice
answers store an array of option values, or `{ value: ["option", "other:<itemId>"],
other: "entered text" }` when “Other” is selected. Empty optional
answers and content items do not create answers. Respondent emails are normalized
and stored separately from answer items. Respondents never create `User` records.

The public runtime currently supports short text, long text, single choice, multiple choice (checkboxes),
and text blocks. Other item types and rule definitions remain in the draft DTO
and relational model. Publishing rejects them until their renderer, configuration
schema, and shared validation/evaluation are implemented. Section paging, logic,
file uploads, and grids are not introduced by this update.

After updating an older database, run `npm run db:push`, `npm run db:generate`,
and `npm run db:backfill:form-sections`. The backfill is idempotent and adds a
section only to forms that have none.

Run `npm run typecheck` and `npm run test:forms` to check the architecture,
concurrency, immutable history, public HTTP transport, and server-rendered markup.
The integration tests create isolated fixtures, remove them, and close their
Vite servers. They require the configured database connection.

`forms.overview` accepts an optional `{ days, endDate }` input for its daily
submission chart. `days` is an integer from 1 to 366 and defaults to 30.
`endDate` is an inclusive `YYYY-MM-DD` calendar date in the workspace timezone
and defaults to today. For example, `{ days: 7 }` returns the last seven days,
and `{ days: 31, endDate: "2026-03-31" }` returns March. The response includes
the resolved `range`, zero-filled `dailySubmissions`, and `timeZone`.
Future submissions are excluded. Summary stats retain their all-time and
current-week meanings regardless of the selected chart range.
