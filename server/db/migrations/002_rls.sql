-- Row-level security: a chef can only ever touch their own rows.
-- The API connects as `chef_app` for ALL user-owned reads/writes and sets
-- `app.chef_id` inside the transaction, so even a bug in a WHERE clause cannot
-- leak another chef's recipe book.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'chef_app') then
    create role chef_app nologin;
  end if;
end
$$;

grant usage on schema public to chef_app;
grant select on roles to chef_app;
grant select on catalogue_recipes, catalogue_aliases, catalogue_ingredients, catalogue_steps, catalogue_media to chef_app;
grant select, insert, update, delete on chefs, chef_sessions to chef_app;
grant select, insert, update, delete on chef_recipes, chef_recipe_ingredients, chef_recipe_steps to chef_app;
grant select, insert, update, delete on onboarding_sessions, shopping_lists, shopping_list_items to chef_app;
grant select, insert, update, delete on import_jobs to chef_app;

alter table chefs                  enable row level security;
alter table chefs                  force  row level security;
alter table chef_recipes           enable row level security;
alter table chef_recipes           force  row level security;
alter table chef_recipe_ingredients enable row level security;
alter table chef_recipe_ingredients force  row level security;
alter table chef_recipe_steps      enable row level security;
alter table chef_recipe_steps      force  row level security;
alter table onboarding_sessions    enable row level security;
alter table onboarding_sessions    force  row level security;
alter table shopping_lists         enable row level security;
alter table shopping_lists         force  row level security;
alter table shopping_list_items    enable row level security;
alter table shopping_list_items    force  row level security;
alter table import_jobs            enable row level security;
alter table import_jobs            force  row level security;
alter table chef_sessions          enable row level security;
alter table chef_sessions          force  row level security;

create or replace function app_chef_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.chef_id', true), '')::uuid
$$;

-- chefs: a chef may read/update only their own row.
drop policy if exists chefs_self on chefs;
create policy chefs_self on chefs
  using (id = app_chef_id())
  with check (id = app_chef_id());

drop policy if exists chef_sessions_self on chef_sessions;
create policy chef_sessions_self on chef_sessions
  using (chef_id = app_chef_id())
  with check (chef_id = app_chef_id());

drop policy if exists chef_recipes_owner on chef_recipes;
create policy chef_recipes_owner on chef_recipes
  using (chef_id = app_chef_id())
  with check (chef_id = app_chef_id());

drop policy if exists chef_recipe_ingredients_owner on chef_recipe_ingredients;
create policy chef_recipe_ingredients_owner on chef_recipe_ingredients
  using (exists (select 1 from chef_recipes r where r.id = chef_recipe_id and r.chef_id = app_chef_id()))
  with check (exists (select 1 from chef_recipes r where r.id = chef_recipe_id and r.chef_id = app_chef_id()));

drop policy if exists chef_recipe_steps_owner on chef_recipe_steps;
create policy chef_recipe_steps_owner on chef_recipe_steps
  using (exists (select 1 from chef_recipes r where r.id = chef_recipe_id and r.chef_id = app_chef_id()))
  with check (exists (select 1 from chef_recipes r where r.id = chef_recipe_id and r.chef_id = app_chef_id()));

drop policy if exists onboarding_sessions_owner on onboarding_sessions;
create policy onboarding_sessions_owner on onboarding_sessions
  using (chef_id = app_chef_id())
  with check (chef_id = app_chef_id());

drop policy if exists shopping_lists_owner on shopping_lists;
create policy shopping_lists_owner on shopping_lists
  using (chef_id = app_chef_id())
  with check (chef_id = app_chef_id());

drop policy if exists shopping_list_items_owner on shopping_list_items;
create policy shopping_list_items_owner on shopping_list_items
  using (exists (
    select 1 from shopping_lists l
    where l.id = shopping_list_id and l.chef_id = app_chef_id()
  ))
  with check (exists (
    select 1 from shopping_lists l
    where l.id = shopping_list_id and l.chef_id = app_chef_id()
  ));

drop policy if exists import_jobs_owner on import_jobs;
create policy import_jobs_owner on import_jobs
  using (chef_id = app_chef_id())
  with check (chef_id = app_chef_id());
