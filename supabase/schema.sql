-- Kurosei — Supabase schema for multi-device sync
--
-- How to apply: open your Supabase project → SQL Editor → New query,
-- paste this whole file, and click "Run". Safe to re-run (uses
-- `if not exists` / `drop policy if exists` throughout).
--
-- Design notes:
--   * Column names intentionally match the app's TypeScript field names
--     exactly (camelCase, quoted) instead of the usual snake_case Postgres
--     convention — the sync layer upserts/reads plain JS objects straight
--     from Dexie with zero field-name translation.
--   * Every table mirrors one Dexie store 1:1 (see
--     src/modules/training/db/schema.ts) and carries the same
--     id / createdAt / updatedAt / deletedAt (soft-delete) fields already
--     used locally, plus a "userId" column added only for row-level
--     security — it never exists in the local Dexie records.
--   * No foreign-key constraints between training_* tables on purpose:
--     Dexie is the source of truth for referential integrity, sync pushes
--     tables independently, and soft-deletes never actually remove rows —
--     FK constraints here would only add sync-ordering risk for no benefit.
--   * Row Level Security scopes every row to its owner (auth.uid()), so
--     each user only ever sees/writes their own data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Exercise library
-- ---------------------------------------------------------------------

create table if not exists "training_muscle_groups" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_exercises" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "type" text not null,
  "category" text,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_exercise_muscle_contributions" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "exerciseId" uuid not null,
  "muscleGroupId" uuid not null,
  "factor" double precision not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Periodization (planned side)
-- ---------------------------------------------------------------------

create table if not exists "training_macrocycles" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "goal" text not null,
  "startDate" timestamptz not null,
  "endDate" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_mesocycles" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "macrocycleId" uuid not null,
  "name" text not null,
  "phaseType" text not null,
  "order" integer not null,
  "startDate" timestamptz not null,
  "endDate" timestamptz not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_weeks" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "mesocycleId" uuid not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_days" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "weekId" uuid,
  "date" timestamptz not null,
  "label" text not null,
  "planClosedAt" timestamptz,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_planned_exercises" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "dayId" uuid not null,
  "exerciseId" uuid not null,
  "order" integer not null,
  "notes" text not null,
  "closedAt" timestamptz,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_planned_sets" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "plannedExerciseId" uuid not null,
  "setNumber" integer not null,
  "targetWeightKg" double precision,
  "targetReps" integer not null,
  "targetRpe" double precision,
  "restSecondsTarget" integer,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Session execution
-- ---------------------------------------------------------------------

create table if not exists "training_sessions" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "dayId" uuid not null,
  "startedAt" timestamptz not null,
  "endedAt" timestamptz,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_session_exercises" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "sessionId" uuid not null,
  "exerciseId" uuid not null,
  "order" integer not null,
  "notes" text not null,
  "closedAt" timestamptz,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_executed_sets" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "sessionExerciseId" uuid not null,
  "setNumber" integer not null,
  "weightKg" double precision,
  "reps" integer not null,
  "rpe" double precision,
  "eva" double precision,
  "notes" text not null,
  "performedAt" timestamptz not null,
  "restTakenSeconds" integer,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Cardio
-- ---------------------------------------------------------------------

create table if not exists "training_cardio_sessions" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "dayId" uuid not null,
  "exerciseId" uuid not null,
  "startedAt" timestamptz not null,
  "durationMinutes" integer not null,
  "distanceKm" double precision,
  "caloriesBurned" double precision,
  "notes" text not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Bitácora (daily wellness/nutrition log) and profile
-- ---------------------------------------------------------------------

create table if not exists "training_user_profile" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "heightCm" double precision,
  "birthDate" text,
  "sex" text,
  "bodyFatPercent" double precision,
  "muscleMassPercent" double precision,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "training_daily_logs" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "date" text not null,
  "bodyWeightKg" double precision,
  "calories" double precision,
  "carbsG" double precision,
  "proteinG" double precision,
  "fatG" double precision,
  "sleepHours" double precision,
  "creatineTaken" boolean not null,
  "omega3Taken" boolean not null,
  "vitaminDTaken" boolean not null,
  "waterLiters" double precision,
  "stress" double precision,
  "stimulants" double precision,
  "fatigue" double precision,
  "steps" double precision,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Finanzas (cuentas, deudas, categorías, transacciones)
-- ---------------------------------------------------------------------

create table if not exists "finance_accounts" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "emoji" text not null,
  "kind" text not null,
  "debtDirection" text,
  "debtAmount" double precision,
  "categoryId" uuid,
  "revolving" boolean not null default false,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "finance_categories" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "emoji" text not null,
  "type" text not null,
  "monthlyBudget" double precision,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- Columns added after these tables first shipped — `create table if not
-- exists` above won't retroactively add them to an already-provisioned
-- database, so re-running this file needs these too.
alter table "finance_accounts" add column if not exists "categoryId" uuid;
alter table "finance_accounts" add column if not exists "revolving" boolean not null default false;
alter table "finance_categories" add column if not exists "monthlyBudget" double precision;
alter table "nutrition_entries" add column if not exists "checked" boolean not null default true;

create table if not exists "finance_transactions" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "accountId" uuid not null,
  "categoryId" uuid not null,
  "type" text not null,
  "amount" double precision not null,
  "date" text not null,
  "notes" text not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Nutrición — foods (with a full macro + micronutrient panel per serving),
-- reusable meal sections, per-date log entries, water logs, and day-shaped
-- meal templates that can be applied onto any date.
-- ---------------------------------------------------------------------

create table if not exists "nutrition_foods" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "brand" text not null,
  "emoji" text not null,
  "servingAmount" double precision not null,
  "servingUnit" text not null,
  "calories" double precision not null,
  "proteinG" double precision not null,
  "carbsG" double precision not null,
  "fatG" double precision not null,
  "saturatedFatG" double precision,
  "transFatG" double precision,
  "fiberG" double precision,
  "sugarG" double precision,
  "sodiumMg" double precision,
  "cholesterolMg" double precision,
  "potassiumMg" double precision,
  "calciumMg" double precision,
  "ironMg" double precision,
  "magnesiumMg" double precision,
  "zincMg" double precision,
  "vitaminAMcg" double precision,
  "vitaminCMg" double precision,
  "vitaminDMcg" double precision,
  "vitaminEMg" double precision,
  "vitaminKMcg" double precision,
  "vitaminB1Mg" double precision,
  "vitaminB2Mg" double precision,
  "vitaminB3Mg" double precision,
  "vitaminB6Mg" double precision,
  "vitaminB9Mcg" double precision,
  "vitaminB12Mcg" double precision,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_meal_sections" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_entries" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "date" text not null,
  "sectionId" uuid not null,
  "order" integer not null,
  "kind" text not null,
  "foodId" uuid,
  "quantity" double precision,
  "manualName" text not null,
  "calories" double precision not null,
  "proteinG" double precision not null,
  "carbsG" double precision not null,
  "fatG" double precision not null,
  "notes" text not null,
  "checked" boolean not null default true,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_water_entries" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "date" text not null,
  "amountMl" double precision not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_meal_templates" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "emoji" text not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_meal_template_entries" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "templateId" uuid not null,
  "sectionId" uuid not null,
  "order" integer not null,
  "kind" text not null,
  "foodId" uuid,
  "quantity" double precision,
  "manualName" text not null,
  "calories" double precision not null,
  "proteinG" double precision not null,
  "carbsG" double precision not null,
  "fatG" double precision not null,
  "notes" text not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "nutrition_goal_plans" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "startDate" date not null,
  -- null = la meta sigue vigente, sin fecha de término
  "endDate" date,
  "targetCalories" double precision not null,
  "targetProteinG" double precision not null,
  "targetCarbsG" double precision not null,
  "targetFatG" double precision not null,
  "targetWaterMl" double precision not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Atlas Personal — perfiles y su árbol de nodos
-- ---------------------------------------------------------------------

create table if not exists "atlas_profiles" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "atlas_nodes" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "profileId" uuid not null,
  -- null marca la raíz del perfil; hay exactamente una por perfil
  "parentId" uuid,
  "name" text not null,
  "level" text not null,
  "note" text not null,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Supermercado — qué se compra y cada cuánto se repone
-- ---------------------------------------------------------------------

create table if not exists "grocery_items" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "name" text not null,
  -- 'quincenal' | 'mensual' | 'esporadico'
  "cadence" text not null,
  "quantity" text not null,
  "note" text not null,
  "checked" boolean not null default false,
  -- Fecha de la última compra cerrada con este artículo marcado; null si nunca
  "lastBoughtAt" date,
  "order" integer not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

-- ---------------------------------------------------------------------
-- Indexes — every sync pull filters by (userId, updatedAt)
-- ---------------------------------------------------------------------

create index if not exists "training_muscle_groups_sync_idx" on "training_muscle_groups" ("userId", "updatedAt");
create index if not exists "training_exercises_sync_idx" on "training_exercises" ("userId", "updatedAt");
create index if not exists "training_exercise_muscle_contributions_sync_idx" on "training_exercise_muscle_contributions" ("userId", "updatedAt");
create index if not exists "training_macrocycles_sync_idx" on "training_macrocycles" ("userId", "updatedAt");
create index if not exists "training_mesocycles_sync_idx" on "training_mesocycles" ("userId", "updatedAt");
create index if not exists "training_weeks_sync_idx" on "training_weeks" ("userId", "updatedAt");
create index if not exists "training_days_sync_idx" on "training_days" ("userId", "updatedAt");
create index if not exists "training_planned_exercises_sync_idx" on "training_planned_exercises" ("userId", "updatedAt");
create index if not exists "training_planned_sets_sync_idx" on "training_planned_sets" ("userId", "updatedAt");
create index if not exists "training_sessions_sync_idx" on "training_sessions" ("userId", "updatedAt");
create index if not exists "training_session_exercises_sync_idx" on "training_session_exercises" ("userId", "updatedAt");
create index if not exists "training_executed_sets_sync_idx" on "training_executed_sets" ("userId", "updatedAt");
create index if not exists "training_cardio_sessions_sync_idx" on "training_cardio_sessions" ("userId", "updatedAt");
create index if not exists "training_user_profile_sync_idx" on "training_user_profile" ("userId", "updatedAt");
create index if not exists "training_daily_logs_sync_idx" on "training_daily_logs" ("userId", "updatedAt");
create index if not exists "finance_accounts_sync_idx" on "finance_accounts" ("userId", "updatedAt");
create index if not exists "finance_categories_sync_idx" on "finance_categories" ("userId", "updatedAt");
create index if not exists "finance_transactions_sync_idx" on "finance_transactions" ("userId", "updatedAt");
create index if not exists "nutrition_foods_sync_idx" on "nutrition_foods" ("userId", "updatedAt");
create index if not exists "nutrition_meal_sections_sync_idx" on "nutrition_meal_sections" ("userId", "updatedAt");
create index if not exists "nutrition_entries_sync_idx" on "nutrition_entries" ("userId", "updatedAt");
create index if not exists "nutrition_water_entries_sync_idx" on "nutrition_water_entries" ("userId", "updatedAt");
create index if not exists "nutrition_meal_templates_sync_idx" on "nutrition_meal_templates" ("userId", "updatedAt");
create index if not exists "nutrition_meal_template_entries_sync_idx" on "nutrition_meal_template_entries" ("userId", "updatedAt");
create index if not exists "nutrition_goal_plans_sync_idx" on "nutrition_goal_plans" ("userId", "updatedAt");
create index if not exists "atlas_profiles_sync_idx" on "atlas_profiles" ("userId", "updatedAt");
create index if not exists "atlas_nodes_sync_idx" on "atlas_nodes" ("userId", "updatedAt");
create index if not exists "grocery_items_sync_idx" on "grocery_items" ("userId", "updatedAt");

-- ---------------------------------------------------------------------
-- Row Level Security — cada persona sólo ve y escribe sus propias filas.
--
-- Van como sentencias sueltas y no dentro de un bloque anónimo con comillas
-- de dólar: ese bloque es válido en Postgres, pero cualquier cliente que
-- parta el script por `;` lo corta por dentro y falla con "unterminated
-- dollar-quoted string". Así el archivo se puede pegar entero o por partes.
-- ---------------------------------------------------------------------

alter table "atlas_nodes" enable row level security;
drop policy if exists "owner_all" on "atlas_nodes";
create policy "owner_all" on "atlas_nodes" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "atlas_profiles" enable row level security;
drop policy if exists "owner_all" on "atlas_profiles";
create policy "owner_all" on "atlas_profiles" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "finance_accounts" enable row level security;
drop policy if exists "owner_all" on "finance_accounts";
create policy "owner_all" on "finance_accounts" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "finance_categories" enable row level security;
drop policy if exists "owner_all" on "finance_categories";
create policy "owner_all" on "finance_categories" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "finance_transactions" enable row level security;
drop policy if exists "owner_all" on "finance_transactions";
create policy "owner_all" on "finance_transactions" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "grocery_items" enable row level security;
drop policy if exists "owner_all" on "grocery_items";
create policy "owner_all" on "grocery_items" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_entries" enable row level security;
drop policy if exists "owner_all" on "nutrition_entries";
create policy "owner_all" on "nutrition_entries" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_foods" enable row level security;
drop policy if exists "owner_all" on "nutrition_foods";
create policy "owner_all" on "nutrition_foods" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_goal_plans" enable row level security;
drop policy if exists "owner_all" on "nutrition_goal_plans";
create policy "owner_all" on "nutrition_goal_plans" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_meal_sections" enable row level security;
drop policy if exists "owner_all" on "nutrition_meal_sections";
create policy "owner_all" on "nutrition_meal_sections" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_meal_template_entries" enable row level security;
drop policy if exists "owner_all" on "nutrition_meal_template_entries";
create policy "owner_all" on "nutrition_meal_template_entries" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_meal_templates" enable row level security;
drop policy if exists "owner_all" on "nutrition_meal_templates";
create policy "owner_all" on "nutrition_meal_templates" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "nutrition_water_entries" enable row level security;
drop policy if exists "owner_all" on "nutrition_water_entries";
create policy "owner_all" on "nutrition_water_entries" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_cardio_sessions" enable row level security;
drop policy if exists "owner_all" on "training_cardio_sessions";
create policy "owner_all" on "training_cardio_sessions" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_daily_logs" enable row level security;
drop policy if exists "owner_all" on "training_daily_logs";
create policy "owner_all" on "training_daily_logs" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_days" enable row level security;
drop policy if exists "owner_all" on "training_days";
create policy "owner_all" on "training_days" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_executed_sets" enable row level security;
drop policy if exists "owner_all" on "training_executed_sets";
create policy "owner_all" on "training_executed_sets" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_exercise_muscle_contributions" enable row level security;
drop policy if exists "owner_all" on "training_exercise_muscle_contributions";
create policy "owner_all" on "training_exercise_muscle_contributions" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_exercises" enable row level security;
drop policy if exists "owner_all" on "training_exercises";
create policy "owner_all" on "training_exercises" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_macrocycles" enable row level security;
drop policy if exists "owner_all" on "training_macrocycles";
create policy "owner_all" on "training_macrocycles" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_mesocycles" enable row level security;
drop policy if exists "owner_all" on "training_mesocycles";
create policy "owner_all" on "training_mesocycles" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_muscle_groups" enable row level security;
drop policy if exists "owner_all" on "training_muscle_groups";
create policy "owner_all" on "training_muscle_groups" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_planned_exercises" enable row level security;
drop policy if exists "owner_all" on "training_planned_exercises";
create policy "owner_all" on "training_planned_exercises" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_planned_sets" enable row level security;
drop policy if exists "owner_all" on "training_planned_sets";
create policy "owner_all" on "training_planned_sets" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_session_exercises" enable row level security;
drop policy if exists "owner_all" on "training_session_exercises";
create policy "owner_all" on "training_session_exercises" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_sessions" enable row level security;
drop policy if exists "owner_all" on "training_sessions";
create policy "owner_all" on "training_sessions" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_user_profile" enable row level security;
drop policy if exists "owner_all" on "training_user_profile";
create policy "owner_all" on "training_user_profile" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "training_weeks" enable row level security;
drop policy if exists "owner_all" on "training_weeks";
create policy "owner_all" on "training_weeks" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());
