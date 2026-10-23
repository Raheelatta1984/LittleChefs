-- Chef Universe — core schema
-- Every chef owns a private recipe book. Shared canonical content lives in the
-- catalogue_* tables and carries NO owner identity that is ever returned by the API.

create table if not exists roles (
  id                    text primary key,
  label                 text not null,
  ages                  text not null,
  emoji                 text not null,
  rank                  int  not null,
  description           text not null,
  -- master/teen/adult may contribute reusable recipes to the shared catalogue
  can_publish           boolean not null default false,
  -- little chefs must cook with a grown-up
  requires_grownup      boolean not null default true,
  -- safety cap on how many eaters a junior chef can scale a recipe to
  max_batch_servings    int not null default 12
);

insert into roles (id, label, ages, emoji, rank, description, can_publish, requires_grownup, max_batch_servings) values
  ('junior', 'Junior Chef', '10–14', '👦', 2, 'Learns the basics with a grown-up nearby.', false, true,  8),
  ('teen',   'Teen Chef',   '15–19', '🧑', 3, 'Cooks independently and can share recipes.', true,  false, 16),
  ('adult',  'Adult Chef',  'Adults', '👨‍🍳', 4, 'Runs the family kitchen.', true, false, 40),
  ('master', 'Master Chef', 'Pro',    '👩‍🍳', 5, 'Professional standards and recipe authoring.', true, false, 100)
on conflict (id) do nothing;

create table if not exists chefs (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null,
  role_id       text not null references roles(id),
  avatar        text,
  pin_hash      text,
  points        int not null default 0,
  awarded_recipes text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists chef_sessions (
  token_hash  text primary key,
  chef_id     uuid not null references chefs(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Shared canonical catalogue (public content extracted from public sources).
-- created_by_chef exists ONLY for provenance/abuse review and is never selected
-- by any API response.
-- ---------------------------------------------------------------------------
create table if not exists catalogue_recipes (
  id                uuid primary key default gen_random_uuid(),
  dedupe_key        text not null unique,
  title             text not null,
  normalised_title  text not null,
  cuisine           text,
  description       text,
  difficulty        text,
  base_servings     int not null default 4,
  total_minutes     int,
  hero_image_url    text,
  meal_occasions    text[] not null default '{}',
  source_type       text not null default 'builtin',   -- builtin | web | youtube | manual
  source_url        text,
  source_video_id   text,
  source_channel    text,
  source_author     text,
  content_hash      text,
  created_by_chef   uuid references chefs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists catalogue_recipes_normalised_idx on catalogue_recipes (normalised_title);
create index if not exists catalogue_recipes_source_url_idx on catalogue_recipes (source_url);

create table if not exists catalogue_aliases (
  id            uuid primary key default gen_random_uuid(),
  catalogue_id  uuid not null references catalogue_recipes(id) on delete cascade,
  alias         text not null,
  normalised    text not null
);
create index if not exists catalogue_aliases_normalised_idx on catalogue_aliases (normalised);

create table if not exists catalogue_ingredients (
  id            uuid primary key default gen_random_uuid(),
  catalogue_id  uuid not null references catalogue_recipes(id) on delete cascade,
  position      int not null,
  quantity      numeric,
  unit          text,
  item          text not null,
  prep_note     text,
  group_name    text,
  scalable      boolean not null default true,
  raw_text      text
);
create index if not exists catalogue_ingredients_recipe_idx on catalogue_ingredients (catalogue_id, position);

create table if not exists catalogue_steps (
  id                uuid primary key default gen_random_uuid(),
  catalogue_id      uuid not null references catalogue_recipes(id) on delete cascade,
  position          int not null,
  instruction       text not null,
  duration_seconds  int,
  temperature_c     int,
  image_url         text,
  tip               text
);
create index if not exists catalogue_steps_recipe_idx on catalogue_steps (catalogue_id, position);

create table if not exists catalogue_media (
  id            uuid primary key default gen_random_uuid(),
  catalogue_id  uuid not null references catalogue_recipes(id) on delete cascade,
  kind          text not null,      -- hero | step | video
  url           text not null,
  credit        text,
  position      int not null default 0
);

-- ---------------------------------------------------------------------------
-- Per-chef private recipe book. RLS-scoped to the current chef.
-- ---------------------------------------------------------------------------
create table if not exists chef_recipes (
  id                uuid primary key default gen_random_uuid(),
  chef_id           uuid not null references chefs(id) on delete cascade,
  catalogue_id      uuid references catalogue_recipes(id) on delete set null,
  dedupe_key        text not null,
  title             text not null,
  normalised_title  text not null,
  cuisine           text,
  description       text,
  difficulty        text,
  base_servings     int not null default 4,
  total_minutes     int,
  hero_image_url    text,
  notes             text,
  source_type       text not null default 'manual',
  source_url        text,
  source_video_id   text,
  source_channel    text,
  source_author     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (chef_id, dedupe_key)
);
create index if not exists chef_recipes_chef_idx on chef_recipes (chef_id, updated_at desc);

create table if not exists chef_recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  chef_recipe_id  uuid not null references chef_recipes(id) on delete cascade,
  position        int not null,
  quantity        numeric,
  unit            text,
  item            text not null,
  prep_note       text,
  group_name      text,
  scalable        boolean not null default true,
  raw_text        text
);
create index if not exists chef_recipe_ingredients_recipe_idx on chef_recipe_ingredients (chef_recipe_id, position);

create table if not exists chef_recipe_steps (
  id                uuid primary key default gen_random_uuid(),
  chef_recipe_id    uuid not null references chef_recipes(id) on delete cascade,
  position          int not null,
  instruction       text not null,
  duration_seconds  int,
  temperature_c     int,
  image_url         text,
  tip               text
);
create index if not exists chef_recipe_steps_recipe_idx on chef_recipe_steps (chef_recipe_id, position);

-- ---------------------------------------------------------------------------
-- AI onboarding: interview → portion scaling → shopping list
-- ---------------------------------------------------------------------------
create table if not exists onboarding_sessions (
  id              uuid primary key default gen_random_uuid(),
  chef_id         uuid not null references chefs(id) on delete cascade,
  chef_recipe_id  uuid not null references chef_recipes(id) on delete cascade,
  servings        int not null,
  meal_occasion   text not null,
  dietary         text[] not null default '{}',
  pantry          text[] not null default '{}',
  status          text not null default 'in_progress',  -- in_progress | ready | started | completed
  scale_factor    numeric not null default 1,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table if not exists shopping_lists (
  id                    uuid primary key default gen_random_uuid(),
  chef_id               uuid not null references chefs(id) on delete cascade,
  chef_recipe_id        uuid not null references chef_recipes(id) on delete cascade,
  onboarding_session_id uuid references onboarding_sessions(id) on delete set null,
  servings              int not null,
  meal_occasion         text not null,
  status                text not null default 'draft',  -- draft | shopping | complete
  created_at            timestamptz not null default now()
);

create table if not exists shopping_list_items (
  id              uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists(id) on delete cascade,
  position        int not null default 0,
  aisle           text not null default 'other',
  item            text not null,
  quantity_text   text not null default '',
  checked         boolean not null default false,
  already_at_home boolean not null default false,
  note            text
);
create index if not exists shopping_list_items_list_idx on shopping_list_items (shopping_list_id, position);

-- ---------------------------------------------------------------------------
-- Import jobs (AI onboarding of a recipe from a URL / YouTube / pasted text)
-- ---------------------------------------------------------------------------
create table if not exists import_jobs (
  id             uuid primary key default gen_random_uuid(),
  chef_id        uuid not null references chefs(id) on delete cascade,
  input_type     text not null,       -- url | youtube | text | dish
  input_value    text not null,
  status         text not null default 'pending',  -- pending | running | review | saved | failed
  method         text,                -- jsonld | youtube | llm | heuristic | manual
  confidence     numeric,
  error_message  text,
  warnings       text[] not null default '{}',
  draft          jsonb,
  catalogue_id   uuid references catalogue_recipes(id) on delete set null,
  chef_recipe_id uuid references chef_recipes(id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
