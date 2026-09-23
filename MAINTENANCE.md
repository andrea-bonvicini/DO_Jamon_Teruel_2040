# Maintenance

How to run, change and operate the D.O. Jamón de Teruel questionnaire app. Written so the
questionnaires can be edited without touching a component.

---

## 1. Running it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # the whole suite
npm run typecheck
npm run lint
```

Useful local URLs:

| URL | What it is |
| --- | --- |
| `/` | the questionnaire |
| `/admin` | the admin panel (needs the env vars below) |
| `/qr` | a printable QR poster for a stand |
| `/styleguide` | the component gallery, including the red panel (development only) |

The frontend runs fine with no backend: submissions will simply fail on the thank-you screen and
offer a Retry.

---

## 2. Changing the questionnaires

**This is the only file you need to touch**, one per audience:

- `src/data/questionnaires/individual.ts` — the consumer survey
- `src/data/questionnaires/company.ts` — the company survey

You can change question wording, option wording, option order, question order, required flags and
conditionals entirely inside these files. No component changes, no database migration.

### The rules

1. **Bump the `version` string on every content change**, e.g. `'company@1.0.0'` → `'company@1.1.0'`.
   The version is stored with every response so you can always tell which wording a respondent saw.
   `npm test` fails if the format is wrong.
2. **Never reuse a question id for a different question.** Old responses reference it.
3. **Never change an option `id`** — change its `text` instead. The id is what is stored; the text
   is what is read. Changing an id orphans every previous answer.
4. **A `showIf` may only reference a question that appears EARLIER in the array.** A test enforces
   this.
5. Run `npm test` after every edit. `tests/data/consistency.test.ts` checks ids, sections, option
   counts, selection bounds, scale ranges and every conditional.

### Question types available

| `type` | Extra fields | Renders as |
| --- | --- | --- |
| `single_choice` | `options`, optional `display: 'select'` | radio cards, or a dropdown for long lists |
| `multi_choice` | `options`, `minSelections`, `maxSelections` | checkbox cards; options past the cap are disabled |
| `scale` | `min`, `max`, `minLabel`, `maxLabel` | a row of numbered buttons |
| `scale_grid` | `rows`, `min`, `max`, `minLabel`, `maxLabel` | one rating matrix, one stored value per row |
| `short_text` | `maxLength` (default 200), `placeholder` | one-line field |
| `long_text` | `maxLength` (default 2000), `placeholder` | textarea with a character counter |
| `number` | `min`, `max`, `unit` | numeric field; accepts both `22.5` and `22,5` |

### Identification fields and what you may promise

`src/data/identification.ts` holds the fields asked before the questions start:

- **Companies** are asked for `companyName`, required, 200 characters. The census is of named
  firms, so the name is what lets you de-duplicate and follow up.
- **Consumers** are asked for nothing. They stay fully anonymous.

Adding a field is a one-line change there — the screen, the validator, the admin detail view and
both CSV shapes pick it up with no other change. **But the privacy notice is not automatic.**
`STRINGS.identification` holds two notices, `privacyNoticeCompany` and `privacyNoticeIndividual`,
and `IdentificationScreen` picks by audience. If you add a field that identifies someone, update
the matching notice in the same commit. The company notice deliberately never says "anónima" — it
promises confidentiality and aggregate publication instead.

---

## 3. The layout and the palette

### One composition

Every screen is built the same way, top to bottom, and it all lives in
`src/components/Screen.tsx` and `Screen.css`:

1. a full-bleed **red band** with the brand, the progress bar and the question;
2. the **answer** on cream underneath;
3. a sticky footer with Back / Next.

**The band is full width, but its inner content shares the same `--measure` container as the
answer below it.** That is what puts the question and the first option on one vertical axis so the
eye reads straight down. If you ever change one of those widths, change the other too — separating
them re-creates the left-right journey this layout was built to remove.
`tests/screens/Screen.test.tsx` pins the DOM order so the question cannot drift back beside the
answers unnoticed.

`--measure` is 42rem (65–75 characters a line). `width="wide"` switches to `--measure-wide`
(64rem) for the admin panel and the style guide.

**Nothing is stored in the browser.** No answers, no preferences, no cookies — the app has no
`localStorage` at all, and `tests/guards/no-network.test.ts` enforces it. A shared tablet cannot
leak one respondent's draft into the next session.

### Red is primary, cream is secondary

`.screen__panel` is the red surface. It **redefines the semantic colour tokens inside itself**, so
`Logo`, `ProgressBar` and the headings invert automatically.

This is why components must only ever read the semantic aliases (`--color-heading`, `--color-text`,
`--color-accent`, `--color-focus`, …) and never the raw `--color-wine-*` / `--color-cream-*` scale.
A raw reference in a component will not invert and will come out unreadable on the band.

Gold (`--color-gold`) only ever appears **on red**: the progress fill, the 1px rule under the band,
the "D.O." in the wordmark. On cream it measures 2.46:1, so it never carries text or a meaningful
border there.

If you change a band colour, re-check the contrast. Current measurements against the band:
cream-50 text 9.3:1, wine-100 muted text 7.5:1, focus ring 9.3:1 — all AAA.

---

## 4. Running it without Supabase

`npm run dev` serves the `/api` routes from `dev/api.ts` against an **array in memory**, so the
whole product works locally with no database: fill the questionnaire in, watch the response appear
in `/admin`, download the CSVs.

- It reuses the real validation, auth, filters and CSV code. Only the storage and the route
  dispatch are development-specific.
- Three sample responses are seeded from `dev/seed.ts`. Every one is labelled **EJEMPLO** so a
  seeded row can never be mistaken for a real one.
- The store is wiped when the dev server restarts. It is not a database.
- **None of this ships.** The Vite plugin is `apply: 'serve'`; on Vercel the real handlers in
  `api/` take over, and `tests/guards/dev-isolation.test.ts` fails if anything in `src/` or `api/`
  ever imports from `dev/`.

---

## 5. Environment variables

Four, all server-side. **None may be prefixed `VITE_`** — that would bundle the value into the
browser build, which for the service-role key is a full database compromise.

`.env` already exists locally with `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` generated. It
is in `.gitignore` and must never be committed.

### Connecting your Supabase project

1. **Create the project** at supabase.com (the free tier is plenty for two surveys).
2. **Create the table**: open the SQL editor, paste the whole of `supabase/schema.sql` and run it.
   Do this *before* pushing any code that depends on it — there is no migration tool.
3. **Copy the two keys** from Project settings → API:
   - `SUPABASE_URL` ← "Project URL"
   - `SUPABASE_SERVICE_ROLE_KEY` ← the **`service_role`** key, the secret one.
     **Not** the `anon public` key: that one is subject to row-level security, and this table has
     RLS on with zero policies, so `anon` can read and write nothing.
4. **Paste them into `.env`** and restart `npm run dev`. From then on the dev server still uses the
   in-memory store; to exercise Supabase itself, deploy or run `vercel dev`.
5. **In Vercel**, set the same four variables under Settings → Environment Variables, for
   Production and Preview.

Regenerating the admin password:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('NUEVA').digest('hex'))"
```

`server/env.ts` throws a named error if any variable is missing, so a misconfigured deploy fails
loudly on the first request instead of quietly returning empty lists.

---

## 6. Database changes are manual

There is no migration tool. Run the new statements from `supabase/schema.sql` in the Supabase SQL
editor **before** pushing code that depends on them — pushing first means every insert fails
against the old schema.

`supabase/schema.sql` is an **append-only change log**. Never rewrite an existing statement; add a
new `alter table … if not exists` at the bottom with a dated comment.

The table has RLS enabled with **zero policies**, so only the service-role key can read or write
it. That key lives only in the serverless functions and is never shipped to the browser.

---

## 7. Deploying

1. `git push` to `main`. Vercel builds and publishes.
2. **Verify the deploy actually shipped**, don't assume:
   ```bash
   curl -s https://<your-app>/ | grep -o 'assets/index-[^"]*\.js'
   ```
   Confirm the hash changed from the previous deploy.
3. Update `PUBLIC_URL` in `src/data/publicUrl.ts` once the real domain is known — the `/qr` poster
   encodes it.

---

## 8. Pre-event checklist

Before a fair, a stand or a mailing:

- [ ] Submit one real test response per audience on the production URL.
- [ ] Confirm both appear in `/admin` with their answers rendered as texts, not ids.
- [ ] Download both CSVs and open them in Excel; check the accents and the `;` columns.
- [ ] Delete the test rows in the Supabase table editor.
- [ ] Print the `/qr` poster and scan it with a phone that is not on the office wi-fi.
- [ ] On the laptop you will actually use: confirm the question sits directly above the answers
      and that both line up on the same left edge.
- [ ] Confirm a company response cannot be submitted without a company name, and that the notice on
      that screen says *confidencial*, not *anónima*.
- [ ] On the event tablet: run one full questionnaire, press **Nuevo cuestionario**, confirm the
      next one starts blank. Nothing is stored in the browser, so one respondent's draft can never
      leak into the next respondent's session.

---

## 9. Reading the data

Two CSV shapes from `/admin`:

- **wide** — one row per response, one column per question. `C-Q15_aporta-valor` style columns for
  each rating-grid row. Choice answers are written as the option **text**; multi-choice texts are
  joined with `|`. Good for a quick look in Excel.
- **long** — one row per answer, with `section_id`, `question_label`, `question_text`, `row_id`,
  `row_text`, `answer_kind`, `answer_value` (raw ids) and `answer_text` (resolved). This is the
  shape for R, Python or a pivot table.

Both render each response from **its own stored snapshot**, so responses collected under an older
wording keep showing that wording. An answer that cannot be resolved against its snapshot is never
dropped: the raw ids are written and the row is flagged in the `unresolved` column.

Company responses carry `id_companyName` in the wide CSV and appear under `identification` in the
admin list; consumer rows show `Anónima` there. The admin search box matches the company name,
because it runs an `ilike` over the whole identification blob.

Both are also readable straight from Postgres — `answers` and `questionnaire` are `jsonb`.

The consumer survey's Van Westendorp block (`I-Q10`–`I-Q13`) is four `number` columns in €/kg, in
the order: too cheap, cheap, getting expensive, too expensive.

---

## 10. Things that will bite you

- **Never create a file in `api/` with the same name as a sibling directory.** The function is
  silently not published and the SPA rewrite returns HTML where JSON is expected.
  `tests/guards/api-routes.test.ts` checks this.
- **No `[dynamic]` path segments in `api/`.** Ids travel in the query string.
- **The rate limiter is per-instance and resets on cold start.** It deters casual abuse only.
  `server/validateSubmission.ts` and the admin session check are the real protections.
- **Answers to hidden questions stay in memory but are excluded from the payload.** That is
  deliberate: a respondent who changes an earlier answer and changes it back does not lose work.
- **Admin sessions last 10 hours** and the cookie is `Secure`. Browsers treat `localhost` as a
  secure context, so local testing works, but any other plain-`http://` host will silently fail to
  keep the session. Test the panel on `localhost` or on a Vercel preview deployment.
