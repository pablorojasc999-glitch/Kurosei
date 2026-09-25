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
  "countsAsEffective" boolean,
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
  "dropSet" boolean,
  "restPause" boolean,
  "countsAsEffective" boolean,
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
  "dropSet" boolean,
  "restPause" boolean,
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
  "durationMinutes" double precision not null,
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
-- Legado: el presupuesto vive ahora en "finance_category_budgets", con fecha de
-- vigencia. La columna se deja porque tiene datos de antes y no estorba.
alter table "finance_categories" add column if not exists "monthlyBudget" double precision;
alter table "finance_transactions" add column if not exists "financialMonth" text;
-- Antes el mes lo decidía la fecha; ese es el valor que deja las cuentas igual.
update "finance_transactions"
  set "financialMonth" = substring("date" from 1 for 7)
  where "financialMonth" is null;
alter table "nutrition_entries" add column if not exists "checked" boolean not null default true;

create table if not exists "finance_category_budgets" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "categoryId" uuid not null,
  -- `YYYY-MM` desde el que rige este monto. El presupuesto de un mes es el de
  -- la vigencia más reciente que no sea posterior a ese mes, así que cambiarlo
  -- hacia adelante no reescribe lo que regía antes.
  "effectiveFrom" text not null,
  "amount" double precision not null,
  "createdAt" timestamptz not null,
  "updatedAt" timestamptz not null,
  "deletedAt" timestamptz
);

create table if not exists "finance_transactions" (
  "id" uuid primary key,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "accountId" uuid not null,
  "categoryId" uuid not null,
  "type" text not null,
  "amount" double precision not null,
  "date" text not null,
  -- `YYYY-MM` al que se imputa, que no tiene por qué ser el mes de `date`.
  -- Los totales y los presupuestos se cuentan por acá.
  "financialMonth" text,
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
create index if not exists "finance_category_budgets_sync_idx" on "finance_category_budgets" ("userId", "updatedAt");
create index if not exists "finance_transactions_sync_idx" on "finance_transactions" ("userId", "updatedAt");
create index if not exists "nutrition_foods_sync_idx" on "nutrition_foods" ("userId", "updatedAt");
create index if not exists "nutrition_meal_sections_sync_idx" on "nutrition_meal_sections" ("userId", "updatedAt");
create index if not exists "nutrition_entries_sync_idx" on "nutrition_entries" ("userId", "updatedAt");
create index if not exists "nutrition_water_entries_sync_idx" on "nutrition_water_entries" ("userId", "updatedAt");
create index if not exists "nutrition_meal_templates_sync_idx" on "nutrition_meal_templates" ("userId", "updatedAt");
create index if not exists "nutrition_meal_template_entries_sync_idx" on "nutrition_meal_template_entries" ("userId", "updatedAt");
create index if not exists "nutrition_goal_plans_sync_idx" on "nutrition_goal_plans" ("userId", "updatedAt");
create index if not exists "grocery_items_sync_idx" on "grocery_items" ("userId", "updatedAt");

-- ---------------------------------------------------------------------
-- Row Level Security — cada persona sólo ve y escribe sus propias filas.
--
-- Van como sentencias sueltas y no dentro de un bloque anónimo con comillas
-- de dólar: ese bloque es válido en Postgres, pero cualquier cliente que
-- parta el script por `;` lo corta por dentro y falla con "unterminated
-- dollar-quoted string". Así el archivo se puede pegar entero o por partes.
-- ---------------------------------------------------------------------

alter table "finance_accounts" enable row level security;
drop policy if exists "owner_all" on "finance_accounts";
create policy "owner_all" on "finance_accounts" for all
  using ("userId" = auth.uid()) with check ("userId" = auth.uid());

alter table "finance_category_budgets" enable row level security;
drop policy if exists "owner_all" on "finance_category_budgets";
create policy "owner_all" on "finance_category_budgets" for all
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

-- ---------------------------------------------------------------------
-- Sync: server-side arrival stamp
--
-- `updatedAt` lo pone el dispositivo que escribe la fila; `syncedAt` lo pone
-- el servidor cuando la recibe. Bajar por `updatedAt` se saltaba para siempre
-- una fila anotada en el teléfono y subida más tarde, si otro dispositivo
-- había sincronizado entremedio. El filtro de bajada va por `syncedAt`.
-- ---------------------------------------------------------------------

create or replace function public.set_synced_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new."syncedAt" = now();
  return new;
end;
$$;


alter table "training_muscle_groups" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_muscle_groups_synced_at" on "training_muscle_groups";
create trigger "training_muscle_groups_synced_at" before insert or update on "training_muscle_groups"
  for each row execute function public.set_synced_at();
create index if not exists "training_muscle_groups_pull_idx" on "training_muscle_groups" ("userId", "syncedAt");

alter table "training_exercises" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_exercises_synced_at" on "training_exercises";
create trigger "training_exercises_synced_at" before insert or update on "training_exercises"
  for each row execute function public.set_synced_at();
create index if not exists "training_exercises_pull_idx" on "training_exercises" ("userId", "syncedAt");

alter table "training_exercise_muscle_contributions" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_exercise_muscle_contributions_synced_at" on "training_exercise_muscle_contributions";
create trigger "training_exercise_muscle_contributions_synced_at" before insert or update on "training_exercise_muscle_contributions"
  for each row execute function public.set_synced_at();
create index if not exists "training_exercise_muscle_contributions_pull_idx" on "training_exercise_muscle_contributions" ("userId", "syncedAt");

alter table "training_macrocycles" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_macrocycles_synced_at" on "training_macrocycles";
create trigger "training_macrocycles_synced_at" before insert or update on "training_macrocycles"
  for each row execute function public.set_synced_at();
create index if not exists "training_macrocycles_pull_idx" on "training_macrocycles" ("userId", "syncedAt");

alter table "training_mesocycles" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_mesocycles_synced_at" on "training_mesocycles";
create trigger "training_mesocycles_synced_at" before insert or update on "training_mesocycles"
  for each row execute function public.set_synced_at();
create index if not exists "training_mesocycles_pull_idx" on "training_mesocycles" ("userId", "syncedAt");

alter table "training_weeks" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_weeks_synced_at" on "training_weeks";
create trigger "training_weeks_synced_at" before insert or update on "training_weeks"
  for each row execute function public.set_synced_at();
create index if not exists "training_weeks_pull_idx" on "training_weeks" ("userId", "syncedAt");

alter table "training_days" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_days_synced_at" on "training_days";
create trigger "training_days_synced_at" before insert or update on "training_days"
  for each row execute function public.set_synced_at();
create index if not exists "training_days_pull_idx" on "training_days" ("userId", "syncedAt");

alter table "training_planned_exercises" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_planned_exercises_synced_at" on "training_planned_exercises";
create trigger "training_planned_exercises_synced_at" before insert or update on "training_planned_exercises"
  for each row execute function public.set_synced_at();
create index if not exists "training_planned_exercises_pull_idx" on "training_planned_exercises" ("userId", "syncedAt");

alter table "training_planned_sets" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_planned_sets_synced_at" on "training_planned_sets";
create trigger "training_planned_sets_synced_at" before insert or update on "training_planned_sets"
  for each row execute function public.set_synced_at();
create index if not exists "training_planned_sets_pull_idx" on "training_planned_sets" ("userId", "syncedAt");

alter table "training_sessions" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_sessions_synced_at" on "training_sessions";
create trigger "training_sessions_synced_at" before insert or update on "training_sessions"
  for each row execute function public.set_synced_at();
create index if not exists "training_sessions_pull_idx" on "training_sessions" ("userId", "syncedAt");

alter table "training_session_exercises" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_session_exercises_synced_at" on "training_session_exercises";
create trigger "training_session_exercises_synced_at" before insert or update on "training_session_exercises"
  for each row execute function public.set_synced_at();
create index if not exists "training_session_exercises_pull_idx" on "training_session_exercises" ("userId", "syncedAt");

alter table "training_executed_sets" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_executed_sets_synced_at" on "training_executed_sets";
create trigger "training_executed_sets_synced_at" before insert or update on "training_executed_sets"
  for each row execute function public.set_synced_at();
create index if not exists "training_executed_sets_pull_idx" on "training_executed_sets" ("userId", "syncedAt");

alter table "training_cardio_sessions" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_cardio_sessions_synced_at" on "training_cardio_sessions";
create trigger "training_cardio_sessions_synced_at" before insert or update on "training_cardio_sessions"
  for each row execute function public.set_synced_at();
create index if not exists "training_cardio_sessions_pull_idx" on "training_cardio_sessions" ("userId", "syncedAt");

alter table "training_user_profile" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_user_profile_synced_at" on "training_user_profile";
create trigger "training_user_profile_synced_at" before insert or update on "training_user_profile"
  for each row execute function public.set_synced_at();
create index if not exists "training_user_profile_pull_idx" on "training_user_profile" ("userId", "syncedAt");

alter table "training_daily_logs" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "training_daily_logs_synced_at" on "training_daily_logs";
create trigger "training_daily_logs_synced_at" before insert or update on "training_daily_logs"
  for each row execute function public.set_synced_at();
create index if not exists "training_daily_logs_pull_idx" on "training_daily_logs" ("userId", "syncedAt");

alter table "finance_accounts" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "finance_accounts_synced_at" on "finance_accounts";
create trigger "finance_accounts_synced_at" before insert or update on "finance_accounts"
  for each row execute function public.set_synced_at();
create index if not exists "finance_accounts_pull_idx" on "finance_accounts" ("userId", "syncedAt");

alter table "finance_categories" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "finance_categories_synced_at" on "finance_categories";
create trigger "finance_categories_synced_at" before insert or update on "finance_categories"
  for each row execute function public.set_synced_at();
create index if not exists "finance_categories_pull_idx" on "finance_categories" ("userId", "syncedAt");

alter table "finance_category_budgets" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "finance_category_budgets_synced_at" on "finance_category_budgets";
create trigger "finance_category_budgets_synced_at" before insert or update on "finance_category_budgets"
  for each row execute function public.set_synced_at();
create index if not exists "finance_category_budgets_pull_idx" on "finance_category_budgets" ("userId", "syncedAt");

alter table "finance_transactions" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "finance_transactions_synced_at" on "finance_transactions";
create trigger "finance_transactions_synced_at" before insert or update on "finance_transactions"
  for each row execute function public.set_synced_at();
create index if not exists "finance_transactions_pull_idx" on "finance_transactions" ("userId", "syncedAt");

alter table "nutrition_foods" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_foods_synced_at" on "nutrition_foods";
create trigger "nutrition_foods_synced_at" before insert or update on "nutrition_foods"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_foods_pull_idx" on "nutrition_foods" ("userId", "syncedAt");

alter table "nutrition_meal_sections" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_meal_sections_synced_at" on "nutrition_meal_sections";
create trigger "nutrition_meal_sections_synced_at" before insert or update on "nutrition_meal_sections"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_meal_sections_pull_idx" on "nutrition_meal_sections" ("userId", "syncedAt");

alter table "nutrition_entries" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_entries_synced_at" on "nutrition_entries";
create trigger "nutrition_entries_synced_at" before insert or update on "nutrition_entries"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_entries_pull_idx" on "nutrition_entries" ("userId", "syncedAt");

alter table "nutrition_water_entries" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_water_entries_synced_at" on "nutrition_water_entries";
create trigger "nutrition_water_entries_synced_at" before insert or update on "nutrition_water_entries"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_water_entries_pull_idx" on "nutrition_water_entries" ("userId", "syncedAt");

alter table "nutrition_meal_templates" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_meal_templates_synced_at" on "nutrition_meal_templates";
create trigger "nutrition_meal_templates_synced_at" before insert or update on "nutrition_meal_templates"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_meal_templates_pull_idx" on "nutrition_meal_templates" ("userId", "syncedAt");

alter table "nutrition_meal_template_entries" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_meal_template_entries_synced_at" on "nutrition_meal_template_entries";
create trigger "nutrition_meal_template_entries_synced_at" before insert or update on "nutrition_meal_template_entries"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_meal_template_entries_pull_idx" on "nutrition_meal_template_entries" ("userId", "syncedAt");

alter table "nutrition_goal_plans" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "nutrition_goal_plans_synced_at" on "nutrition_goal_plans";
create trigger "nutrition_goal_plans_synced_at" before insert or update on "nutrition_goal_plans"
  for each row execute function public.set_synced_at();
create index if not exists "nutrition_goal_plans_pull_idx" on "nutrition_goal_plans" ("userId", "syncedAt");

alter table "grocery_items" add column if not exists "syncedAt" timestamptz not null default now();
drop trigger if exists "grocery_items_synced_at" on "grocery_items";
create trigger "grocery_items_synced_at" before insert or update on "grocery_items"
  for each row execute function public.set_synced_at();
create index if not exists "grocery_items_pull_idx" on "grocery_items" ("userId", "syncedAt");
