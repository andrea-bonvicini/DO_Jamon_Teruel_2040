# Cross-cutting rules

These are binding for every change in this repository. They come from
`QUESTIONNAIRE-APP-BLUEPRINT.md` §11, which remains the full specification.

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
9. **One user-facing language, centralised.** The respondent-facing language is **Spanish**. All
   user-visible strings live in the data files or in `src/data/strings.ts` — never inline in JSX.
10. **Reusable many times a day.** "Nuevo cuestionario" is always reachable and never reloads the
    app.
11. **No unjustified dependencies.** Every addition beyond the blueprint §3 stack needs a written
    reason in `DECISIONS.md`.
12. **Small changes, clear commits, checkpoints.** At each marked checkpoint: stop, report what was
    built, which tests pass, and what needs a human decision.
13. **Product doubts are questions, not guesses.** Anything affecting the questionnaire content, the
    data model or the branding gets proposed and validated, never invented.

## Project specifics

- Two audiences: `company` (empresas del sector) and `individual` (consumidores).
- **The two audiences are NOT treated alike, and the wording must never blur it:**
  - `individual` is **anonymous**. No identifying field is asked, and the notices say «anónima».
  - `company` is a census of named firms, so the identification screen asks for a required
    company name. Its notices promise **confidentiality and aggregate publication**, never
    anonymity. Both `privacyNoticeCompany` and `sentDetailCompany` in `src/data/strings.ts` carry
    that wording; if you add a field that identifies someone, update the matching notice in the
    same commit.
- Bump the `version` string in a questionnaire file on **every** content change.
- `dev/` holds a development-only in-memory backend. It must never be imported from `src/` or
  `api/` — `tests/guards/dev-isolation.test.ts` enforces it.
