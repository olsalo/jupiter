# Form Builder Architecture

## Overview

The form system has two separate concerns:

1. **Form editing**
   - Used by authenticated organization users
   - Works against mutable draft data stored in relational tables
   - Supports autosaving, drag-and-drop, settings changes, validation configuration, sections, and conditional logic

2. **Form responding**
   - Used by public, unauthenticated respondents
   - Never reads mutable editor data directly
   - Renders an immutable published `FormVersion.snapshot`
   - Creates submissions against the exact published version the respondent saw

The key architectural rule is:

```text
Editor → mutable relational data

Publish → immutable JSON snapshot

Public form → published snapshot only
```

This keeps form editing flexible while ensuring published forms and historical submissions remain stable.

---

# 1. Core Data Model

The editor primarily works with:

```text
Form
├── FormSection[]
│   └── FormItem[]
│       └── FormItemOption[]
│
└── FormLogicRule[]
```

Publishing produces:

```text
FormVersion
└── snapshot
```

Responding produces:

```text
FormSubmission
└── FormAnswer[]
    └── FormSubmissionFile[]
```

`User` belongs only to the authenticated administrative side.

Respondents are not users.

A submission may contain:

```text
respondentEmail = null
```

for an anonymous submission, or:

```text
respondentEmail = "person@example.com"
```

when the form collects email addresses.

---

# 2. Editor Architecture

## Loading the editor

When an administrator opens a form in the editor, the application should load the mutable draft representation.

For example:

```text
GET /api/forms/:formId/editor
```

The server returns something similar to:

```json
{
  "id": "form_123",
  "title": "Customer feedback",
  "description": "Tell us what you think",
  "status": "PUBLISHED",
  "draftRevision": 42,

  "settings": {
    "submitButtonText": "Submit",
    "successMessage": "Thanks!",
    "redirectUrl": null,
    "emailCollection": "OPTIONAL",
    "limitOneResponsePerEmail": false,
    "responseLimit": null,
    "startsAt": null,
    "closesAt": null
  },

  "appearance": {
    "theme": "SYSTEM",
    "accentColor": "#6d28d9",
    "logo": null,
    "showProgressBar": true,
    "showQuestionNumbers": false
  },

  "sections": [
    {
      "id": "section_1",
      "title": "Contact information",
      "description": null,
      "sortOrder": 0,
      "items": []
    }
  ],

  "logicRules": []
}
```

This response represents the **draft**, not the currently published form.

The form may already be published while the editor contains unpublished changes.

---

# 3. Editor State

The React editor should keep the complete draft form in client state.

Conceptually:

```ts
type FormEditorState = {
  id: string
  title: string
  description: string | null

  draftRevision: number

  settings: FormSettings
  appearance: FormAppearance

  sections: FormSection[]
  logicRules: FormLogicRule[]
}
```

The editor UI should render directly from this state.

For example:

```text
FormEditor
├── FormHeaderEditor
├── FormSettingsPanel
├── AppearancePanel
└── Sections
    ├── Section
    │   ├── SectionHeader
    │   └── Item[]
    │       ├── Question
    │       ├── Heading
    │       ├── Text block
    │       ├── Divider
    │       └── Image
    └── Section
```

The database should not determine the UI layout on every render.

React state is the immediate editing source of truth.

The database is the persisted draft source of truth.

---

# 4. Form Items

Everything that can appear inside the ordered form content is a `FormItem`.

There are two categories.

## Answerable items

Examples:

```text
SHORT_TEXT
LONG_TEXT
EMAIL
PHONE
URL
NUMBER
DATE
TIME
DATETIME
SINGLE_CHOICE
MULTIPLE_CHOICE
DROPDOWN
CHECKBOX
LINEAR_SCALE
RATING
MULTIPLE_CHOICE_GRID
CHECKBOX_GRID
FILE
```

These can produce `FormAnswer` records.

## Content items

Examples:

```text
HEADING
TEXT_BLOCK
DIVIDER
IMAGE
```

These participate in:

- ordering
- drag-and-drop
- layout
- rendering

but never produce answers.

This means the editor can maintain one ordered list:

```ts
section.items.map(item => (
  <FormItemEditor
    key={item.id}
    item={item}
  />
))
```

instead of having separate systems for questions and decorative content.

---

# 5. Editor Rendering

The editor should use a central item renderer.

Conceptually:

```tsx
function FormItemEditor({ item }: Props) {
  switch (item.type) {
    case 'SHORT_TEXT':
      return <ShortTextEditor item={item} />

    case 'SINGLE_CHOICE':
      return <SingleChoiceEditor item={item} />

    case 'HEADING':
      return <HeadingEditor item={item} />

    case 'DIVIDER':
      return <DividerEditor item={item} />

    case 'IMAGE':
      return <ImageEditor item={item} />

    // ...
  }
}
```

Each editor component has two responsibilities:

1. Render a preview of what the respondent will see
2. Expose controls for editing that item

For example, a `SHORT_TEXT` editor may show:

```text
What is your name? *
[ Short answer text ]

Required                  [toggle]
Description               [toggle]
Validation                [settings]
Duplicate                 [button]
Delete                    [button]
```

The input displayed inside the editor is generally a preview and should not behave like an actual respondent input.

---

# 6. Editing Flow

Editor changes should update local state immediately.

For example:

```ts
updateItem(itemId, {
  label: 'What is your full name?'
})
```

React updates immediately.

The UI should not wait for the database request before showing the change.

The persistence flow is:

```text
User changes editor
        ↓
Update local state immediately
        ↓
Mark editor as dirty
        ↓
Debounce autosave
        ↓
Persist draft
        ↓
Server increments draftRevision
        ↓
Editor becomes saved
```

This gives the editor a responsive feel.

---

# 7. Autosaving

Most normal editor changes should autosave.

Examples:

- changing question text
- changing descriptions
- changing required state
- changing form title
- adding options
- changing options
- reordering items
- changing validation
- changing appearance

A reasonable flow is:

```text
change
  ↓
300-800 ms debounce
  ↓
PATCH request
```

For example:

```text
PATCH /api/forms/:formId/items/:itemId
```

with:

```json
{
  "label": "What is your full name?",
  "required": true,
  "revision": 42
}
```

The server performs the update and increments the form's `draftRevision`.

Response:

```json
{
  "draftRevision": 43
}
```

The client then updates its local revision.

---

# 8. Draft Revision and Concurrent Editing

`draftRevision` should be used for optimistic concurrency.

Suppose two browser tabs both loaded:

```text
draftRevision = 42
```

Tab A saves first.

The server updates:

```text
42 → 43
```

Tab B then tries to save using revision `42`.

The server can reject it because its editor state is stale.

For example:

```text
409 Conflict
```

This prevents one editor session from silently overwriting another.

At a high level:

```ts
if (input.revision !== form.draftRevision) {
  throw conflict()
}
```

Then:

```text
update draft
increment revision
```

should happen in the same database transaction.

---

# 9. Structural Operations

Some editor actions are better represented as explicit commands instead of generic property updates.

Examples:

```text
POST   /forms/:id/sections
DELETE /forms/:id/sections/:sectionId

POST   /forms/:id/items
DELETE /forms/:id/items/:itemId

POST   /forms/:id/items/:itemId/duplicate

POST   /forms/:id/items/reorder
POST   /forms/:id/sections/reorder
```

This makes operations like duplication and ordering easier to reason about.

For example, duplicating a choice question should duplicate:

```text
FormItem
+
FormItemOption[]
```

as one transaction.

---

# 10. Ordering

`sortOrder` represents the semantic ordering.

For example:

```text
Section
  item A → sortOrder 0
  item B → sortOrder 1
  item C → sortOrder 2
```

When dragging:

```text
A
B
C
```

to:

```text
C
A
B
```

the client sends the resulting ordering.

For example:

```json
{
  "items": [
    {
      "id": "item_c",
      "sortOrder": 0
    },
    {
      "id": "item_a",
      "sortOrder": 1
    },
    {
      "id": "item_b",
      "sortOrder": 2
    }
  ]
}
```

The server updates all affected items transactionally.

`sortOrder` should be considered the canonical order for:

- public mobile rendering
- accessibility
- keyboard navigation
- validation
- exports
- response displays

`row`, `column`, and `width` are only layout information.

---

# 11. Options

Choice items store options separately.

For example:

```text
SINGLE_CHOICE

What size do you want?

○ Small
○ Medium
○ Large
```

could be stored as:

```json
[
  {
    "id": "option_1",
    "label": "Small",
    "value": "abc123",
    "sortOrder": 0
  },
  {
    "id": "option_2",
    "label": "Medium",
    "value": "def456",
    "sortOrder": 1
  },
  {
    "id": "option_3",
    "label": "Large",
    "value": "ghi789",
    "sortOrder": 2
  }
]
```

`label` is editable.

`value` should remain stable.

If:

```text
Medium
```

is renamed to:

```text
Medium / Regular
```

the underlying value should still be:

```text
def456
```

This makes historical responses stable.

---

# 12. Validation and Settings

Type-specific configuration lives in JSON.

For example:

```json
{
  "type": "SHORT_TEXT",
  "validation": {
    "minLength": 2,
    "maxLength": 100
  }
}
```

Or:

```json
{
  "type": "NUMBER",
  "validation": {
    "min": 1,
    "max": 100
  }
}
```

Or:

```json
{
  "type": "FILE",
  "settings": {
    "maxFiles": 3,
    "maxFileSize": 10000000,
    "accept": [
      "image/*"
    ]
  }
}
```

The API should validate these objects according to the `FormItemType`.

For example, TypeScript can define discriminated schemas for:

```text
SHORT_TEXT validation
NUMBER validation
FILE settings
RATING settings
LINEAR_SCALE settings
```

The application should not accept arbitrary unvalidated JSON simply because the database field is `Json`.

---

# 13. Sections

Every form should have at least one section.

Even a simple form with no visible pages can internally contain:

```text
Section 1
```

Sections provide the foundation for:

- multi-page forms
- progress bars
- conditional navigation
- grouping questions
- section descriptions

The first default section does not necessarily need to visually look like a separate page in the editor.

---

# 14. Conditional Logic

Conditional logic belongs to `FormLogicRule`.

For example:

```text
Question:
Are you a customer?

If:
answer = Yes

Then:
Go to "Customer feedback"
```

could become:

```json
{
  "sourceItemId": "item_customer",
  "operator": "EQUALS",
  "comparisonValue": "yes-option-value",
  "action": "GO_TO_SECTION",
  "targetSectionId": "section_feedback",
  "priority": 0
}
```

Logic should reference stable option values rather than option labels.

Do not store:

```text
"Yes"
```

if `"Yes"` is just the visible label.

Store its stable option value.

---

# 15. Publishing

Saving and publishing are separate concepts.

Autosave changes the draft.

It does **not** change what public respondents see.

The flow is:

```text
Admin edits form
       ↓
Draft autosaves
       ↓
Public version remains unchanged
       ↓
Admin presses Publish
       ↓
Server generates snapshot
       ↓
Create immutable FormVersion
       ↓
Update Form.publishedVersion
```

For example:

```text
Draft revision: 56
Published version: 4
```

An administrator edits the form:

```text
Draft revision: 57
Published version: 4
```

Public respondents still receive version 4.

The administrator then presses Publish.

The server creates:

```text
FormVersion version 5
```

and updates:

```text
publishedVersion = 5
```

New respondents now see version 5.

---

# 16. Creating the Published Snapshot

Publishing should happen on the server.

The server loads:

```text
Form
FormSection[]
FormItem[]
FormItemOption[]
FormLogicRule[]
```

and transforms them into a clean public structure.

For example:

```json
{
  "title": "Customer feedback",
  "description": "Tell us what you think",

  "submitButtonText": "Submit",
  "successMessage": "Thank you",
  "redirectUrl": null,

  "emailCollection": "OPTIONAL",

  "appearance": {
    "theme": "SYSTEM",
    "accentColor": "#6d28d9",
    "logo": null,
    "showProgressBar": true,
    "showQuestionNumbers": false
  },

  "sections": [
    {
      "id": "section_1",
      "title": "About you",
      "description": null,
      "items": []
    }
  ],

  "logicRules": []
}
```

The snapshot should contain only data required by the public renderer.

It should not contain:

- organization internals
- admin users
- editor-only metadata
- private settings
- draft revision information

---

# 17. Why the Snapshot Is Important

Suppose version 5 contains:

```text
How satisfied are you?
```

A respondent submits an answer.

Later the administrator changes the question to:

```text
How satisfied were you with delivery?
```

The original response must still refer to the exact version the respondent saw.

Because the submission references:

```text
FormVersion 5
```

the application always knows the historical context.

The mutable editor can change freely without corrupting historical responses.

---

# 18. Public Form Loading

A respondent opens:

```text
/f/customer-feedback
```

The public API resolves the slug.

For example:

```text
GET /api/public/forms/:slug
```

The server checks the live form state:

```text
Does the form exist?
Is it published?
Has startsAt passed?
Has closesAt passed?
Has the response limit been reached?
```

Then it loads:

```text
Form.publishedVersion
       ↓
FormVersion
       ↓
snapshot
```

The public API should return the published snapshot.

It should not query and assemble the mutable editor tables for rendering.

---

# 19. Public Form Response

Conceptually:

```json
{
  "formId": "form_123",
  "versionId": "version_5_id",
  "version": 5,
  "snapshot": {
    "title": "Customer feedback",
    "description": "Tell us what you think",
    "sections": []
  }
}
```

The renderer now has everything required to display the form.

---

# 20. Public Renderer

The public renderer should be separate from the editor renderer.

They can share low-level components, but their responsibilities are different.

For example:

```text
Editor

FormItemEditor
├── ItemToolbar
├── Configuration controls
└── ItemPreview
```

versus:

```text
Public form

FormItemRenderer
└── Actual respondent input
```

The public renderer can use:

```tsx
function FormItemRenderer({ item }: Props) {
  switch (item.type) {
    case 'SHORT_TEXT':
      return <ShortTextField item={item} />

    case 'LONG_TEXT':
      return <LongTextField item={item} />

    case 'SINGLE_CHOICE':
      return <SingleChoiceField item={item} />

    case 'HEADING':
      return <Heading item={item} />

    case 'TEXT_BLOCK':
      return <TextBlock item={item} />

    case 'DIVIDER':
      return <Divider />

    // ...
  }
}
```

The renderer should not contain knowledge about Prisma or the database.

It receives a snapshot and renders it.

---

# 21. Form Runtime State

When a respondent is filling a form, the client should maintain answers independently from the snapshot.

For example:

```ts
type FormRuntimeState = {
  answers: Record<string, unknown>
  currentSectionId: string
  errors: Record<string, string>
}
```

Example:

```ts
answers = {
  item_name: 'Olli',
  item_rating: 5,
  item_services: ['service_a', 'service_c']
}
```

The keys are stable `FormItem.id` values.

Choice answers use stable option values.

---

# 22. Content Items During Submission

These types:

```text
HEADING
TEXT_BLOCK
DIVIDER
IMAGE
```

do not appear in the submitted answers.

For example, a section may contain:

```text
HEADING
SHORT_TEXT
DIVIDER
RATING
```

but the submission only sends:

```json
{
  "answers": {
    "short_text_item_id": "Olli",
    "rating_item_id": 5
  }
}
```

---

# 23. Client-Side Validation

Before moving to the next section or submitting, the client should validate:

```text
required
minLength
maxLength
number limits
selection limits
email format
URL format
file restrictions
etc.
```

This improves UX.

However, client validation is only advisory.

The server must run the same validation again.

Never trust respondent input.

---

# 24. Conditional Navigation at Runtime

When the respondent presses:

```text
Next
```

the renderer evaluates relevant `FormLogicRule` records.

For example:

```text
Current section
      ↓
Read answers
      ↓
Evaluate rules by priority
      ↓
Matching GO_TO_SECTION?
      ↓
yes → target section
no  → next normal section
```

A `SUBMIT_FORM` rule can terminate the form immediately.

Both frontend and backend should understand the same rule semantics.

---

# 25. Submitting

The client sends something like:

```json
{
  "versionId": "version_5_id",

  "email": "person@example.com",

  "answers": {
    "item_name": "Olli",
    "item_rating": 5,
    "item_services": [
      "option_a",
      "option_b"
    ]
  }
}
```

to:

```text
POST /api/public/forms/:slug/submissions
```

---

# 26. Server Submission Validation

The server should not use the current draft to validate a submission.

It must load the submitted:

```text
FormVersion
```

and validate against its immutable snapshot.

The server verifies:

```text
version belongs to form
version is an allowed/current published version
form accepts responses
response limit not reached
email rules are satisfied
required fields are present
answer types are valid
option values exist
validation rules pass
file constraints pass
```

The snapshot is the authoritative schema for that submission.

---

# 27. Email Collection

Email collection is separate from an `EMAIL` form item.

The form-level setting:

```text
emailCollection
```

represents the identity/contact email associated with the submission.

Possible modes:

```text
NONE
OPTIONAL
REQUIRED
```

For example:

```text
NONE
```

means:

```text
respondentEmail = null
```

`OPTIONAL` allows:

```text
respondentEmail = null
```

or:

```text
respondentEmail = person@example.com
```

`REQUIRED` requires an email.

A normal `EMAIL` question can still exist separately if the form creator wants another email field.

---

# 28. One Response Per Email

When:

```text
limitOneResponsePerEmail = true
```

the form should require:

```text
emailCollection = REQUIRED
```

Normalize:

```ts
const email = input.email.trim().toLowerCase()
```

Then:

```text
respondentEmail = normalized email
dedupeKey = normalized email
```

The unique database constraint:

```text
(formId, dedupeKey)
```

prevents two submissions using the same email.

When multiple responses are allowed:

```text
dedupeKey = null
```

This allows multiple submissions because PostgreSQL permits multiple `NULL` values in a unique constraint.

---

# 29. Creating Answers

For each answerable item, create a `FormAnswer`.

For example:

```text
itemId    = item_rating
itemLabel = How satisfied are you?
itemType  = RATING
value     = 5
```

The `itemId` intentionally does not have a foreign key back to the mutable `FormItem`.

This protects historical submissions if the admin later deletes the draft item.

The actual historical definition is available through the associated `FormVersion.snapshot`.

---

# 30. File Uploads

File uploads should normally happen before the final submission is committed.

A possible flow:

```text
Respondent chooses file
       ↓
Request upload authorization
       ↓
Upload directly to S3/R2
       ↓
Receive temporary upload reference
       ↓
Submit form
       ↓
Server validates upload
       ↓
Create FormSubmissionFile
```

Avoid sending large files through the main Express server if direct object-storage uploads are available.

The server should still validate:

- MIME type
- size
- number of files
- ownership of the temporary upload
- whether the upload belongs to the current form/session

---

# 31. Submission Transaction

Final submission creation should happen transactionally.

Conceptually:

```text
Begin transaction

check response availability
check duplicate email
validate submission
create FormSubmission
create FormAnswer[]
attach uploaded files

Commit
```

This is especially important for:

```text
responseLimit
limitOneResponsePerEmail
```

because concurrent requests could otherwise bypass application-level checks.

---

# 32. Successful Submission

After submission, the API can return:

```json
{
  "submissionId": "submission_123",
  "successMessage": "Thanks for your response!",
  "redirectUrl": null
}
```

The client then either:

1. renders the success screen, or
2. redirects to the configured URL

The server should determine these values from the published snapshot used by the respondent rather than the mutable editor state.

---

# 33. Editor Preview

The editor should support a preview mode.

Preview should ideally render the same published-form renderer using a temporary snapshot generated from the current draft.

Conceptually:

```text
Mutable editor draft
       ↓
buildSnapshot()
       ↓
PublicFormRenderer
```

This is useful because preview and production then use exactly the same rendering engine.

Do not build an entirely separate fake preview implementation.

The best architecture is:

```text
Editor
  ↓
draft data
  ↓
buildSnapshot()

                 ┌→ Preview
Snapshot → PublicRenderer
                 └→ Published form
```

The difference is only where the snapshot comes from.

---

# 34. Shared Snapshot Builder

The server should have one canonical transformation:

```ts
buildFormSnapshot(form)
```

which transforms relational editor data into the public form format.

Use it for:

```text
Publish
Preview
Potential tests
```

This prevents preview and published forms from gradually behaving differently.

---

# 35. Suggested Backend Responsibilities

A clean service separation could look like:

```text
FormEditorService
├── createForm
├── updateForm
├── createSection
├── reorderSections
├── createItem
├── updateItem
├── duplicateItem
├── reorderItems
├── deleteItem
└── updateLogicRules

FormPublishingService
├── buildSnapshot
├── publish
├── close
└── reopen

PublicFormService
├── getPublishedForm
├── validateAvailability
└── resolveVersion

FormSubmissionService
├── validateSubmission
├── submit
├── validateEmail
├── validateAnswers
├── validateFiles
└── evaluateLimits
```

This keeps the editor and public runtime from becoming tightly coupled.

---

# 36. Suggested Frontend Structure

A React implementation could conceptually look like:

```text
features/forms/

editor/
├── FormEditor.tsx
├── FormHeaderEditor.tsx
├── SectionEditor.tsx
├── FormItemEditor.tsx
├── SettingsPanel.tsx
├── LogicEditor.tsx
├── AppearanceEditor.tsx
└── items/
    ├── ShortTextEditor.tsx
    ├── ChoiceEditor.tsx
    ├── RatingEditor.tsx
    ├── HeadingEditor.tsx
    └── ...

renderer/
├── PublicForm.tsx
├── PublicSection.tsx
├── FormItemRenderer.tsx
└── items/
    ├── ShortTextField.tsx
    ├── ChoiceField.tsx
    ├── RatingField.tsx
    ├── Heading.tsx
    └── ...

shared/
├── form-types.ts
├── form-validation.ts
├── logic.ts
└── snapshot.ts
```

Editor components and respondent components can share lower-level presentation primitives, but they should not be the same top-level components.

---

# 37. End-to-End Flow

The complete lifecycle is:

```text
ADMIN
────────────────────────────────

Create form
    ↓
Create initial section
    ↓
Open editor
    ↓
Load mutable draft
    ↓
Edit local React state
    ↓
Autosave relational draft
    ↓
Press Publish
    ↓
buildFormSnapshot()
    ↓
Create immutable FormVersion
    ↓
Set Form.publishedVersion


RESPONDENT
────────────────────────────────

Open /f/:slug
    ↓
Resolve Form
    ↓
Check availability
    ↓
Load published FormVersion
    ↓
Return snapshot
    ↓
React public renderer
    ↓
Respondent fills answers
    ↓
Client validation
    ↓
POST submission
    ↓
Load exact FormVersion
    ↓
Server validation against snapshot
    ↓
Create FormSubmission
    ↓
Create FormAnswer[]
    ↓
Show success screen


ADMIN EDITS AGAIN
────────────────────────────────

Change mutable draft
    ↓
Autosave
    ↓
Existing published version remains unchanged
    ↓
Publish again
    ↓
Create next FormVersion
    ↓
New respondents receive new version
    ↓
Old submissions remain attached to old version
```

---

# 38. Most Important Rules

The implementation should preserve these rules:

1. **Editor data is mutable. Published versions are immutable.**

2. **Public forms never render directly from mutable editor tables.**

3. **Submissions always reference the exact `FormVersion` the respondent saw.**

4. **Submission validation uses that version's snapshot, not the current draft.**

5. **Respondents are never `User` records.**

6. **Content items such as headings and dividers never create answers.**

7. **Choice answers use stable option values rather than editable labels.**

8. **Autosaving is not publishing.**

9. **Preview should use the same renderer as the real public form.**

10. **The server is authoritative for validation, response limits, duplicate protection, and conditional rules affecting submission validity.**

With these boundaries, the editor can evolve independently while published forms and historical response data remain predictable and safe.