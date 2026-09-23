# Questionnaire App — Build Blueprint

**What this document is.** A complete, executable specification for building a web questionnaire
application from scratch. Drop this file into an empty folder, add your two questionnaires, and hand
both to Claude Code. It contains every architectural decision, type contract, database schema and
build phase needed — nothing is left to improvisation.

**Read this first if you are the implementer.** This is a prescriptive spec, not a suggestion. Where
it names a library, a file path or a data shape, use that one. Where it says "do not add", do not
add. Deviations need a stated reason.

---

## 1. Purpose and scope

Build a single web application where **two different audiences** answer **two different
questionnaires**:

- **Companies** (organisations answering on behalf of a legal entity)
- **Individuals** (private persons answering for themselves)

Respondents reach the app by URL or QR code, pick which of the two they are, answer the questions
one screen at a time, and finish on a thank-you screen. Every submission is persisted server-side.
A password-protected admin panel at `/admin` lets the study owner browse, filter and read every
response, and export them for later analysis.

### Explicitly out of scope

Do **not** build any of the following. They are deliberately excluded:

- Scoring, weights, points, maturity levels or bands
- Strengths / gaps / recommendations
- Generated reports, PDFs, or any result shown to the respondent
- Email sending, user accounts for respondents, authentication for respondents
- Analytics, tracking, third-party telemetry of any kind

The respondent answers and is thanked. That is the whole user-facing product.

### The one thing the project owner supplies

**The two questionnaires** — the questions, their options, their order and their conditional logic —
in the format defined in [§5](#5-the-questionnaire-data-contract). Everything else in this document
is fixed.

---

## 2. Product flow

### Respondent flow

```
Welcome
  ↓
Audience choice ──→  "I answer on behalf of a company"  |  "I answer as an individual"
  ↓
Identification      (fields depend on the audience; privacy consent checkbox, required)
  ↓
Question 1 of N     (one question per screen, Back / Next)
Question 2 of N
  …
Question N of N
  ↓
Open answer         (optional free text, max 2000 chars)
  ↓
Thank you           ("Your answers have been recorded." + "New questionnaire" button)
```

Rules:

- **One question per screen.** No long scrolling forms. This keeps the app usable on a phone at a
  trade-fair stand and makes the progress indicator meaningful.
- **Back never destroys answers.** Navigating backwards and forwards must preserve everything
  already answered, including answers to questions that are currently hidden by conditional logic.
- **"New questionnaire" is always one click away and never reloads the app.** The tool is used
  dozens of times in a single day on the same device (a tablet at an event). Starting over must
  reset in-memory state, not restart the page.
- **The thank-you screen confirms real persistence.** See [§7.4](#74-submission-is-not-fire-and-forget).

### Admin flow

```
/admin  →  Login (shared password)  →  Response list (filters, sort)  →  Response detail
                                             ↓
                                       CSV export links
```

### Routing

Three entry points, resolved by a plain `window.location.pathname` check in `src/App.tsx`:

| Path      | Renders                                              |
| --------- | ---------------------------------------------------- |
| `/admin`  | `AdminApp` (lazy-loaded — respondents never download it) |
| `/qr`     | `QrScreen` — optional; generates a printable QR poster pointing at the public URL |
| anything else | the questionnaire flow                           |

**Do not install a router library.** Three static paths do not justify one, and the SPA rewrite in
`vercel.json` already sends every path to `index.html`.

---

## 3. Tech stack

| Concern        | Choice                                                        | Why |
| -------------- | ------------------------------------------------------------- | --- |
| UI framework   | **React 19**, no meta-framework                                | The app is a client-side flow; server rendering buys nothing here |
| Build          | **Vite 7+**, config in `vite.config.mts`                       | Fast, zero-ceremony, and hosts the Vitest config in the same file |
| Language       | **TypeScript** with `strict`, `noUnusedLocals`, `verbatimModuleSyntax` | The data contract is the backbone of the project; the compiler must enforce it |
| Styling        | **Plain CSS.** Design tokens as CSS custom properties in `src/design/tokens.css`; one co-located `.css` file per component | No build-time styling dependency, no utility-class soup, full control over the visual result |
| Fonts          | **Self-hosted** via `@fontsource/*` packages, imported in `src/design/fonts.ts` | No CDN, no remote font request, works offline and behind corporate proxies |
| Routing        | **None** — pathname switch in `App.tsx`                        | Three paths |
| State          | **React Context + `useReducer`** (`src/state/QuestionnaireContext.tsx`) | One flow, one state tree; a state library would be pure overhead |
| Tests          | **Vitest + jsdom + @testing-library/react**, config inside `vite.config.mts` | Same transform pipeline as the app, no separate Jest/Babel setup |
| Lint           | **oxlint**                                                     | Fast, no config sprawl |
| Backend        | **Vercel serverless functions** in `api/`, shared logic in `server/` | Deploy is `git push`; no server to operate |
| Database       | **Supabase Postgres**, accessed with the service-role key **server-side only** | Managed Postgres, SQL access for the later study, generous free tier |
| Deployment     | **Vercel**, `vercel.json` with SPA rewrite                     | |

### Do not add

- ❌ Tailwind, styled-components, CSS-in-JS, any UI kit (MUI, Chakra, shadcn)
- ❌ Redux, Zustand, Jotai, MobX, React Query
- ❌ React Router or any routing library
- ❌ Prisma, Drizzle, TypeORM or any ORM — the Supabase JS client is enough for one table
- ❌ Any CDN `<script>` or `<link>`, any Google Fonts link, any remote asset
- ❌ Any analytics, error-tracking or session-replay SDK
- ❌ Any AI/LLM call at runtime

Every dependency added beyond the table above must come with a written justification in
`DECISIONS.md`.

---

## 4. Directory layout

```
.
├── api/                              Vercel serverless endpoints — thin handlers only
│   ├── responses.ts                  POST  /api/responses         (public, rate-limited)
│   └── admin/
│       ├── login.ts                  POST  /api/admin/login
│       ├── logout.ts                 POST  /api/admin/logout
│       ├── responses.ts              GET   /api/admin/responses    (list)
│       ├── response.ts               GET   /api/admin/response?id= (detail)
│       └── export.ts                 GET   /api/admin/export?format=
│
├── server/                           Shared backend logic — no React, no DOM
│   ├── auth.ts                       password hash check + HMAC-signed session cookie
│   ├── env.ts                        required env vars, read once, throw if missing
│   ├── http.ts                       ApiRequest/ApiResponse types, withErrorHandling, cookies
│   ├── rateLimit.ts                  in-memory sliding window per IP
│   ├── supabaseClient.ts             service-role client factory
│   ├── responsesRepository.ts        insert / list / get / listForExport + shared query builder
│   ├── validateSubmission.ts         the security core — see §7.2
│   ├── listFilters.ts                parse + normalise admin list query params
│   ├── csv.ts                        CSV serialisation (BOM, separator, CRLF, escaping)
│   └── exports.ts                    wide/long export row builders
│
├── supabase/
│   └── schema.sql                    the single table + indexes + RLS, append-only change log
│
├── src/
│   ├── main.tsx                      React root
│   ├── App.tsx                       pathname switch: /admin | /qr | flow
│   ├── index.css                     imports tokens.css, sets base element styles
│   │
│   ├── design/
│   │   ├── tokens.css                colour / type / spacing / radius / shadow custom properties
│   │   └── fonts.ts                  @fontsource imports
│   │
│   ├── components/                   reusable, questionnaire-agnostic UI primitives
│   │   ├── Screen.tsx                page shell: logo, progress, title, subtitle, body, actions
│   │   ├── Button.tsx
│   │   ├── SelectableOption.tsx      radio/checkbox card
│   │   ├── RadioGroup.tsx
│   │   ├── CheckboxGroup.tsx
│   │   ├── ScaleInput.tsx
│   │   ├── Select.tsx
│   │   ├── TextInput.tsx
│   │   ├── TextArea.tsx
│   │   ├── NumberInput.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── StatusMessage.tsx         info / success / error banner
│   │   └── Logo.tsx
│   │
│   ├── screens/
│   │   ├── QuestionnaireFlow.tsx     switch on step.type
│   │   ├── WelcomeScreen.tsx
│   │   ├── AudienceScreen.tsx
│   │   ├── IdentificationScreen.tsx
│   │   ├── QuestionScreen.tsx        renders any question type — see §6.3
│   │   ├── OpenAnswerScreen.tsx
│   │   ├── ThankYouScreen.tsx
│   │   ├── QrScreen.tsx              optional
│   │   └── StyleGuide.tsx            internal component gallery (dev aid)
│   │
│   ├── state/
│   │   ├── QuestionnaireContext.tsx  reducer + provider
│   │   ├── steps.ts                  buildSteps() — the flow, derived not stored
│   │   └── useQuestionnaire.ts       typed consumer hook
│   │
│   ├── data/                         ALL content. No JSX, no imports from components/
│   │   ├── types.ts                  the data contract — §5
│   │   ├── questionnaires/
│   │   │   ├── company.ts            ← YOU SUPPLY THIS
│   │   │   ├── individual.ts         ← YOU SUPPLY THIS
│   │   │   └── index.ts              registry: { company, individual }
│   │   ├── identification.ts         identification field definitions per audience
│   │   ├── visibility.ts             visibleQuestions() — the conditional-logic filter
│   │   ├── snapshot.ts               buildSnapshot() / resolveSnapshot()
│   │   └── publicUrl.ts              the production URL, for the QR screen
│   │
│   ├── network/                      the ONLY place in src/ allowed to call fetch
│   │   ├── submitResponse.ts
│   │   └── adminApi.ts
│   │
│   └── admin/                        lazy-loaded chunk
│       ├── AdminApp.tsx
│       ├── LoginScreen.tsx
│       ├── ListScreen.tsx
│       └── DetailScreen.tsx
│
├── tests/                            mirrors src/ and server/ 1:1
│   ├── setup.ts                      stubs global fetch so no test hits the network
│   ├── data/consistency.test.ts      structural invariants over the questionnaires
│   ├── state/steps.test.ts
│   ├── network/, admin/, server/, screens/
│   └── guards/no-network.test.ts     enforces the network rule — see §10
│
├── public/                           logos and static images, self-hosted
├── .env.example
├── vercel.json
├── vite.config.mts
├── tsconfig.json                     project references → app / node / server
├── CLAUDE.md                         the cross-cutting rules — §11
├── DECISIONS.md                      append-only decision log
└── MAINTENANCE.md                    "how to edit the questionnaires without touching code"
```

---

## 5. The questionnaire data contract

**This is the heart of the project and the section you fill in.** Questions, options, sections and
conditional logic live entirely in `src/data/`. No component ever hard-codes a question, a label or
an option. Changing the questionnaire must never require touching a file under `src/components/` or
`src/screens/`.

### 5.1 Types — `src/data/types.ts`

```ts
// ─── Audiences ──────────────────────────────────────────────────────────────
export type AudienceId = 'company' | 'individual'

// ─── Question types ─────────────────────────────────────────────────────────
export type QuestionType =
  | 'single_choice'   // pick exactly one option
  | 'multi_choice'    // pick one or more options
  | 'scale'           // integer on a labelled range, e.g. 1–5
  | 'short_text'      // one-line free text
  | 'long_text'       // multi-line free text
  | 'number'          // numeric value

export interface Option {
  id: string          // stable, short, unique within the question: 'a' | 'b' | 'yes' | 'no'
  text: string        // what the respondent reads
}

// ─── Conditional visibility ─────────────────────────────────────────────────
// The question is shown only if the referenced question was answered with one
// of the listed option ids.
// INVARIANT: `questionId` MUST refer to a question that appears EARLIER in the
// array. Enforced by tests/data/consistency.test.ts.
export interface ShowIf {
  questionId: string
  optionIds: string[]
}

// ─── Question ───────────────────────────────────────────────────────────────
interface QuestionBase {
  id: string          // globally unique within its questionnaire, e.g. 'C-Q01'
  sectionId: string   // must exist in the questionnaire's sections
  label: string       // short label for the admin list and CSV headers
  text: string        // the question as the respondent reads it
  help?: string       // optional clarifying sentence shown under the question
  required: boolean   // if false, the respondent may press Next without answering
  showIf?: ShowIf
}

export interface SingleChoiceQuestion extends QuestionBase {
  type: 'single_choice'
  options: Option[]
}

export interface MultiChoiceQuestion extends QuestionBase {
  type: 'multi_choice'
  options: Option[]
  minSelections?: number
  maxSelections?: number
}

export interface ScaleQuestion extends QuestionBase {
  type: 'scale'
  min: number         // typically 1
  max: number         // typically 5 or 10
  minLabel?: string   // e.g. "Not at all"
  maxLabel?: string   // e.g. "Completely"
}

export interface ShortTextQuestion extends QuestionBase {
  type: 'short_text'
  maxLength?: number  // default 200
  placeholder?: string
}

export interface LongTextQuestion extends QuestionBase {
  type: 'long_text'
  maxLength?: number  // default 2000
  placeholder?: string
}

export interface NumberQuestion extends QuestionBase {
  type: 'number'
  min?: number
  max?: number
  unit?: string       // rendered as a suffix, e.g. "employees", "€"
}

export type Question =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | ScaleQuestion
  | ShortTextQuestion
  | LongTextQuestion
  | NumberQuestion

// ─── Sections ───────────────────────────────────────────────────────────────
// Sections group questions for the admin detail view and the CSV. They do NOT
// create extra screens; the flow stays one question per screen.
export interface Section {
  id: string
  order: number
  name: string
  description?: string
}

// ─── Questionnaire ──────────────────────────────────────────────────────────
export interface Questionnaire {
  id: AudienceId
  name: string              // shown on the welcome / audience screens
  description: string
  estimatedDuration: string // e.g. "4–6 min", shown before starting
  version: string           // semver, e.g. 'company@1.0.0' — BUMP ON EVERY CONTENT CHANGE
  sections: Section[]
  questions: Question[]     // ORDER IN THIS ARRAY IS THE ORDER ON SCREEN
  openQuestion?: {          // the optional free-text question at the end
    text: string
    placeholder?: string
    maxLength: number       // 2000
  }
}

// ─── Answers ────────────────────────────────────────────────────────────────
export type AnswerValue =
  | { kind: 'option'; optionId: string }      // single_choice
  | { kind: 'options'; optionIds: string[] }  // multi_choice
  | { kind: 'number'; value: number }         // scale, number
  | { kind: 'text'; value: string }           // short_text, long_text

export type Answers = Record<string, AnswerValue>   // keyed by Question['id']
```

### 5.2 Identification fields — `src/data/identification.ts`

The identification screen is data-driven too, so the two audiences can ask for different things
without a second screen component.

```ts
export interface IdentificationField {
  id: string
  label: string
  type: 'short_text' | 'select' | 'number' | 'email'
  required: boolean
  options?: Option[]     // for 'select'
  maxLength?: number
  help?: string
}

export const IDENTIFICATION: Record<AudienceId, IdentificationField[]> = {
  company: [
    { id: 'companyName', label: 'Company name',  type: 'short_text', required: true,  maxLength: 200 },
    { id: 'sector',      label: 'Sector',        type: 'select',     required: true,  options: SECTORS },
    { id: 'size',        label: 'Employees',     type: 'select',     required: true,  options: SIZES },
    { id: 'role',        label: 'Your role',     type: 'short_text', required: false, maxLength: 120 },
  ],
  individual: [
    { id: 'ageRange',    label: 'Age range',     type: 'select',     required: true,  options: AGE_RANGES },
    { id: 'region',      label: 'Region',        type: 'select',     required: true,  options: REGIONS },
    { id: 'occupation',  label: 'Occupation',    type: 'short_text', required: false, maxLength: 120 },
  ],
}
```

Replace these fields with whatever your study needs. Keep them few — every extra required field
costs completions. Both audiences additionally get the **privacy consent checkbox**, which is
required and is not part of this list (it is handled by `IdentificationScreen` itself).

### 5.3 Worked example — `src/data/questionnaires/company.ts`

Copy this shape. It covers five of the six question types plus a conditional.

```ts
import type { Questionnaire } from '../types'

export const COMPANY_QUESTIONNAIRE: Questionnaire = {
  id: 'company',
  name: 'Company questionnaire',
  description: 'A few questions about how your organisation works today.',
  estimatedDuration: '5–7 min',
  version: 'company@1.0.0',

  sections: [
    { id: 'context',   order: 1, name: 'Context' },
    { id: 'practices', order: 2, name: 'Practices', description: 'What you do today.' },
  ],

  questions: [
    {
      id: 'C-Q01',
      sectionId: 'context',
      label: 'Formal strategy',
      text: 'Does your organisation have a documented strategy on this topic?',
      type: 'single_choice',
      required: true,
      options: [
        { id: 'a', text: 'No, and it is not planned' },
        { id: 'b', text: 'No, but we are working on it' },
        { id: 'c', text: 'Yes, documented but not communicated' },
        { id: 'd', text: 'Yes, documented, communicated and reviewed' },
      ],
    },
    {
      id: 'C-Q02',
      sectionId: 'context',
      label: 'Strategy owner',
      text: 'Who owns that strategy internally?',
      help: 'Choose the closest match.',
      type: 'single_choice',
      required: true,
      // Only asked to organisations that answered "yes" to C-Q01.
      showIf: { questionId: 'C-Q01', optionIds: ['c', 'd'] },
      options: [
        { id: 'a', text: 'General management' },
        { id: 'b', text: 'A dedicated department' },
        { id: 'c', text: 'An external consultant' },
        { id: 'd', text: 'Nobody in particular' },
      ],
    },
    {
      id: 'C-Q03',
      sectionId: 'practices',
      label: 'Active areas',
      text: 'Which of these areas are you actively working on?',
      type: 'multi_choice',
      required: true,
      minSelections: 1,
      options: [
        { id: 'energy',    text: 'Energy' },
        { id: 'waste',     text: 'Waste' },
        { id: 'water',     text: 'Water' },
        { id: 'suppliers', text: 'Suppliers' },
        { id: 'none',      text: 'None of the above' },
      ],
    },
    {
      id: 'C-Q04',
      sectionId: 'practices',
      label: 'Perceived maturity',
      text: 'How mature would you say your organisation is in this area?',
      type: 'scale',
      required: true,
      min: 1,
      max: 5,
      minLabel: 'Just starting',
      maxLabel: 'Fully mature',
    },
    {
      id: 'C-Q05',
      sectionId: 'practices',
      label: 'Main obstacle',
      text: 'What is the main obstacle you face?',
      type: 'short_text',
      required: false,
      maxLength: 200,
      placeholder: 'e.g. lack of budget',
    },
  ],

  openQuestion: {
    text: 'Anything else you would like to tell us?',
    placeholder: 'Optional',
    maxLength: 2000,
  },
}
```

`src/data/questionnaires/individual.ts` has the identical shape with `id: 'individual'` and its own
question ids (use a different prefix, e.g. `I-Q01`, so ids never collide across audiences in the
exported data).

### 5.4 HOW TO SUPPLY YOUR QUESTIONNAIRES

> You do **not** need to write TypeScript. Give Claude Code your questions in whatever form you
> already have them — a Word document, an Excel sheet, a pasted list, a PDF — and ask it to
> transcribe them into `src/data/questionnaires/company.ts` and
> `src/data/questionnaires/individual.ts` following the shape in §5.3.
>
> For each question, make sure your source states:
>
> 1. **The question text**, exactly as the respondent should read it.
> 2. **The answer type** — pick one option / pick several / a 1–5 scale / free text / a number.
> 3. **The options**, if it is a choice question, in the order they should appear.
> 4. **Required or optional.**
> 5. **Any conditional**: "only ask this if question X was answered A or B". The referenced question
>    must come earlier in the list.
> 6. **Which section** it belongs to (just a grouping name).
>
> Anything you leave unspecified will be flagged back to you rather than invented.
>
> **Editing later.** Questions, options, order, wording and conditionals can all be changed by
> editing only these two files — no component changes, no migration. **Bump the `version` string
> every time you change content**, so the admin panel and the exported data can tell which wording a
> given respondent actually saw.

### 5.5 Conditional visibility — `src/data/visibility.ts`

One pure function is the single source of truth for which questions apply. It is used by the step
builder, by the progress bar, by the submission payload and by the server-side validator. There must
be exactly one implementation.

```ts
import type { Question, Answers } from './types'

/**
 * Returns the questions currently applicable, in order.
 * Single pass: a `showIf` may only reference an earlier question, so by the time
 * we evaluate a question, the answer it depends on has already been seen.
 */
export function visibleQuestions(questions: Question[], answers: Answers): Question[] {
  return questions.filter((question) => {
    if (!question.showIf) return true
    const answer = answers[question.showIf.questionId]
    if (!answer) return false
    if (answer.kind === 'option')  return question.showIf.optionIds.includes(answer.optionId)
    if (answer.kind === 'options') return answer.optionIds.some((id) => question.showIf!.optionIds.includes(id))
    return false
  })
}
```

**Hidden questions keep their stored answer.** If a respondent answers Q02, then goes back and
changes Q01 so that Q02 no longer applies, Q02's answer stays in state but stops being visible — and
is excluded from the submitted payload. If they change Q01 back, their Q02 answer is still there.
Deleting it instead would silently lose work during normal back-and-forth navigation.

---

## 6. State and flow

### 6.1 Steps are derived, never stored — `src/state/steps.ts`

```ts
export type Step =
  | { type: 'welcome' }
  | { type: 'audience' }
  | { type: 'identification' }
  | { type: 'question'; question: Question; index: number; total: number }
  | { type: 'open-answer' }
  | { type: 'thank-you' }

export function buildSteps(
  questionnaire: Questionnaire | null,
  answers: Answers,
): Step[] {
  const steps: Step[] = [{ type: 'welcome' }, { type: 'audience' }]
  if (!questionnaire) return steps
  steps.push({ type: 'identification' })

  const visible = visibleQuestions(questionnaire.questions, answers)
  visible.forEach((question, i) =>
    steps.push({ type: 'question', question, index: i + 1, total: visible.length }),
  )

  if (questionnaire.openQuestion) steps.push({ type: 'open-answer' })
  steps.push({ type: 'thank-you' })
  return steps
}
```

The step list is **recomputed on every render** from the current audience and answers. The flow
therefore grows and shrinks live as conditionals flip. Because a `showIf` can only depend on an
earlier question, the current `stepIndex` always remains valid.

**The progress indicator uses `total` from the filtered list** — `visible.length`, never
`questionnaire.questions.length`. Using the unfiltered count makes the denominator wrong whenever a
conditional hides something.

### 6.2 Reducer — `src/state/QuestionnaireContext.tsx`

State:

```ts
interface State {
  audience: AudienceId | null
  identification: Record<string, string | number>
  privacyAccepted: boolean
  answers: Answers
  openAnswer: string
  stepIndex: number
  submission: { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }
}
```

Actions: `SET_AUDIENCE`, `SET_IDENTIFICATION_FIELD`, `SET_PRIVACY_ACCEPTED`, `SET_ANSWER`,
`SET_OPEN_ANSWER`, `GO_NEXT`, `GO_BACK`, `SET_SUBMISSION`, `RESET`.

- The `Questionnaire` object itself is **never stored in state** — it is looked up from the registry
  by `audience` on each render, so it cannot desync.
- `GO_NEXT` / `GO_BACK` only clamp `stepIndex` between `0` and `steps.length - 1`.
- `RESET` returns the initial state. That is all "New questionnaire" does.
- **No `localStorage`, `sessionStorage` or IndexedDB.** In-progress answers do not survive a refresh,
  by design: a shared device at an event must not leak one respondent's draft into the next
  respondent's session.

### 6.3 One question screen for all types — `src/screens/QuestionScreen.tsx`

`QuestionScreen` switches on `question.type` and renders the matching input component. It owns the
per-type "can we continue?" rule, and nothing else:

| Type            | Component        | Next is enabled when                                  |
| --------------- | ---------------- | ----------------------------------------------------- |
| `single_choice` | `RadioGroup`     | an option is selected (or `required: false`)          |
| `multi_choice`  | `CheckboxGroup`  | selection count is within `[minSelections, maxSelections]` |
| `scale`         | `ScaleInput`     | a value is chosen                                      |
| `short_text`    | `TextInput`      | non-empty and within `maxLength`                       |
| `long_text`     | `TextArea`       | non-empty and within `maxLength`                       |
| `number`        | `NumberInput`    | a number within `[min, max]`                           |

Adding a question type later means adding one case here and one variant in `types.ts` — nothing
else.

---

## 7. Persistence

### 7.1 The submission call — `src/network/submitResponse.ts`

`src/network/` is the **only** directory in `src/` allowed to call `fetch`, and every URL it targets
must start with `/api/`. This is enforced by a test ([§10](#10-testing-strategy)).

```ts
export interface SubmissionPayload {
  audience: AudienceId
  questionnaireId: AudienceId
  questionnaireVersion: string
  identification: Record<string, string | number>
  answers: Answers                 // visible questions only
  openAnswer: string | null
  snapshot: QuestionnaireSnapshot  // see §7.3
}

export async function submitResponse(payload: SubmissionPayload): Promise<void> {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Submission failed (${response.status}).`)
  }
}
```

Only answers to **currently visible** questions are included. Filter with `visibleQuestions()` right
before building the payload.

### 7.2 Server-side validation — `server/validateSubmission.ts`

The server never trusts the client's idea of what the questionnaire is. It loads the questionnaire
for the declared audience from the same `src/data/` modules (imported by relative path — the code is
shared verbatim between browser and function) and checks:

1. `audience` is one of the two known ids.
2. Every required identification field is present, of the right type, within its length limit; for
   `select` fields the value is one of the declared option ids. Unknown keys are rejected.
3. `visibleQuestions(questionnaire.questions, answers)` is recomputed server-side, and **the set of
   answered question ids must equal the set of visible required question ids exactly** — no extras,
   no missing required ones.
4. Each answer's `kind` matches its question's `type`, and its value is legal: option ids exist,
   multi-choice counts are within bounds, scale/number values are within range, text is within
   `maxLength`.
5. `openAnswer` is at most 2000 characters.

Anything that fails returns `400` with a message. This function — not the client, and not the rate
limiter — is the real defence.

### 7.3 The questionnaire snapshot — `src/data/snapshot.ts`

**This is the single most important decision for "a later study."**

Along with the answers, store the **exact questions and option texts that were shown to that
respondent**:

```ts
export interface QuestionnaireSnapshot {
  questionnaireId: AudienceId
  version: string
  capturedAt: string             // ISO timestamp
  questions: Array<{
    id: string
    label: string
    text: string
    type: QuestionType
    sectionId: string
    sectionName: string
    options?: Array<{ id: string; text: string }>
  }>
}

export function buildSnapshot(questionnaire: Questionnaire, answers: Answers): QuestionnaireSnapshot
```

Without this, the day you reword a question or reorder its options, every previously collected row
becomes ambiguous — `"C-Q03": "b"` means nothing if `b` used to be "Waste" and is now "Water". With
it, every row is self-describing forever, and the admin detail view and the CSV export render
historical responses with the wording that respondent actually read.

The snapshot is built from the **visible** questions only, at submission time.

### 7.4 Submission is not fire-and-forget

The respondent sees no result, so there is nothing to fall back on if the POST fails. The flow is:

1. Reaching the thank-you step dispatches `SET_SUBMISSION { status: 'sending' }` and calls
   `submitResponse`. Guard against React StrictMode double-invocation with a ref.
2. On success → `'sent'`, show "Your answers have been recorded." and the "New questionnaire" button.
3. On failure → `'error'`, show a clear message, a **Retry** button, and **do not clear the state**.
   The respondent's answers stay in memory so a retry on a better connection still works.

Never show a thank-you message for a submission that did not reach the database.

### 7.5 Schema — `supabase/schema.sql`

One table. Treat this file as an **append-only change log**: never edit an existing statement, add a
new `alter table … if not exists` line at the bottom with a dated comment.

```sql
-- Responses collected by the questionnaire app.
-- Applied manually in the Supabase SQL editor. Append-only: never rewrite history.

create table if not exists responses (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),

  respondent_type       text not null check (respondent_type in ('company', 'individual')),
  identification        jsonb not null,

  questionnaire_id      text not null,
  questionnaire_version text not null,

  answers               jsonb not null,
  questionnaire         jsonb not null,          -- the snapshot, §7.3
  open_answer           text check (char_length(open_answer) <= 2000)
);

create index if not exists responses_created_at_idx      on responses (created_at desc);
create index if not exists responses_respondent_type_idx on responses (respondent_type);

-- Free-text search over the identification blob (company name, occupation, …).
create extension if not exists pg_trgm;
create index if not exists responses_identification_idx
  on responses using gin ((identification::text) gin_trgm_ops);

-- RLS enabled with ZERO policies: only the service_role key (used exclusively
-- server-side, never shipped to the browser) can read or write this table.
alter table responses enable row level security;
```

### 7.6 Repository — `server/responsesRepository.ts`

- `insertResponse(payload)` — maps camelCase payload → snake_case columns.
- `buildQuery(client, columns, filters)` — **shared** by the list and the export, so the CSV can
  never diverge from what the admin sees on screen.
- `listResponses(filters)` — 5 columns, default limit 200.
- `getResponse(id)` — `select('*')`.
- `listResponsesForExport(filters)` — all columns, hard limit 1000.

Filters map to `.eq('respondent_type')`, `.ilike('identification::text', '%…%')`,
`.order(column, { ascending })`, `.limit()`.

---

## 8. Admin panel

### 8.1 Auth — `server/auth.ts`

A **single shared team password**. No user accounts, no JWT library, no OAuth.

- `ADMIN_PASSWORD_HASH` holds the SHA-256 hex digest of the password. `verifyPassword` hashes the
  submitted value and compares with `crypto.timingSafeEqual` (after a length check).
- On success, set a session cookie whose value is `"<expiryEpochMs>.<hmacSha256Hex>"`, signed with
  `ADMIN_SESSION_SECRET`:

```ts
const SESSION_DURATION_SECONDS = 10 * 60 * 60   // 10 h

export function createSessionCookieValue(): string {
  const expiresAt = String(Date.now() + SESSION_DURATION_SECONDS * 1000)
  return `${expiresAt}.${sign(expiresAt)}`
}
```

- Cookie flags: `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=36000`. Logout re-sets it with
  `Max-Age=0`.
- `hasValidAdminSession(req)` verifies the HMAC and the expiry, and is the **first line of every
  admin handler**; failure returns `401 { error: 'Invalid session.' }`.

Plain SHA-256 rather than bcrypt/scrypt is acceptable here **only because** the secret is a long
random team password stored in an env var, never a user-chosen one, and the hash is never exposed.
Write that reasoning in a comment so nobody "fixes" it without thinking.

### 8.2 Admin API client — `src/network/adminApi.ts`

```ts
export class InvalidSessionError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (response.status === 401) throw new InvalidSessionError('Invalid session.')
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Unexpected error (${response.status}).`)
  }
  return (await response.json()) as T
}
```

| Function                          | Call                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `loginAdmin(password)`            | `POST /api/admin/login` `{ password }`                         |
| `logoutAdmin()`                   | `POST /api/admin/logout`                                       |
| `listResponsesAdmin(filters)`     | `GET /api/admin/responses?search&type&order&direction`         |
| `getResponseAdmin(id)`            | `GET /api/admin/response?id=<encoded>`                         |
| `exportUrl(format, filters)`      | returns a URL **string** for `/api/admin/export?format=wide\|long&…` — used as an `<a href>` so the browser sends the cookie and handles the download; never fetched |

### 8.3 Panel screens — `src/admin/`

- **`AdminApp.tsx`** — three states (`authenticated: boolean | null`). On mount it simply calls the
  list endpoint: a `401` *is* the session check and shows the login screen; any other failure forces
  `false` rather than hanging on "Checking session…", and passes the message down so the user sees
  what went wrong.
- **`LoginScreen.tsx`** — password field. Only `InvalidSessionError` renders "Incorrect password";
  every other error shows the server's message verbatim.
- **`ListScreen.tsx`** — filter form with an explicit **Apply** submit (not debounced-on-type):
  free-text search, respondent type (`All` / `Company` / `Individual`), sort by date, asc/desc.
  Table columns: Date, Type, Identification summary, Questionnaire version, Answers count. Rows are
  keyboard-activatable (`role="button"`, Enter and Space). Header carries the export links and
  Logout.
- **`DetailScreen.tsx`** — a `<dl>` of metadata (date, type, every identification field, version),
  then the answers **paired with their snapshotted question and option texts**, grouped by section,
  then the open answer. Never render a bare option id.

### 8.4 CSV export — `server/exports.ts` + `server/csv.ts`

Two shapes, both pure functions over the rows:

- **`wide`** — one row per response. Headers:
  `id, date, date_iso, respondent_type, <one column per identification field>,
  questionnaire_id, questionnaire_version, answers_count, <one column per question id>, open_answer`.
  Choice answers are written as the **option text**, multi-choice as texts joined by `|`.
- **`long`** — one row per **answer**. Headers:
  `response_id, date, respondent_type, section_id, section_name, question_id, question_label,
  question_text, question_type, answer_kind, answer_value, answer_text`.
  This is the shape you want for statistical analysis in R, Python or Excel pivot tables.

Hard rule: **no answer is ever silently dropped**. If a row cannot be resolved against its snapshot,
emit the raw ids and mark the row `unresolved` in a dedicated column.

`server/csv.ts` is tuned for Excel in a European locale: **UTF-8 BOM**, `;` separator, CRLF line
endings, fields containing `"`, `;`, CR or LF wrapped in quotes with `"` doubled. Filenames:
`responses-wide.csv` / `responses-long.csv`, or `response-<id>-long.csv` for a single row.

---

## 9. Environment, deployment, operations

### 9.1 `.env.example`

Four server-only variables. **None are prefixed `VITE_`** — a `VITE_` prefix would bundle the value
into the browser build, which for the service-role key would be a full database compromise.

```bash
# Supabase — Project settings → API
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Admin panel: SHA-256 hex digest of the shared password.
#   node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
ADMIN_PASSWORD_HASH=

# Random secret used to sign the admin session cookie.
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_SESSION_SECRET=
```

`server/env.ts` reads each one and **throws a named error if it is missing**, so a
misconfigured deploy fails loudly on the first request instead of returning empty lists.

### 9.2 `vercel.json`

```json
{
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ]
}
```

### 9.3 Serverless routing pitfalls — read before creating files in `api/`

- **No `[dynamic]` path segments.** Ids travel in the **query string** (`/api/admin/response?id=…`).
- **Never create a file with the same name as a sibling directory** (`api/admin/responses.ts`
  alongside `api/admin/responses/`). The function is silently not published and the SPA rewrite
  returns HTML where JSON is expected — a confusing failure worth avoiding structurally.
- A test asserts both of these over the `api/` directory shape ([§10](#10-testing-strategy)).

### 9.4 Shared HTTP plumbing — `server/http.ts`

Define your own minimal `ApiRequest` / `ApiResponse` interfaces rather than depending on
`@vercel/node`, plus `singleParam(query, key)`, `parseCookies(req)`, and:

```ts
export function withErrorHandling(handler: Handler): Handler
```

Every route is wrapped in it, so an uncaught throw (a missing env var, a Supabase outage) returns a
JSON `500 { error }` instead of the platform's bodiless `FUNCTION_INVOCATION_FAILED`, which is
undebuggable from the browser.

### 9.5 Rate limiting — `server/rateLimit.ts`

An in-memory sliding window (`Map<string, number[]>`, 10 requests / 10 minutes, keyed on the first
hop of `x-forwarded-for`) on `POST /api/responses` and `POST /api/admin/login`. Be honest in the
comment: on serverless this resets on every cold start and is per-instance, so it deters casual
abuse only. Validation and auth are the real protections.

### 9.6 Operations runbook — put this in `MAINTENANCE.md`

1. **Database changes are manual.** Run the new statements from `supabase/schema.sql` in the
   Supabase SQL editor **before** pushing code that depends on them. There is no migration tool, so
   pushing first means every insert fails against the old schema.
2. **Deploy = `git push` to `main`.** Vercel builds and publishes.
3. **Verify the deploy actually shipped**, don't assume:
   `curl -s https://<your-app>/ | grep -o 'assets/index-[^"]*\.js'` and confirm the hash changed.
4. **Pre-event checklist**: submit one real test response, confirm it appears in `/admin`, download
   both CSVs, then delete the test row.
5. **Changing the questionnaire**: edit the file in `src/data/questionnaires/`, bump `version`, push.
   Old responses keep rendering correctly thanks to the snapshot.

---

## 10. Testing strategy

`npm test` runs `vitest run`. Config lives in the `test` block of `vite.config.mts`
(`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./tests/setup.ts']`). `tests/setup.ts`
stubs `globalThis.fetch` so no test can reach the network.

Build these tests:

| Test                                | What it locks down |
| ----------------------------------- | ------------------ |
| `tests/data/consistency.test.ts`    | **Run this against both questionnaires.** Question ids unique; `sectionId` exists; choice questions have ≥2 options with unique ids; every `showIf.questionId` exists **and appears earlier in the array**; every `showIf.optionIds` entry exists on the referenced question; `scale` has `min < max`; `version` matches `^(company\|individual)@\d+\.\d+\.\d+$` |
| `tests/data/visibility.test.ts`     | The filter shows/hides correctly; hidden answers are retained in state but excluded from the payload |
| `tests/state/steps.test.ts`         | Step list length and order per audience; flow grows/shrinks when a conditional flips; `stepIndex` stays valid |
| `tests/screens/*.test.tsx`          | Each question type renders and enables Next under the right conditions; Back preserves answers |
| `tests/screens/ThankYouScreen.test.tsx` | `sending` → `sent`; failure shows the error and a working Retry; StrictMode does not double-submit |
| `tests/network/*.test.ts`           | Exact URL, method, headers and body for each call; `401` → `InvalidSessionError`; server error messages propagate; `exportUrl` builds the right query string and omits empty filters |
| `tests/server/validateSubmission.test.ts` | Missing required answer → reject; extra answer for a hidden question → reject; wrong value type → reject; unknown option id → reject; a valid payload passes |
| `tests/server/api-handlers.test.ts` | All six routes with a mocked repository: `405` wrong method, `429` rate-limited, `400` invalid, `401` unauthenticated, `404` unknown id, happy path |
| `tests/server/{auth,csv,exports,repository}.test.ts` | Cookie signing and expiry; CSV escaping and BOM; both export shapes; snake_case mapping |
| `tests/admin/AdminApp.test.tsx`     | Login → list → detail → logout |
| `tests/guards/api-routes.test.ts`   | Structural guard over `api/`: no `[dynamic]` segments, no file named like a sibling folder, all `.ts` |
| `tests/guards/no-network.test.ts`   | **The network rule.** No `XMLHttpRequest`, `WebSocket` or `axios` anywhere in `src/`; `fetch` appears only in `src/network/`; every fetch target string starts with `/api/`; `index.html` contains zero external URLs; `package.json` contains no analytics SDK |

---

## 11. Cross-cutting rules — put this in `CLAUDE.md`

1. **Inspect before writing.** Read what exists and reuse it. Do not duplicate, do not overwrite
   working code.
2. **Always runnable.** At the end of every phase `npm run dev` works and `npm test` is green.
3. **Minimal, justified network.** The only network traffic is the app talking to its own
   `/api/...` routes, and it all lives in `src/network/`. No CDN, no remote fonts, no analytics, no
   third-party SDK, no AI call at runtime. Fonts and assets are self-hosted and bundled.
4. **Data separated from UI.** Questions, options, sections, identification fields and conditionals
   live in `src/data/` and are editable without touching a single component.
5. **Deterministic.** Nothing shown to the respondent or the admin is generated, inferred or
   invented. Every displayed string comes from the data files or from stored answers.
6. **Nothing fabricated about the organisation.** No invented logos, claims, figures or branding. If
   real assets are missing, use a neutral identity and say so.
7. **No AI slop.** Forbidden: purple/blue gradients, gratuitous glassmorphism, card soup, heavy
   shadows, icon overload, default Inter/Roboto with no reason, animation for its own sake, generic
   "dashboard template" aesthetics.
8. **Accessibility and responsiveness by default.** Sufficient contrast, visible focus states, full
   keyboard navigation, real `<label>`s, `aria-live` for status messages, `prefers-reduced-motion`
   respected, and no layout breakage from 320 px to desktop.
9. **One user-facing language, centralised.** Decide the respondent-facing language up front. All
   user-visible strings live in the data files or a single strings module — never inline in JSX.
10. **Reusable many times a day.** "New questionnaire" is always reachable and never reloads the app.
11. **No unjustified dependencies.** Every addition beyond the §3 stack needs a written reason in
    `DECISIONS.md`.
12. **Small changes, clear commits, checkpoints.** At each marked checkpoint: stop, report what was
    built, which tests pass, and what needs a human decision.
13. **Product doubts are questions, not guesses.** Anything affecting the questionnaire content, the
    data model or the branding gets proposed and validated, never invented.

---

## 12. Build order

Each phase ends with a runnable app and green tests. **Checkpoints marked 🛑 require human review
before continuing.**

| # | Phase | Deliverable |
| - | ----- | ----------- |
| 1 | **Scaffold** | Vite + React + TS project, tsconfig project references (app / node / server), Vitest wired into `vite.config.mts`, oxlint, `npm run dev` shows a placeholder |
| 2 | **Design foundation** | `tokens.css`, self-hosted fonts, `Screen`, `Button`, `ProgressBar`, `StatusMessage`, `Logo`, plus `StyleGuide.tsx` showing them all 🛑 *review the visual direction* |
| 3 | **Data layer** | `types.ts`, `visibility.ts`, `snapshot.ts`, `identification.ts`, and **the two questionnaires transcribed from your source material**, with `consistency.test.ts` green 🛑 *review the transcription question by question* |
| 4 | **Inputs** | `RadioGroup`, `CheckboxGroup`, `ScaleInput`, `TextInput`, `TextArea`, `NumberInput`, `Select`, `SelectableOption`, all in the style guide |
| 5 | **Flow** | `steps.ts`, `QuestionnaireContext`, all screens up to the open answer; the full questionnaire is walkable end to end in the browser with no backend 🛑 *walk both paths on a phone* |
| 6 | **Thank you + submission client** | `submitResponse.ts`, submission states, retry, "New questionnaire" |
| 7 | **Backend** | `schema.sql` applied in Supabase, `server/*`, `api/responses.ts`; a real submission lands in the database 🛑 *verify the row in Supabase* |
| 8 | **Admin** | Auth, the four admin endpoints, `AdminApp` with login / list / detail |
| 9 | **Export** | `csv.ts`, `exports.ts`, `api/admin/export.ts`, both shapes, opened in Excel 🛑 *confirm the CSV is analysable as you need* |
| 10 | **Hardening** | Remaining tests incl. the guard tests, accessibility pass, responsive pass, `MAINTENANCE.md`, `DECISIONS.md`, deploy to Vercel and verify |

---

## 13. Kickoff prompt

Create an empty folder, put this file in it together with your two questionnaire sources, then give
Claude Code this prompt:

> Read `QUESTIONNAIRE-APP-BLUEPRINT.md` in full before doing anything. It is the complete
> specification for this project — follow it exactly, including the "do not add" lists.
>
> My two questionnaires are in `<your-company-file>` and `<your-individual-file>`. Transcribe them
> into `src/data/questionnaires/company.ts` and `src/data/questionnaires/individual.ts` following
> §5. If any question is missing its answer type, its options, its required flag or its conditional
> logic, **ask me** — do not invent it.
>
> The respondent-facing language is **`<your language>`**.
>
> Work through the build order in §12, phase by phase. At each 🛑 checkpoint, stop and report what
> you built, which tests pass, and what needs my decision. Do not skip ahead.
>
> Start with phase 1.
