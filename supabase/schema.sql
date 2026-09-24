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
