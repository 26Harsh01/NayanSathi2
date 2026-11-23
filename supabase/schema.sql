-- NayanSathi — GazeConnect PostgreSQL / Supabase Schema with Row Level Security (RLS)
-- Enforce strict patient ownership and explicit caregiver consent.

create extension if not exists "pgcrypto";

-- 1. Users profile mirror (linked to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('patient', 'caregiver')) default 'patient',
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- 2. Patient profiles
create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  preferred_name text not null default '',
  notes text not null default '',
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2b. Emergency contacts (normalized patient-scoped table)
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  relationship text not null default '',
  phone text not null check (char_length(trim(phone)) between 7 and 20),
  email text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists emergency_contacts_one_primary_per_patient
  on public.emergency_contacts (patient_id)
  where is_primary = true;

-- 3. Caregiver relationships (requires explicit patient consent!)
create table if not exists public.caregiver_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  caregiver_id uuid not null references public.users(id) on delete cascade,
  consent_granted boolean not null default false,
  can_edit_phrases boolean not null default false,
  can_view_history boolean not null default false,
  granted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, caregiver_id)
);

-- 4. Phrase categories
create table if not exists public.phrase_categories (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  name_en text not null,
  name_hi text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Custom phrases
create table if not exists public.custom_phrases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.phrase_categories(id) on delete set null,
  text_en text not null,
  text_hi text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. User preferences (eye-tracking, interface, speech, privacy)
create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  language text not null check (language in ('en', 'hi')) default 'en',
  dwell_duration_ms int not null default 1000 check (dwell_duration_ms between 500 and 3000),
  button_size text not null check (button_size in ('standard', 'large', 'xlarge')) default 'large',
  high_contrast boolean not null default false,
  theme text not null check (theme in ('light', 'dark')) default 'light',
  speech_rate numeric(3, 2) not null default 0.95,
  history_consent_enabled boolean not null default false, -- OFF by default
  eye_tracking_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 7. Calibration profiles (stores Ridge Regression weights only; never video)
create table if not exists public.calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  quality_tier text not null check (quality_tier in ('strong', 'moderate', 'needs-recalibration')),
  mean_validation_norm_error numeric(6, 4) not null,
  model_weights jsonb not null,
  point_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Communication history (opt-in only; protected by explicit consent)
create table if not exists public.communication_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  message_text text not null,
  language text not null check (language in ('en', 'hi')),
  spoken boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security across all tables
alter table public.users enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.caregiver_relationships enable row level security;
alter table public.phrase_categories enable row level security;
alter table public.custom_phrases enable row level security;
alter table public.user_preferences enable row level security;
alter table public.calibration_profiles enable row level security;
alter table public.communication_history enable row level security;

-- Helper function: checks whether caller is an explicitly consented caregiver for patient_id
create or replace function public.is_consented_caregiver(target_patient uuid, require_edit boolean default false, require_history boolean default false)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.caregiver_relationships cr
    where cr.patient_id = target_patient
      and cr.caregiver_id = auth.uid()
      and cr.consent_granted = true
      and (not require_edit or cr.can_edit_phrases = true)
      and (not require_history or cr.can_view_history = true)
  );
$$;

-- RLS Policies
create policy "Users view own record" on public.users
  for select using (id = auth.uid());

create policy "Users update own record" on public.users
  for update using (id = auth.uid());

create policy "Patients manage own profile" on public.patient_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Consented caregivers view patient profile" on public.patient_profiles
  for select using (public.is_consented_caregiver(user_id));

create policy "Patients manage own emergency contacts" on public.emergency_contacts
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy "Authorized caregivers manage patient emergency contacts" on public.emergency_contacts
  for all using (
    public.is_consented_caregiver(patient_id, true, false)
  )
  with check (
    public.is_consented_caregiver(patient_id, true, false)
  );

create policy "Patients control caregiver consent" on public.caregiver_relationships
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy "Caregivers view their active links" on public.caregiver_relationships
  for select using (caregiver_id = auth.uid());

create policy "Patients and authorized caregivers manage categories" on public.phrase_categories
  for all using (
    patient_id = auth.uid() or public.is_consented_caregiver(patient_id, true, false)
  )
  with check (
    patient_id = auth.uid() or public.is_consented_caregiver(patient_id, true, false)
  );

create policy "Patients and authorized caregivers manage phrases" on public.custom_phrases
  for all using (
    patient_id = auth.uid() or public.is_consented_caregiver(patient_id, true, false)
  )
  with check (
    patient_id = auth.uid() or public.is_consented_caregiver(patient_id, true, false)
  );

create policy "Users manage own preferences" on public.user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Patients manage own calibration" on public.calibration_profiles
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy "Patients manage own communication history" on public.communication_history
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy "Consented caregivers view communication history" on public.communication_history
  for select using (public.is_consented_caregiver(patient_id, false, true));

