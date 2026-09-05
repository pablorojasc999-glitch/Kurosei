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

-- ---------------------------------------------------------------------
-- Row Level Security — every user only ever sees/writes their own rows
-- ---------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'training_muscle_groups',
    'training_exercises',
    'training_exercise_muscle_contributions',
    'training_macrocycles',
    'training_mesocycles',
    'training_weeks',
    'training_days',
    'training_planned_exercises',
    'training_planned_sets',
    'training_sessions',
    'training_session_exercises',
    'training_executed_sets',
    'training_cardio_sessions',
    'training_user_profile',
    'training_daily_logs',
    'finance_accounts',
    'finance_categories',
    'finance_transactions',
    'nutrition_foods',
    'nutrition_meal_sections',
    'nutrition_entries',
    'nutrition_water_entries',
    'nutrition_meal_templates',
    'nutrition_meal_template_entries'
  ]
  loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists "owner_all" on %I', tbl);
    execute format(
      'create policy "owner_all" on %I for all using ("userId" = auth.uid()) with check ("userId" = auth.uid())',
      tbl
    );
  end loop;
end $$;
