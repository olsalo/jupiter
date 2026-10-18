# Writing Excellent, User-Friendly UI Labels for SaaS

A practical guide for writing clear, compact, localization-friendly UI copy for SaaS products.

Good UI labels help users understand what to do without stopping to interpret the interface. In SaaS products, labels also need to work inside tight layouts, responsive views, dense dashboards, tables, dialogs, and translated interfaces.

The best label is not simply the shortest one. It is the shortest label that remains clear in context and still works when translated.

---

## 1. Write for the user, not the system

Use the words users naturally use.

Avoid internal terminology, implementation details, database language, and technical concepts unless the product is specifically for technical users.

### Prefer

- Invite member
- Save changes
- Create project
- Export data
- Billing
- Team settings

### Avoid

- Provision user
- Persist changes
- Instantiate project
- Generate export payload
- Subscription management module
- Organization configuration

A useful test:

> Would a first-time user understand this label without knowing how the product works internally?

---

## 2. Treat available space as a design constraint

UI copy lives inside components, not documents.

A label that reads well in isolation can still fail when placed inside:

- buttons
- tabs
- table headers
- sidebars
- dropdowns
- mobile layouts
- confirmation dialogs
- translated interfaces

Do not write labels as if horizontal space is unlimited.

### Common failure

A button starts as:

**Create a new customer account**

It works in English, but wraps in German, Finnish, French, or Spanish.

A better label might be:

**Create customer**

The surrounding screen already establishes that the customer is new and that an account is being created.

### Principle

Remove words that the interface already communicates.

---

## 3. Design for translation expansion

Translated text is often longer than English.

A useful planning assumption is that localized UI text may need roughly **30–50% more horizontal space**, especially for short labels.

This is not a strict linguistic rule, but it is a useful design constraint.

### Example

English:

**Save**

A translated version may be much longer.

English:

**Save changes**

A translation may be longer still.

If the button has no spare width, wrapping or truncation becomes likely.

### Practical rule

Do not design a button that only fits the English label.

Leave visible breathing room around the text.

---

## 4. Avoid wrapping button labels

Primary and secondary button labels should usually remain on one line.

Wrapped buttons:

- become visually heavy
- make action groups inconsistent
- break compact dialogs
- create alignment problems
- become much worse after translation

### Prefer

- Save
- Add
- Create
- Send
- Export
- View

When the resource is not obvious from context, add only the minimum qualifier needed:

- Add user
- Export CSV
- View report

### Avoid when space is limited

- Save all changes made to this project
- Add a new user to this workspace
- Create a brand new project
- Send an invitation to this user
- Export this table as a CSV file

The extra words rarely improve comprehension.

---

## 5. Use context to shorten labels

Labels do not need to repeat information already visible nearby.

### Example

Dialog title:

**Delete project?**

Bad button:

**Permanently delete this project**

Better button:

**Delete**

The title already identifies the resource, so the CTA only needs to state the action.

### Example

Page title:

**Invite team members**

Bad button:

**Send team member invitations**

Better:

**Send**

The page title already supplies the invitation context. Context should remove words from the CTA, not merely shorten them.

---

## 5.1. Match CTA specificity to its placement

Do not apply one naming rule to every button.

### Main page CTAs

A primary CTA in a page header or other prominent page-level location may include the resource name because the button can be visually separated from the content it affects.

Good:

- New project
- Add member
- Create invoice
- Add customer
- New report

For creation actions, **New**, **Add**, and **Create** are all valid when they match the product's terminology and interaction model.

Use:

- **New** when starting a new object is the familiar mental model
- **Add** when adding something to an existing collection or parent
- **Create** when the action creates a distinct resource and the wording feels natural

Do not force the shortest possible label if the page-level CTA would become vague.

### Contextual CTAs

Inside a row, card, form, dialog, or clearly scoped component, use the action alone when the resource is already obvious.

Prefer:

Dialog title:

**Delete project?**

CTA:

**Delete**

Row action on a member:

**Remove**

Project form:

**Save**

Retry action inside a failed import:

**Retry**

Avoid unnecessary repetition such as:

- Delete project
- Remove member
- Save project
- Retry import

Add the resource name only when the target is genuinely unclear or several resources/actions share the same context.

---

## 6. Use strong verbs for actions

Buttons should usually begin with a verb.

Useful SaaS verbs include:

- Add
- Apply
- Archive
- Cancel
- Change
- Connect
- Create
- Delete
- Disable
- Download
- Edit
- Enable
- Export
- Import
- Invite
- Publish
- Remove
- Retry
- Save
- Send
- Share
- Sign in
- Upload
- View

Prefer:

**Invite member**

instead of:

**Member invitation**

Prefer:

**Export data**

instead of:

**Data export operation**

---

## 7. Use the shortest clear label

A label should be compact, but not cryptic.

### Too vague

- Go
- Do
- OK
- Yes
- Next
- More

### Better

- Open
- Retry
- Delete
- Continue
- View logs
- Add filter

### Best when context requires specificity

- Delete user
- Continue to billing
- Retry import
- View audit log

The right length depends on how much context surrounds the control.

---

## 8. Prefer one or two words when the meaning stays clear

For space-constrained UI, short action labels are usually best.

Good examples:

- Save
- Cancel
- Retry
- Invite
- Export
- Archive
- Delete
- Publish
- Connect
- Upgrade

Use two words when one word would be ambiguous:

- Add user
- Save changes
- Delete project
- Send invite
- Export report
- Reset password

Use three or more words only when the extra information prevents ambiguity.

---

## 9. Do not make every button maximally explicit

Over-explaining every action creates bloated interfaces.

Bad:

**Save changes to workspace settings**

Better:

**Save changes**

Bad:

**Invite a new member to the workspace**

Better:

**Invite member**

Bad:

**Create a new API access token**

Better:

**Create token**

Use the page, section, dialog, and surrounding labels to carry context.

---

## 10. Write error labels for scanning

Inline errors are not documentation.

They should be short enough to scan immediately and compact enough to fit beneath a field without dominating the form.

### Good inline errors

When the error is visually attached to a labeled field, do not repeat the field context.

Prefer compact state labels such as:

- Required
- Invalid
- Too short
- Too long
- Taken
- Too large
- Not allowed

The field label already tells the user what is invalid.

In space-constrained layouts, treat inline errors as single-line UI copy. Do not rely on wrapping.

For example:

**Email address**

`name@example`

**Invalid**

Not:

**Enter a valid email address**

### Avoid

- Enter an email address
- Enter a valid email address
- The email address you entered is invalid
- This field is required and cannot be left empty
- The password you entered does not meet the minimum length requirement

Long errors repeat context, wrap quickly, and become much worse in translation.

---

## 11. Separate the error from the explanation

When an error genuinely needs more detail, do not force everything into the inline label.

Use layers of information.

### Inline

**File is too large**

### Supporting detail

Maximum file size: 25 MB.

This keeps the primary error short while still helping the user recover.

### Another example

Inline:

**Connection failed**

Detail:

Check the API key and try again.

---

## 12. Put recovery instructions before technical detail

Users need to know what to do next.

### Prefer

**Connection failed**

Check the API key and try again.

### Avoid

**Request failed with status 401 because authentication credentials could not be validated**

Technical details can be shown separately when the audience needs them.

For example:

**Connection failed**

Check the API key and try again.

`401 Unauthorized`

---

## 13. Keep error messages local

Place validation errors close to the field or action they refer to.

Do not make users scan a large alert at the top of the page to discover which field is wrong.

### Good

**Workspace name**

`Acme / Europe`

**Use letters, numbers, and hyphens only**

### Less useful

**There are validation errors in this form**

---

## 14. Do not repeat field context in inline errors

If an error is directly attached to a labeled field, the field label already supplies the noun.

Use the error message only for the state or constraint.

### Example

**Email address**

`name@example`

**Invalid**

Not:

**Enter a valid email address**

### Example

**Workspace name**

` `

**Required**

Not:

**Workspace name is required**

### Example

**Password**

`••••`

**Too short**

Not:

**Password must contain at least 8 characters**

If the exact constraint matters, put it in persistent helper text or short supporting text rather than repeating the field name.

The compact form should be the default whenever the relationship between field and error is visually obvious.

---

## 15. Design inline errors to stay on one line

Inline validation is part of the form layout, not body copy.

In constrained SaaS interfaces, error text should be short enough to remain on one line, including after localization.

### Prefer

- Required
- Invalid
- Taken
- Too short
- Too long
- Too large
- Not allowed

### Avoid

- This value is already in use
- Enter a value in the correct format
- The selected file exceeds the allowed size

Do not use wrapping as the default solution for long validation text.

If an error cannot fit on one line:

1. remove repeated field context
2. shorten the state
3. move persistent constraints into helper text
4. move recovery detail into secondary text outside the constrained error slot
5. adjust the component if the information truly cannot be shortened

Localization should be tested against the available width, not handled by accepting multi-line validation by default.

---

## 16. Treat constrained UI text as single-line by default

A useful component rule:

### Buttons

Keep labels on one line.

### Inline validation

Keep errors on one line in constrained form layouts.

### Table headers

Keep them on one line and avoid long phrases.

### Tabs

Strongly prefer one line.

### Navigation items

Prefer one line.

### Toasts and banners

Allow short multi-line content when needed.

Different UI elements need different copy-length strategies.

---

## 17. Avoid truncating action labels

Ellipsis is usually a poor solution for buttons.

Bad:

**Create automati…**

A user should never have to guess what an action does.

If a button does not fit:

1. shorten the copy
2. increase the available width
3. move secondary actions into a menu
4. adjust the layout

Do not solve poor label sizing by hiding the action text.

---

## 18. Use icons carefully

Icons can save space, but only when the meaning is familiar.

Common icon-only actions may include:

- search
- close
- delete
- edit
- copy
- download
- more actions

Even then, provide:

- an accessible name
- a tooltip when useful
- sufficient hit area

Do not replace unfamiliar actions with icons simply to make the layout fit.

Text is often clearer than a clever symbol.

---

## 19. Use tooltips for clarification, not essential meaning

A button should be understandable without hovering.

Bad:

**Run**

Tooltip:

**Regenerate all invoices for the selected billing period**

The essential action is hidden.

Better:

**Regenerate invoices**

Tooltip:

**Recreates invoices for the selected billing period**

Tooltips should add detail, not rescue unclear labels.

---

## 20. Keep table actions compact

Tables often have the least available space.

Prefer compact labels such as:

- View
- Edit
- Retry
- Cancel
- Archive
- Delete

If multiple actions exist, consider a compact overflow menu:

**•••**

Menu:

- View details
- Edit
- Archive
- Delete

Do not place four long text buttons in every row.

---

## 21. Keep table headers short

Prefer nouns.

Good:

- Name
- Status
- Owner
- Created
- Updated
- Plan
- Usage
- Role

Avoid:

- Name of the project
- Current status
- Project owner
- Date created
- Last updated date
- Current subscription plan

Context from the table already carries much of the meaning.

---

## 22. Tabs need especially short labels

Tabs compete for horizontal space and often become problematic on smaller screens.

Good:

- Overview
- Activity
- Members
- Billing
- Settings
- Usage
- Logs

Avoid:

- General overview
- Recent account activity
- Workspace members
- Billing and subscription
- Workspace settings
- Product usage information

If tab labels need sentences, the information architecture probably needs reconsideration.

---

## 23. Navigation labels should be stable nouns

Navigation works best when it describes destinations.

Prefer:

- Projects
- Customers
- Reports
- Billing
- Settings
- Integrations
- API keys

Avoid:

- Manage projects
- View customers
- See reports
- Manage billing
- Configure settings

Users already know navigation takes them somewhere.

---

## 24. Prefer sentence case

Use:

- Create project
- Billing details
- Save changes
- API keys

Usually avoid:

- Create Project
- Billing Details
- SAVE CHANGES

Sentence case is easier to scan and typically produces less visual noise in dense SaaS interfaces.

---

## 25. Keep terminology consistent

Choose one term per concept.

Do not alternate between:

- User / member / teammate
- Workspace / organization / account
- Project / board / space
- Delete / remove / discard

If the terms mean different things, make the distinction intentional and document it.

### Example terminology list

| Concept | Preferred term |
|---|---|
| Person in a workspace | Member |
| Top-level customer environment | Workspace |
| Billable package | Plan |
| Reusable connection | Integration |
| Secret access credential | API key |

Consistency reduces cognitive load and makes labels shorter because users learn the vocabulary.

---

## 26. Avoid unnecessary nouns in actions

Buttons often become longer because writers turn actions into noun phrases.

Avoid:

- User creation
- Data export
- Report generation
- Invitation sending
- Password reset request

Prefer:

- Create user
- Export data
- Generate report
- Send invite
- Reset password

---

## 27. Use familiar SaaS terminology

For general SaaS products, users commonly understand:

- Dashboard
- Projects
- Users
- Members
- Team
- Settings
- Billing
- Usage
- Reports
- Integrations
- API keys
- Logs
- Notifications

Do not invent branded names for familiar concepts unless the distinction matters.

---

## 28. Keep destructive CTAs explicit, but contextual

A destructive CTA should clearly state the action, but it should not repeat an obvious resource name.

### Prefer when context is clear

- Delete
- Remove
- Revoke
- Cancel
- Archive

### Add the resource only when context is genuinely ambiguous

For example, if a dialog contains several resources or multiple destructive actions:

- Delete project
- Remove member
- Revoke API key

Do not add the resource name just because there is enough space.

### Avoid vague actions

- Confirm
- Continue
- Proceed
- Yes

The action itself should be clear. The surrounding title, dialog, row, card, or page should usually provide the resource context.

---

## 29. Be explicit for financial actions

Payment-related actions should communicate the consequence clearly.

Good:

- Upgrade to Pro
- Pay €49
- Confirm purchase
- Cancel subscription
- Update card

Avoid:

- Continue
- Confirm
- Process
- Submit

For irreversible or billable actions, clarity matters more than saving a few characters.

---

## 30. Use confirmation dialogs to carry detail

Buttons should stay compact. The dialog can explain the consequence.

### Example

**Delete workspace?**

All projects, files, and member access will be permanently removed.

Buttons:

- Cancel
- Delete

Do not repeat the resource in the CTA when the dialog title already makes it obvious.

---

# Recommended length targets

These are design targets, not hard linguistic rules.

| UI element | Main job | Preferred target |
|---|---|---|
| Page title | Name the current place or object | 1–4 words |
| Section title | Group related content | 1–4 words |
| Card title | Identify the card | 1–4 words |
| Dialog title | State the decision or action | 2–6 words |
| Subtitle / description | Add only missing context | 1 short sentence |
| Main page CTA | State the primary page action, often with resource | 1–3 words |
| Primary button | State the main action | 1–3 words |
| Secondary button | State the alternative action | 1–3 words |
| Tab | Name a destination | 1–2 words |
| Sidebar item | Name a destination | 1–2 words |
| Table header | Name the data | 1–2 words |
| Field label | Name the value | 1–3 words |
| Helper text | Explain a rule, format, or purpose | 1 short sentence |
| Inline error | State the problem | 1–3 words |
| Menu item | State an action or destination | 1–4 words |
| Toast title | State the result | 2–5 words |
| Toast description | Add useful detail | 1 short sentence |
| Empty-state title | State what is missing | 2–5 words |
| Empty-state description | Explain what to do next | 1–2 short sentences |
| Tooltip | Clarify an unfamiliar control | 1 short sentence |

If UI copy regularly exceeds these ranges, check whether context can carry more of the meaning.

---

# Use a hierarchy of context

Every layer of the interface should carry only the context that belongs there.

A useful rule:

> Assign context to the highest appropriate level.

For example:

- the page title explains the page
- the section title explains the section
- the field label explains the field
- helper text explains a persistent rule or constraint
- the error states only what is wrong
- the button states only the action

Do not repeat the same context at every level.

### Good

**Workspace settings**

**Workspace name**

`Acme`

**Taken**

**Save**

### Avoid

**Manage your workspace settings**

**Enter your workspace name**

`Acme`

**This workspace name is already in use**

**Save your workspace settings changes**

The shorter version communicates the same information with less visual noise and more room for translation.

---

# Page titles

Page titles should name the current location, object, or task.

### Prefer

- Billing
- Team members
- API keys
- Project settings
- Create project
- Usage

### Avoid

- Manage your billing and subscription
- View and manage team members
- Manage your API keys
- Configure project settings

The surrounding interface already communicates that the user can view or manage the content.

## Use object names when context is obvious

A detail page can often use the object's actual name as the title:

**Acme Website**

instead of:

**Project: Acme Website**

Metadata, breadcrumbs, or surrounding navigation can communicate that it is a project.

## Avoid wrapping important page titles when possible

Long page titles can make responsive headers unstable.

If dynamically generated names can be long:

- allow sensible wrapping where appropriate
- constrain secondary actions separately
- do not make action placement depend on a one-line English title
- use truncation only for user-generated names when the full value remains accessible

Do not shorten meaningful user-generated names just to fit a rigid layout.

---

# Section titles

Section titles should group related information, not describe everything inside the section.

### Prefer

- Billing details
- Permissions
- Notifications
- Usage limits
- Danger zone

### Avoid

- Manage your billing details
- Configure member permissions
- Change your notification preferences

Section titles are especially useful for carrying context that would otherwise be repeated in individual controls.

### Example

**Notifications**

- Product updates
- Weekly report
- Failed payments

Not:

- Product update notifications
- Weekly report notifications
- Failed payment notifications

---

# Card titles

Card titles should identify the content or metric.

### Prefer

- Active users
- API usage
- Storage
- Failed jobs
- Recent activity

### Avoid

- Number of active users
- Current API usage amount
- Amount of storage used
- Jobs that have failed

If the card already contains a number or visualization, the title usually needs only the noun or metric name.

---

# Titles and subtitles should not repeat each other

A subtitle should add information that the title does not already communicate.

### Bad

**API keys**

Manage your API keys here.

### Better

**API keys**

Use keys to authenticate API requests.

### Best when no explanation is needed

**API keys**

No subtitle.

Do not add subtitles just because a design has space for one.

Every extra sentence increases:

- reading time
- visual height
- localization cost
- the chance of wrapping
- the chance of repeating obvious information

---

# Subtitles and descriptions

Use subtitles to answer a useful question that the title does not answer.

Good subtitle content includes:

- why a setting matters
- what a feature affects
- who can see something
- when a change takes effect
- an important consequence

### Good

**Usage alerts**

Get notified before your workspace reaches its monthly limit.

### Weak

**Usage alerts**

Manage your usage alert settings.

### Keep subtitles short

Prefer one concise sentence.

If several sentences are required, consider whether the information belongs in:

- helper text
- an info panel
- documentation
- a dedicated details view

---

# Dialog titles

A dialog title should state the decision, task, or consequence clearly enough that the buttons can stay short.

### Good

**Delete project?**

All project data will be permanently removed.

Buttons:

- Cancel
- Delete

### Avoid

**Are you absolutely sure you want to permanently delete this project and all associated information?**

Buttons:

- No, keep the project
- Yes, permanently delete the project

The title and dialog body already identify the resource. The CTA should not repeat it.

Use the resource name in the CTA only when the action could reasonably apply to more than one thing.

## Prefer questions for consequential confirmations

Examples:

- Delete project?
- Revoke access?
- Cancel subscription?
- Leave workspace?

For ordinary task dialogs, use a task title:

- Invite member
- Create API key
- Edit profile
- Add payment method

---

# Field labels

Field labels should name the value, not give an instruction.

### Prefer

- Email address
- Workspace name
- API key
- Redirect URL
- Monthly limit

### Avoid

- Enter your email address
- Type a workspace name
- Paste your API key here
- Enter the redirect URL

The input itself already communicates that the user should enter a value.

Short noun labels also localize more reliably.

---

# Helper text

Helper text should communicate information that remains useful before and after an error.

Use it for:

- required formats
- limits
- examples
- consequences
- visibility
- where a value is used

### Example

**Password**

At least 8 characters.

If the user enters too few characters, the inline error can simply be:

**Too short**

### Example

**Workspace slug**

Used in your workspace URL.

Error:

**Taken**

The helper text and error should not compete to explain the same thing.

---

# Inline errors

When an error is directly attached to a labeled field, state only the error condition.

### Prefer

- Required
- Invalid
- Too short
- Too long
- Taken
- Too large
- Not allowed
- Mismatch

### Avoid

- Enter an email address
- Enter a valid email address
- This field is required
- The password you entered is too short
- This workspace name is already in use

### Example

**Email address**

`name@example`

**Invalid**

### Example

**Password**

`••••`

At least 8 characters.

**Too short**

This pattern is compact, easy to scan, and more resilient across languages.

For narrow layouts, the error slot should be designed and written as a one-line constraint.

## Add more detail only when recovery is not obvious

Some errors need a specific instruction.

For example:

**Unsupported file type**

Use PNG, JPG, or WebP.

The first line states the problem. The second line explains recovery.

---

# Toasts and success messages

Toast titles should state the result, not merely say that something succeeded.

### Prefer

- Changes saved
- Invite sent
- Project deleted
- Export ready
- Payment updated

### Avoid

- Success
- Done
- Completed
- Operation successful

Use a description only when it adds useful information.

### Good

**Export ready**

Your CSV is ready to download.

### Unnecessary

**Changes saved**

Your changes were saved successfully.

The description repeats the title and should be removed.

---

# Empty states

Empty-state titles should state what is missing.

### Prefer

- No projects yet
- No results
- No API keys
- No failed jobs
- No team members

The description should explain the next useful step only when needed.

### Example

**No API keys yet**

Create a key to authenticate API requests.

**Create key**

### Avoid

**Looks like you haven't created any API keys yet!**

Get started by creating your very first API key so you can begin authenticating requests.

**Create your first API key**

Empty states usually have more room, but that is not a reason to add filler.

---

# Menus

Menu items should be compact and parallel.

### Good

- Edit
- Duplicate
- Archive
- Delete

### Avoid

- Edit this project
- Create a copy of this project
- Move this project to archive
- Permanently delete this project

The menu context already identifies the object.

If the menu may apply to multiple object types or appears detached from the object, add specificity where needed.

---

# Breadcrumbs

Breadcrumbs should name locations, not actions.

### Good

**Projects / Acme Website / Settings**

### Avoid

**View projects / Open Acme Website / Manage settings**

Keep breadcrumb labels aligned with navigation and page-title terminology.

---

# Filters and filter labels

Filter labels should name the dimension being filtered.

### Good

**Status**

- All
- Active
- Paused
- Failed

**Owner**

- Anyone
- Me
- Unassigned

Avoid sentence-like filter labels such as:

**Filter projects by their current status**

In compact filter bars, context should do most of the work.

---

# Badges and status labels

Status labels should describe the state directly.

### Prefer

- Active
- Draft
- Failed
- Pending
- Overdue
- Paused
- Archived

### Avoid

- Is active
- Currently pending
- Payment is overdue
- This item is archived

Badges are among the most space-constrained UI elements. Keep them extremely compact.

---

# Tooltips

Tooltips should clarify unfamiliar controls or icons.

They should not carry information required to understand the primary action.

### Good

Icon button accessible name:

**Copy API key**

Tooltip:

**Copy**

### Bad

Button:

**Run**

Tooltip:

**Regenerate all invoices for the selected billing period**

If the tooltip is doing all the explanatory work, the visible label is too vague.

---

# Metadata and secondary labels

Secondary metadata should be compact and scannable.

Prefer:

- Created 12 Oct
- Updated 2h ago
- 4 members
- 12 projects
- 82% used

Avoid:

- This project was created on 12 October
- Last updated approximately 2 hours ago
- This workspace contains 4 members

Use full sentences only when sentence-level context is genuinely useful.

---

# Main page CTA patterns

Page-level primary actions can carry more context than inline actions.

### Good

- New project
- Add member
- Create invoice
- Add integration
- New dashboard

### Avoid vague page-level CTAs

- New
- Add
- Create

A bare verb may be too detached from its target in a page header.

### But keep contextual actions shorter

Page header:

**New project**

Inside a project form:

**Save**

Inside a project delete dialog:

**Delete**

The same resource does not need to be named at every level.

---

# Space-aware button patterns

## Create actions

Prefer:

- Create
- Create project
- Add user
- Add rule
- New project

Avoid:

- Create a new project
- Add a new user
- Create a new automation rule

---

## Save actions

Prefer:

- Save
- Save changes

Avoid:

- Save all changes
- Save changes to settings
- Save configuration changes

---

## Invitation actions

Prefer:

- Invite
- Invite member
- Send invite

Avoid:

- Send invitation
- Invite a new team member
- Send workspace invitation

---

## Export actions

Prefer:

- Export
- Export CSV
- Download CSV

Avoid:

- Export all table data
- Download data as a CSV file

---

## Retry actions

Prefer:

- Retry
- Retry import
- Retry sync

Avoid:

- Try importing this file again
- Attempt synchronization again

---

# Space-aware error patterns

## Required field

Prefer:

**Required**

Avoid:

- Enter a name
- This field is required
- This field is required and cannot be left empty

---

## Invalid value

Prefer:

**Invalid**

Avoid:

- Enter a valid email
- Invalid email address
- The email address you entered is not valid

The field label already identifies what is invalid.

---

## Existing value

Prefer:

**Name already in use**

Avoid:

**A workspace with this name already exists**

Use the longer version only if the shorter version could be ambiguous.

---

## File size

Prefer:

**File is too large**

Supporting text:

**Maximum size: 25 MB**

Avoid:

**The selected file exceeds the maximum allowed file size of 25 MB**

---

## Permission error

Prefer:

**You don't have access**

Optional detail:

**Ask a workspace admin for access.**

Avoid:

**Your current account permissions do not allow you to perform this operation**

---

## Generic failure

Prefer:

**Couldn't save changes**

Then:

**Try again.**

Avoid:

**An unexpected error occurred while attempting to save your changes**

---

# Responsive UI guidance

## Desktop

Do not waste extra space simply because it is available.

Compact labels improve scanning and consistency.

## Tablet

Check:

- tab overflow
- grouped actions
- table controls
- dialog buttons
- translated labels

## Mobile

Prefer:

- one clear primary action
- shorter labels
- overflow menus for secondary actions
- stacked dialog actions when necessary

Do not make important actions icon-only just because the screen is narrow.

---

# Localization checklist

Before approving UI copy, ask:

- Does this still work if it becomes 30–50% longer?
- Will the button remain on one line?
- Can the page title grow without colliding with actions?
- Can the tab still fit?
- Can the sidebar item still fit?
- Can the table header still fit?
- Is the subtitle genuinely adding information?
- Is the wording unnecessarily specific?
- Does the copy repeat context already supplied by a title, section, field, or dialog?
- Can one word be removed without losing meaning?
- Will the inline error still fit on one line after translation?
- Can helper text carry longer constraints instead of the error?
- Is the sentence structure easy to translate?
- Does the copy avoid idioms, jokes, and wordplay?

---

# Avoid idioms and clever phrasing

Idioms are difficult to translate and often consume more space.

Avoid:

- You're good to go
- Give it a whirl
- Kick things off
- Something went sideways
- Let's get rolling

Prefer:

- Ready
- Try again
- Get started
- Something went wrong
- Start

Localization-friendly writing is usually simple writing.

---

# Avoid concatenated UI sentences

Do not build messages by stitching translated fragments together.

For example, avoid assembling:

`"Delete " + projectName + " permanently?"`

Sentence order differs across languages.

Use a complete translatable string with variables:

**Delete {projectName}?**

This gives translators control over the full sentence.

---

# Do not encode grammar into button width

A design should not depend on English being short.

If a layout only works because the English button says:

**Save**

but breaks when the translation is longer, the component is too constrained.

Copy and layout need to be designed together.

---

# Component design recommendations

UI writers and designers should agree on component behavior.

## Buttons

- prefer one-line labels
- provide horizontal padding beyond the English text
- avoid fixed widths based on one language
- allow buttons to grow horizontally
- avoid ellipsis for primary actions

## Dialogs

- allow action groups to stack when horizontal space is insufficient
- keep each button label on one line
- use action-only CTAs when the dialog already identifies the resource
- put explanations in the body, not the button

## Forms

- design constrained inline error slots for a single line
- keep errors to compact states such as **Required**, **Invalid**, or **Taken**
- move persistent constraints into helper text
- do not use wrapping as the fallback for verbose validation copy

## Tabs

- use short destination labels
- consider horizontal scrolling or alternative navigation on small screens
- do not reduce font size to force long labels to fit

## Tables

- use short headers
- move secondary row actions into menus
- avoid long button groups in cells

---

# Before and after examples

| Before | Better |
|---|---|
| Create a new project | Create project |
| Save all changes | Save changes |
| Send an invitation | Send invite |
| Add a new team member | Add member |
| Export all data as CSV | Export CSV |
| Click here to retry | Retry |
| Proceed to billing | Continue to billing |
| Confirm deletion | Delete |
| The email address is invalid | Invalid |
| This field is required | Required |
| The file you selected is too large | File is too large |
| You do not have the necessary permissions | You don't have access |
| An unexpected error occurred | Something went wrong |
| Generate a new API access token | Create API key |
| Manage workspace members | Members |
| Billing and subscription management | Billing |

---

# Review process for UI labels

When reviewing a label:

1. Identify the user's intent.
2. Check what context the screen already provides.
3. Remove repeated information.
4. Use a familiar verb or noun.
5. Shorten without making it vague.
6. Check the label in the real component.
7. Test it at narrower widths.
8. Test with a 30–50% longer placeholder translation.
9. Verify constrained labels and inline errors remain single-line.
10. Verify terminology is consistent elsewhere.

Never approve UI copy only in a spreadsheet or design spec.

Review it inside the actual component.

---

# Quick quality checklist

Before shipping a UI label, ask:

- Is the meaning obvious?
- Is it written in user language?
- Is it shorter than it needs to be?
- Does surrounding context already communicate part of the meaning?
- Is the button likely to remain on one line after translation?
- Is the label understandable without a tooltip?
- Is terminology consistent?
- Is a destructive or billable action explicit?
- Does an inline field error avoid repeating the field context?
- Does the translated inline error still fit on one line?
- Have narrow and localized layouts been tested?

---

# Core principles

## Context belongs at the highest useful level

Let titles, sections, labels, and dialogs carry shared context so lower-level copy can stay compact.

## Clarity beats completeness

A UI label does not need to contain every detail.

Use the surrounding interface to provide context.

## Context beats repetition

Do not repeat words already visible in the page title, dialog title, row, card, table, or field label. If the resource is obvious, the CTA should normally be the verb alone: **Delete**, **Save**, **Retry**, **Remove**. Resource-specific CTAs should be rare.

## Short beats verbose

Especially for buttons, tabs, menus, and table headers.

## Flexible layout beats English-only design

Components should survive longer translations without making buttons, tabs, badges, table headers, or constrained inline errors wrap.

## Field errors should describe state, not repeat context

For inline validation attached to a labeled input, prefer compact states such as **Required**, **Invalid**, **Too short**, or **Taken**. In constrained layouts, these should remain on one line.

## Errors should explain recovery when needed

Add extra detail only when the user would not otherwise know how to fix the problem.

## Copy and layout must be reviewed together

Good UI writing cannot compensate for components that only fit one language.
