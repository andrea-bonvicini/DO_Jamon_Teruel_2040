-- Responses collected by the D.O. Jamón de Teruel questionnaire app.
-- Applied MANUALLY in the Supabase SQL editor. Append-only: never rewrite an
-- existing statement; add a new `alter table … if not exists` at the bottom
-- with a dated comment.

create table if not exists responses (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),

  respondent_type       text not null check (respondent_type in ('company', 'individual')),
  identification        jsonb not null,

  questionnaire_id      text not null,
  questionnaire_version text not null,

  answers               jsonb not null,
  questionnaire         jsonb not null,          -- the snapshot
  open_answer           text check (char_length(open_answer) <= 2000)
);

create index if not exists responses_created_at_idx      on responses (created_at desc);
create index if not exists responses_respondent_type_idx on responses (respondent_type);

-- Free-text search over the identification blob. Companies store their name
-- there, so this is what makes the admin search box useful; consumer rows are
-- anonymous and leave it empty.
create extension if not exists pg_trgm;
create index if not exists responses_identification_idx
  on responses using gin ((identification::text) gin_trgm_ops);

-- RLS enabled with ZERO policies: only the service_role key — used exclusively
-- server-side, never shipped to the browser — can read or write this table.
alter table responses enable row level security;

-- 2026-09-30 · Fieldwork metadata for the microdata export.
--
-- `wave` is stamped server-side from the WAVE environment variable, never by
-- the client: a wave is a fieldwork round and a respondent has no say in it.
-- It is NOT the same thing as `questionnaire_version` — the content changed
-- mid-wave on 2026-09-28 — and conflating them would break exactly the
-- wave-over-wave comparison the codes exist to allow.
--
-- `started_at` comes from the browser, so it is the one field here that a
-- respondent could in principle forge. It is used for duration only, never
-- for anything that matters.
--
-- NOTE: rows written before this migration have NULL in all four. That is
-- correct and must stay distinguishable from a real value.
alter table responses add column if not exists wave              text;
alter table responses add column if not exists started_at        timestamptz;
alter table responses add column if not exists completion_status text
  check (completion_status in ('complete', 'partial'));

create index if not exists responses_wave_idx on responses (wave);
