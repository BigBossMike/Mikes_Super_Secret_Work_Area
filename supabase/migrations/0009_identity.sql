-- ID checks with Stripe Identity (decided 28th October 2026 for the pilot).
--
-- The app asks the identity function to start a check; Stripe's sheet on the
-- phone takes the photo ID and a live selfie. The result comes back to the
-- identity function (the app asks) and to identity-webhook (Stripe tells us).
-- Only the server functions touch these tables (service role).
--
-- identity_checks: one row per Stripe session, so a result can be matched to a person.
-- identity_documents: a keyed fingerprint of each ID document that has verified
-- someone, so the same document can't verify a second account. The document
-- number itself is never stored.

create table public.identity_checks (
  session_id text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'requires_input',   -- Stripe's status: requires_input, processing, verified, canceled
  outcome    text,                                       -- ours: verified, duplicate, too_young, or Stripe's reason for a failure
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.identity_checks (user_id, created_at desc);

create table public.identity_documents (
  doc_hash    text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now()
);

alter table public.identity_checks enable row level security;
alter table public.identity_documents enable row level security;
revoke all on public.identity_checks, public.identity_documents from anon, authenticated;
grant all on public.identity_checks, public.identity_documents to service_role;
