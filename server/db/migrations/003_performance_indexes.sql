-- Hot-path indexes for the load-shedding work (caching, negative caching,
-- Bloom filters, rate limiting).
--
-- The caches remove most repeat reads, but the *first* read of each key still
-- has to be fast — and a few of these lookups were doing full table scans:
--
--   • sign-in matches on lower(display_name) + role_id  (no index at all)
--   • chef-session validation (already covered by the token_hash primary key)
--   • the fuzzy "is this dish already mine?" scan filters in memory, so the
--     prefilters by chef_id / normalised_title are what keep it cheap
--   • import-job lookups always go chef_id + newest-first
--
-- All statements are idempotent (IF NOT EXISTS) because migrations are additive.

-- Sign-in: where lower(display_name) = $1 and role_id = $2
create index if not exists chefs_name_role_idx on chefs (role_id, lower(display_name));

-- Internal-first lookup: exact + fuzzy title matching inside one chef's book.
create index if not exists chef_recipes_normalised_idx on chef_recipes (chef_id, normalised_title);

-- "Which catalogue recipes do I already own?" (cached, but cheap to compute).
create index if not exists chef_recipes_catalogue_idx
  on chef_recipes (chef_id, catalogue_id)
  where catalogue_id is not null;

-- Alias lookups by catalogue id (the normalised alias index covers the search side).
create index if not exists catalogue_aliases_catalogue_idx on catalogue_aliases (catalogue_id);

-- Catalogue list ordering (newest first) and the Bloom-filter rebuild scan.
create index if not exists catalogue_recipes_created_idx on catalogue_recipes (created_at desc);

-- Import history / job polling.
create index if not exists import_jobs_chef_recent_idx on import_jobs (chef_id, created_at desc);

-- Onboarding and shopping lists are always read by chef, newest first.
create index if not exists onboarding_sessions_chef_idx on onboarding_sessions (chef_id, created_at desc);
create index if not exists shopping_lists_chef_idx on shopping_lists (chef_id, created_at desc);
