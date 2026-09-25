-- Run once before switching the production n8n FSM to the education-context version.
-- The columns are nullable so existing unfinished sessions remain readable.
alter table public.user_sessions
  add column if not exists education_stage text,
  add column if not exists school_class text,
  add column if not exists course text;

alter table public.user_sessions
  drop constraint if exists user_sessions_education_stage_check;

alter table public.user_sessions
  add constraint user_sessions_education_stage_check
  check (education_stage is null or education_stage in ('school', 'college', 'university'));
