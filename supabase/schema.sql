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

-- 9. Extended Patient Profile columns & Multi-Role Caregiver RBAC
alter table public.patient_profiles
  add column if not exists full_name text not null default '',
  add column if not exists date_of_birth date,
  add column if not exists occupation text not null default '',
  add column if not exists education text not null default '',
  add column if not exists city text not null default '',
  add column if not exists state text not null default '',
  add column if not exists country text not null default '',
  add column if not exists personal_introduction text not null default '',
  add column if not exists photo_asset_id text not null default '',
  add column if not exists communication_instructions text not null default '';

alter table public.caregiver_relationships
  add column if not exists role text not null check (role in ('primary', 'secondary', 'family', 'support_worker')) default 'primary',
  add column if not exists can_view_medical boolean not null default false,
  add column if not exists can_edit_medical boolean not null default false,
  add column if not exists can_manage_routines boolean not null default false,
  add column if not exists can_manage_requests boolean not null default false,
  add column if not exists can_view_handover boolean not null default false,
  add column if not exists can_write_handover boolean not null default false;

create or replace function public.has_caregiver_permission(target_patient uuid, permission_name text)
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
      and (
        (permission_name = 'edit_phrases' and cr.can_edit_phrases) or
        (permission_name = 'view_history' and cr.can_view_history) or
        (permission_name = 'view_medical' and cr.can_view_medical) or
        (permission_name = 'edit_medical' and cr.can_edit_medical) or
        (permission_name = 'manage_routines' and cr.can_manage_routines) or
        (permission_name = 'manage_requests' and cr.can_manage_requests) or
        (permission_name = 'view_handover' and cr.can_view_handover) or
        (permission_name = 'write_handover' and cr.can_write_handover)
      )
  );
$$;

-- 10. Medical Information (consent & RBAC gated)
create table if not exists public.medical_information (
  patient_id uuid primary key references public.users(id) on delete cascade,
  allergies text not null default '',
  existing_conditions text not null default '',
  medications text not null default '',
  care_instructions text not null default '',
  preferred_doctor text not null default '',
  doctor_contact text not null default '',
  preferred_hospital text not null default '',
  emergency_caregiver_info text not null default '',
  emergency_card_consent boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 11. Help Requests & Room Control Requests
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('choice', 'comfort', 'belonging', 'room', 'medicine', 'appointment', 'routine', 'general')),
  title text not null,
  details text not null default '',
  status text not null check (status in ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'resolved')) default 'pending',
  acknowledged_by uuid references public.users(id) on delete set null,
  caregiver_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Medicine Reminders & Acknowledgments
create table if not exists public.medicine_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  reminder_time text not null,
  frequency text not null check (frequency in ('daily', 'twice_daily', 'weekly', 'as_needed')) default 'daily',
  instructions text not null default '',
  start_date date not null,
  end_date date,
  active boolean not null default true,
  last_acknowledged_date date,
  created_at timestamptz not null default now()
);

-- 13. Wellbeing Journal (private unless shared_with_caregiver = true)
create table if not exists public.wellbeing_journal (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  entry_date date not null,
  mood text not null default '',
  sleep_quality text not null default '',
  appetite text not null default '',
  discomfort text not null default '',
  comfort_level text not null default '',
  general_wellbeing text not null default '',
  notes text not null default '',
  shared_with_caregiver boolean not null default false,
  created_at timestamptz not null default now()
);

-- 14. Appointments, Daily Routines, Personal Choices
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  appt_date date not null,
  appt_time text not null,
  location text not null default '',
  contact_info text not null default '',
  notes text not null default '',
  patient_status text not null default 'scheduled',
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_routines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  section text not null,
  title_en text not null,
  title_hi text not null default '',
  instructions_en text not null default '',
  instructions_hi text not null default '',
  scheduled_time text not null default '',
  status text not null default 'pending',
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_choices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  label_en text not null,
  label_hi text not null default '',
  photo_asset_id text not null default '',
  created_at timestamptz not null default now()
);

-- 15. Caregiver Handover Journal
create table if not exists public.caregiver_handover_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  author_role text not null,
  important_requests text not null default '',
  activities_completed text not null default '',
  personal_preferences text not null default '',
  pending_assistance text not null default '',
  patient_selected_info text not null default '',
  consent_shared boolean not null default true,
  created_at timestamptz not null default now()
);

-- 16. Communication Passport, Important People, Interests, Favourites, Photo Metadata
create table if not exists public.communication_passports (
  patient_id uuid primary key references public.users(id) on delete cascade,
  passport_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.important_people (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  relationship text not null default '',
  category text not null default 'family',
  phone text not null default '',
  email text not null default '',
  photo_asset_id text not null default '',
  favorite_phrases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_interests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  interest_label text not null,
  unique (patient_id, interest_label)
);

create table if not exists public.favourite_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  label text not null,
  photo_asset_id text not null default '',
  notes text not null default ''
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  asset_id text not null,
  purpose text not null,
  created_at timestamptz not null default now()
);

alter table public.medical_information enable row level security;
alter table public.help_requests enable row level security;
alter table public.medicine_reminders enable row level security;
alter table public.wellbeing_journal enable row level security;
alter table public.appointments enable row level security;
alter table public.daily_routines enable row level security;
alter table public.personal_choices enable row level security;
alter table public.caregiver_handover_notes enable row level security;
alter table public.communication_passports enable row level security;
alter table public.important_people enable row level security;
alter table public.patient_interests enable row level security;
alter table public.favourite_items enable row level security;
alter table public.profile_photos enable row level security;

create policy "Patients manage own medical info" on public.medical_information
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers view medical info" on public.medical_information
  for select using (public.has_caregiver_permission(patient_id, 'view_medical'));
create policy "Authorized caregivers update medical info" on public.medical_information
  for update using (public.has_caregiver_permission(patient_id, 'edit_medical'))
  with check (public.has_caregiver_permission(patient_id, 'edit_medical'));

create policy "Patients manage help requests" on public.help_requests
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers manage help requests" on public.help_requests
  for all using (public.has_caregiver_permission(patient_id, 'manage_requests'))
  with check (public.has_caregiver_permission(patient_id, 'manage_requests'));

create policy "Patients manage medicine reminders" on public.medicine_reminders
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers manage medicine reminders" on public.medicine_reminders
  for all using (public.has_caregiver_permission(patient_id, 'manage_routines'))
  with check (public.has_caregiver_permission(patient_id, 'manage_routines'));

create policy "Patients manage wellbeing journal" on public.wellbeing_journal
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Caregivers view shared wellbeing entries" on public.wellbeing_journal
  for select using (shared_with_caregiver = true and public.is_consented_caregiver(patient_id));

create policy "Patients manage appointments" on public.appointments
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers manage appointments" on public.appointments
  for all using (public.has_caregiver_permission(patient_id, 'manage_routines'))
  with check (public.has_caregiver_permission(patient_id, 'manage_routines'));

create policy "Patients manage daily routines" on public.daily_routines
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers manage daily routines" on public.daily_routines
  for all using (public.has_caregiver_permission(patient_id, 'manage_routines'))
  with check (public.has_caregiver_permission(patient_id, 'manage_routines'));

create policy "Patients manage personal choices" on public.personal_choices
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy "Patients control handover notes" on public.caregiver_handover_notes
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Authorized caregivers view handover notes" on public.caregiver_handover_notes
  for select using (consent_shared = true and public.has_caregiver_permission(patient_id, 'view_handover'));
create policy "Authorized caregivers insert handover notes" on public.caregiver_handover_notes
  for insert with check (author_id = auth.uid() and public.has_caregiver_permission(patient_id, 'write_handover'));

create policy "Patients manage communication passport" on public.communication_passports
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Consented caregivers view communication passport" on public.communication_passports
  for select using (public.is_consented_caregiver(patient_id));

create policy "Patients manage important people" on public.important_people
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage interests" on public.patient_interests
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage favourites" on public.favourite_items
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage profile photos" on public.profile_photos
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- 17. Games Module (patient-scoped activity, preferences, and scores)
create table if not exists public.patient_game_states (
  patient_id uuid primary key references public.users(id) on delete cascade,
  save_activity_enabled boolean not null default true,
  preferred_difficulty text not null check (preferred_difficulty in ('easy', 'medium', 'hard')) default 'easy',
  scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  game_id text not null check (game_id in ('tic-tac-toe', 'chess', 'memory-match', 'picture-puzzle', 'connect-four', 'pattern-sequence')),
  outcome text not null check (outcome in ('win', 'loss', 'draw', 'completed')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  moves int not null default 0,
  summary text not null default '',
  played_at timestamptz not null default now()
);

-- 18. Music Module (patient-scoped authorized tracks, playlists, and preferences)
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  artist text not null default '',
  album text not null default '',
  category text not null check (category in (
    'hindi_songs', 'english_songs', 'devotional', 'instrumental',
    'classical', 'relaxing', 'nature_sounds', 'personal_recordings', 'custom_music'
  )),
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  duration_sec numeric(8, 2) not null default 0,
  authorized_confirmed boolean not null check (authorized_confirmed = true),
  is_favourite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.music_playlists (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  track_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.music_preferences (
  patient_id uuid primary key references public.users(id) on delete cascade,
  favourite_genres jsonb not null default '[]'::jsonb,
  favourite_artists jsonb not null default '[]'::jsonb,
  preferred_playlist_ids jsonb not null default '[]'::jsonb,
  favourite_nature_sounds jsonb not null default '[]'::jsonb,
  track_recently_played boolean not null default true,
  default_volume numeric(3, 2) not null default 0.80,
  updated_at timestamptz not null default now()
);

alter table public.patient_game_states enable row level security;
alter table public.game_history enable row level security;
alter table public.music_tracks enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_preferences enable row level security;

create policy "Patients manage own game state" on public.patient_game_states
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage own game history" on public.game_history
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage own music tracks" on public.music_tracks
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage own music playlists" on public.music_playlists
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "Patients manage own music preferences" on public.music_preferences
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
