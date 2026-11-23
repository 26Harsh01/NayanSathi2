import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import type {
  AccountRole,
  ActiveUserSession,
  AppSettings,
  CaregiverAccessPermissions,
  FullUserProfileRecord,
  HowToCommunicateConfig,
  LocalAccountDescriptor,
  PhotoCropConfig,
  UserAccessibilitySettings,
  UserCommunicationPreferences,
  UserFavouriteItem,
  UserInterest,
  UserMedicalInformation,
  UserPrivacyControls,
  UserProfileCore,
} from '../../types';
import {
  clearAllCommunicationHistory,
  clearScopedUserLocalData,
  DEFAULT_USER_ID,
  loadCategories,
  loadCommunicationHistory,
  loadPatientProfile,
  loadPhrases,
  loadSettings,
  savePatientProfile,
  saveSettings,
  setActiveScopePatientId,
} from '../storage/local-storage';
import {
  CONTACTS_CHANGED_EVENT,
  readContactsFromLocalStorage,
} from '../contacts/emergency-contact-service';
import { validateDateOfBirth } from './date-utils';
import {
  createDefaultAccessibilitySettings,
  createDefaultCommunicationPreferences,
  createEmptyFullProfileRecord,
} from './profile-constants';
import {
  deleteAllUserPhotosFromIndexedDb,
  removeUserPhotoAsset,
  saveUserPhotoAsset,
} from './photo-storage';

const ACCOUNTS_KEY = 'nayanSathi.accounts.v1';
const ACTIVE_SESSION_KEY = 'nayanSathi.activeSession.v1';
const PROFILE_RECORD_PREFIX = 'nayanSathi.profileRecord.';

export type CaregiverPermissionScope =
  | 'view_profile'
  | 'edit_profile'
  | 'edit_communication'
  | 'edit_accessibility'
  | 'view_medical'
  | 'edit_medical';

export interface ProfileActionResult<T = FullUserProfileRecord> {
  ok: boolean;
  data?: T;
  error?: string;
}

function safeJsonRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeJsonWrite<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function getProfileRecordKey(userId: string): string {
  return `${PROFILE_RECORD_PREFIX}${userId}.v1`;
}

export function listAccounts(): LocalAccountDescriptor[] {
  const accounts = safeJsonRead<LocalAccountDescriptor[]>(ACCOUNTS_KEY, []);
  if (accounts.length > 0) return accounts;

  const seeded = seedDefaultPatientAccount();
  return [seeded];
}

function saveAccounts(accounts: LocalAccountDescriptor[]): void {
  safeJsonWrite(ACCOUNTS_KEY, accounts);
}

function seedDefaultPatientAccount(): LocalAccountDescriptor {
  const existingProfile = loadPatientProfile(DEFAULT_USER_ID);
  const existingSettings = loadSettings(DEFAULT_USER_ID);
  const fullName = existingProfile.name?.trim() || 'Guest User';
  const preferredName =
    existingProfile.preferredName?.trim() ||
    (fullName === 'Guest User' ? 'Friend' : fullName.split(' ')[0]);

  const record = createEmptyFullProfileRecord(DEFAULT_USER_ID, 'patient', {
    fullName,
    preferredName,
    onboardingCompleted: existingProfile.onboardingCompleted,
    caregiverName: existingProfile.caregiverName,
    notes: existingProfile.notes,
  });

  // Sync existing accessibility & communication settings into the profile record
  record.accessibility = {
    ...record.accessibility,
    dwellDurationMs: existingSettings.eyeTracking.dwellDurationMs,
    cursorSize: existingSettings.eyeTracking.cursorSize,
    minCutoff: existingSettings.eyeTracking.minCutoff,
    beta: existingSettings.eyeTracking.beta,
    dCutoff: existingSettings.eyeTracking.dCutoff,
    confidenceThreshold: existingSettings.eyeTracking.confidenceThreshold,
    blinkSelectionEnabled: existingSettings.eyeTracking.blinkSelectionEnabled,
    longBlinkDurationMs: existingSettings.eyeTracking.longBlinkDurationMs,
    blinkOpenEar: existingSettings.eyeTracking.blinkOpenEar,
    blinkClosedEar: existingSettings.eyeTracking.blinkClosedEar,
    allowSingleEyeBlinkFallback: existingSettings.eyeTracking.allowSingleEyeBlinkFallback,
    targetHysteresisPx: existingSettings.eyeTracking.targetHysteresisPx,
    interactionMode: existingSettings.interface.interactionMode,
    buttonSize: existingSettings.interface.buttonSize,
    buttonSpacing: existingSettings.interface.buttonSpacing,
    fontSize: existingSettings.interface.fontSize,
    highContrast: existingSettings.interface.highContrast,
    theme: existingSettings.interface.theme,
    showDebugOverlay: existingSettings.eyeTracking.showDebugOverlay,
    outlierThreshold: existingSettings.eyeTracking.outlierThreshold,
    trackingLossTimeoutMs: existingSettings.eyeTracking.trackingLossTimeoutMs,
    selectionCooldownMs: existingSettings.eyeTracking.selectionCooldownMs,
  };

  record.communication = {
    ...record.communication,
    preferredLanguage: existingSettings.communication.language,
    preferredVoiceEn: existingSettings.communication.preferredVoiceEn,
    preferredVoiceHi: existingSettings.communication.preferredVoiceHi,
    speechRate: existingSettings.communication.speechRate,
    preferredButtonSize: existingSettings.interface.buttonSize,
  };

  record.privacy.historyConsentEnabled = existingSettings.privacy.historyConsentEnabled;

  safeJsonWrite(getProfileRecordKey(DEFAULT_USER_ID), record);

  const descriptor: LocalAccountDescriptor = {
    userId: DEFAULT_USER_ID,
    role: 'patient',
    displayName: preferredName || fullName,
    createdAt: record.profile.createdAt,
  };
  saveAccounts([descriptor]);
  return descriptor;
}

export function getActiveSession(): ActiveUserSession {
  const accounts = listAccounts();
  const saved = safeJsonRead<ActiveUserSession | null>(ACTIVE_SESSION_KEY, null);

  if (saved && accounts.some((a) => a.userId === saved.currentUserId)) {
    const activePatient =
      accounts.some((a) => a.userId === saved.activePatientId && a.role === 'patient')
        ? saved.activePatientId
        : accounts.find((a) => a.role === 'patient')?.userId || DEFAULT_USER_ID;

    const normalized: ActiveUserSession = {
      ...saved,
      activePatientId: activePatient,
    };
    setActiveScopePatientId(normalized.activePatientId);
    return normalized;
  }

  const firstPatient = accounts.find((a) => a.role === 'patient') ?? accounts[0];
  const initialSession: ActiveUserSession = {
    currentUserId: firstPatient.userId,
    role: firstPatient.role,
    activePatientId: firstPatient.role === 'patient' ? firstPatient.userId : DEFAULT_USER_ID,
    authProvider: 'local',
    email: firstPatient.email,
  };
  safeJsonWrite(ACTIVE_SESSION_KEY, initialSession);
  setActiveScopePatientId(initialSession.activePatientId);
  return initialSession;
}

export function setActiveSession(session: ActiveUserSession): ActiveUserSession {
  safeJsonWrite(ACTIVE_SESSION_KEY, session);
  setActiveScopePatientId(session.activePatientId);
  if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT));
  }
  return session;
}

export function loadUserProfileRecord(userId: string): FullUserProfileRecord {
  const existing = safeJsonRead<FullUserProfileRecord | null>(getProfileRecordKey(userId), null);
  if (existing && existing.profile) {
    // Hydrate any newly introduced schema fields gracefully
    const base = createEmptyFullProfileRecord(userId, existing.profile.role);
    return {
      profile: { ...base.profile, ...existing.profile, userId },
      interests: Array.isArray(existing.interests) ? existing.interests : [],
      favourites: Array.isArray(existing.favourites) ? existing.favourites : [],
      communication: {
        ...base.communication,
        ...(existing.communication || {}),
        howToCommunicateWithMe: {
          ...base.communication.howToCommunicateWithMe,
          ...(existing.communication?.howToCommunicateWithMe || {}),
        },
      },
      accessibility: { ...base.accessibility, ...(existing.accessibility || {}) },
      medical: { ...base.medical, ...(existing.medical || {}) },
      privacy: {
        ...base.privacy,
        ...(existing.privacy || {}),
        caregiverAccess: {
          ...base.privacy.caregiverAccess,
          ...(existing.privacy?.caregiverAccess || {}),
        },
      },
      photos: existing.photos || {},
    };
  }

  const accounts = safeJsonRead<LocalAccountDescriptor[]>(ACCOUNTS_KEY, []);
  const account = accounts.find((a) => a.userId === userId);
  const fresh = createEmptyFullProfileRecord(userId, account?.role ?? 'patient', {
    fullName: account?.displayName || 'Guest User',
    email: account?.email || '',
  });
  safeJsonWrite(getProfileRecordKey(userId), fresh);
  return fresh;
}

function persistUserProfileRecordLocal(record: FullUserProfileRecord): boolean {
  const ok = safeJsonWrite(getProfileRecordKey(record.profile.userId), record);
  if (!ok) return false;

  // Keep account descriptor display name synced
  const accounts = listAccounts();
  const displayName =
    record.profile.preferredName.trim() || record.profile.fullName.trim() || 'User';
  const updatedAccounts = accounts.map((a) =>
    a.userId === record.profile.userId
      ? { ...a, displayName, email: record.profile.email || a.email }
      : a
  );
  saveAccounts(updatedAccounts);

  // For patients, keep legacy PatientProfile and AppSettings synced for that patient scope
  if (record.profile.role === 'patient') {
    savePatientProfile(
      {
        name: record.profile.fullName,
        preferredName: record.profile.preferredName,
        caregiverName: record.profile.caregiverName,
        notes: record.profile.notes,
        onboardingCompleted: record.profile.onboardingCompleted,
      },
      record.profile.userId
    );
    const currentSettings = loadSettings(record.profile.userId);
    const syncedSettings = mapProfilePrefsToAppSettings(record, currentSettings);
    saveSettings(syncedSettings, record.profile.userId);
  }

  return true;
}

export function mapProfilePrefsToAppSettings(
  record: FullUserProfileRecord,
  currentSettings: AppSettings
): AppSettings {
  const acc = record.accessibility;
  const comm = record.communication;
  return {
    eyeTracking: {
      ...currentSettings.eyeTracking,
      dwellDurationMs: acc.dwellDurationMs,
      cursorSize: acc.cursorSize,
      minCutoff: acc.minCutoff,
      beta: acc.beta,
      dCutoff: acc.dCutoff,
      confidenceThreshold: acc.confidenceThreshold,
      blinkSelectionEnabled: acc.blinkSelectionEnabled,
      longBlinkDurationMs: acc.longBlinkDurationMs,
      blinkOpenEar: acc.blinkOpenEar,
      blinkClosedEar: acc.blinkClosedEar,
      allowSingleEyeBlinkFallback: acc.allowSingleEyeBlinkFallback,
      targetHysteresisPx: acc.targetHysteresisPx,
      showDebugOverlay: acc.showDebugOverlay,
      outlierThreshold: acc.outlierThreshold,
      trackingLossTimeoutMs: acc.trackingLossTimeoutMs,
      selectionCooldownMs: acc.selectionCooldownMs,
    },
    interface: {
      ...currentSettings.interface,
      interactionMode: acc.interactionMode,
      buttonSize: acc.buttonSize,
      buttonSpacing: acc.buttonSpacing,
      fontSize: acc.fontSize,
      highContrast: acc.highContrast,
      theme: acc.theme,
    },
    communication: {
      ...currentSettings.communication,
      language: comm.preferredLanguage,
      preferredVoiceEn: comm.preferredVoiceEn,
      preferredVoiceHi: comm.preferredVoiceHi,
      speechRate: comm.speechRate,
    },
    privacy: {
      ...currentSettings.privacy,
      historyConsentEnabled: record.privacy.historyConsentEnabled,
    },
  };
}

/**
 * Enforces strict access separation between profile owner, other users, and authorized caregivers.
 */
export function checkCaregiverPermission(
  session: ActiveUserSession,
  targetRecord: FullUserProfileRecord,
  scope: CaregiverPermissionScope
): { allowed: boolean; reason?: string } {
  if (session.currentUserId === targetRecord.profile.userId) {
    return { allowed: true };
  }

  if (session.role !== 'caregiver') {
    return {
      allowed: false,
      reason: 'Access denied. Users can only view or modify their own profile.',
    };
  }

  const access: CaregiverAccessPermissions = targetRecord.privacy.caregiverAccess;
  if (!access.enabled) {
    return {
      allowed: false,
      reason: 'Caregiver access is currently disabled in this patient’s privacy settings.',
    };
  }

  // If the patient specified an authorized caregiver ID or email, verify strict match
  if (access.authorizedCaregiverId && access.authorizedCaregiverId !== session.currentUserId) {
    return {
      allowed: false,
      reason: 'You are not the authorized caregiver ID for this patient profile.',
    };
  }
  if (
    access.authorizedCaregiverEmail &&
    session.email?.trim().toLowerCase() !== access.authorizedCaregiverEmail.trim().toLowerCase()
  ) {
    return {
      allowed: false,
      reason: 'Your email does not match the authorized caregiver email configured by this patient.',
    };
  }

  switch (scope) {
    case 'view_profile':
      return access.canViewProfile && targetRecord.privacy.sharePersonalInfoWithCaregiver
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Patient has restricted personal profile visibility from caregivers.',
          };
    case 'edit_profile':
      return access.canEditProfile && targetRecord.privacy.sharePersonalInfoWithCaregiver
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Patient has disabled caregiver editing of personal details.',
          };
    case 'edit_communication':
      return access.canEditCommunication
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Patient has disabled caregiver editing of communication settings.',
          };
    case 'edit_accessibility':
      return access.canEditAccessibility
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Patient has disabled caregiver editing of accessibility settings.',
          };
    case 'view_medical':
      return access.canViewMedical && targetRecord.privacy.shareHealthInfoWithCaregiver
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Health & medical details are private and not shared with caregivers.',
          };
    case 'edit_medical':
      return access.canEditMedical && targetRecord.privacy.shareHealthInfoWithCaregiver
        ? { allowed: true }
        : {
            allowed: false,
            reason: 'Patient has not granted caregiver permission to edit health details.',
          };
  }
}

export async function createLocalAccountService(params: {
  role: AccountRole;
  fullName: string;
  preferredName?: string;
  email?: string;
  linkedPatientId?: string;
}): Promise<ProfileActionResult<{ account: LocalAccountDescriptor; session: ActiveUserSession }>> {
  const fullName = params.fullName.trim();
  if (!fullName) {
    return { ok: false, error: 'Please enter a full name to create an account.' };
  }

  const accounts = listAccounts();
  const userId = `${params.role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const preferredName = params.preferredName?.trim() || fullName.split(' ')[0];
  const email = params.email?.trim() || '';

  const record = createEmptyFullProfileRecord(userId, params.role, {
    fullName,
    preferredName,
    email,
    onboardingCompleted: params.role === 'caregiver',
  });

  if (!safeJsonWrite(getProfileRecordKey(userId), record)) {
    return { ok: false, error: 'Unable to save new profile locally.' };
  }

  const firstPatient = accounts.find((a) => a.role === 'patient');
  const linkedPatientId =
    params.role === 'caregiver'
      ? params.linkedPatientId || firstPatient?.userId || DEFAULT_USER_ID
      : undefined;

  const account: LocalAccountDescriptor = {
    userId,
    role: params.role,
    displayName: preferredName || fullName,
    email: email || undefined,
    linkedPatientId,
    createdAt: record.profile.createdAt,
  };

  saveAccounts([...accounts, account]);

  const session = setActiveSession({
    currentUserId: userId,
    role: params.role,
    activePatientId: params.role === 'patient' ? userId : linkedPatientId || DEFAULT_USER_ID,
    authProvider: 'local',
    email: email || undefined,
  });

  return { ok: true, data: { account, session } };
}

export function switchLocalAccountService(
  targetUserId: string,
  linkedPatientOverride?: string
): ProfileActionResult<ActiveUserSession> {
  const accounts = listAccounts();
  const target = accounts.find((a) => a.userId === targetUserId);
  if (!target) {
    return { ok: false, error: 'Selected account no longer exists.' };
  }

  const firstPatient = accounts.find((a) => a.role === 'patient');
  const activePatientId =
    target.role === 'patient'
      ? target.userId
      : linkedPatientOverride || target.linkedPatientId || firstPatient?.userId || DEFAULT_USER_ID;

  const session = setActiveSession({
    currentUserId: target.userId,
    role: target.role,
    activePatientId,
    authProvider: 'local',
    email: target.email,
  });

  return { ok: true, data: session };
}

export async function updatePersonalDetailsService(
  session: ActiveUserSession,
  targetUserId: string,
  updates: Partial<
    Pick<
      UserProfileCore,
      | 'fullName'
      | 'preferredName'
      | 'email'
      | 'dateOfBirth'
      | 'showAgePublicly'
      | 'occupation'
      | 'educationStatus'
      | 'city'
      | 'state'
      | 'country'
      | 'shortBio'
      | 'caregiverName'
      | 'notes'
      | 'onboardingCompleted'
    >
  >
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_profile');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const nextFullName =
    updates.fullName !== undefined ? updates.fullName.trim() : current.profile.fullName;
  const nextPreferredName =
    updates.preferredName !== undefined
      ? updates.preferredName.trim()
      : current.profile.preferredName;

  if (!nextFullName && !nextPreferredName) {
    return { ok: false, error: 'Full Name or Preferred Name is required.' };
  }

  const nextDob =
    updates.dateOfBirth !== undefined ? updates.dateOfBirth.trim() : current.profile.dateOfBirth;
  const dobCheck = validateDateOfBirth(nextDob);
  if (!dobCheck.valid) {
    return { ok: false, error: dobCheck.error };
  }

  const nowIso = new Date().toISOString();
  const nextRecord: FullUserProfileRecord = {
    ...current,
    profile: {
      ...current.profile,
      ...updates,
      fullName: nextFullName || nextPreferredName,
      preferredName: nextPreferredName || nextFullName.split(' ')[0],
      dateOfBirth: dobCheck.normalized,
      shortBio: (updates.shortBio !== undefined ? updates.shortBio : current.profile.shortBio).slice(0, 420),
      updatedAt: nowIso,
    },
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save personal details.' };
  }

  await syncCoreProfileToSupabase(nextRecord);
  return { ok: true, data: nextRecord };
}

export async function uploadProfilePhotoService(
  session: ActiveUserSession,
  targetUserId: string,
  slotKey: string,
  blob: Blob,
  crop: PhotoCropConfig
): Promise<ProfileActionResult<{ record: FullUserProfileRecord; objectUrl: string }>> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_profile');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  try {
    const { meta, objectUrl } = await saveUserPhotoAsset({
      userId: targetUserId,
      slotKey,
      blob,
      crop,
    });

    const nowIso = new Date().toISOString();
    const nextPhotos = { ...current.photos, [slotKey]: meta };
    const nextRecord: FullUserProfileRecord = {
      ...current,
      profile:
        slotKey === 'avatar'
          ? { ...current.profile, avatarPhotoId: meta.id, updatedAt: nowIso }
          : current.profile,
      photos: nextPhotos,
    };

    if (!persistUserProfileRecordLocal(nextRecord)) {
      return { ok: false, error: 'Failed to persist photo metadata.' };
    }

    return { ok: true, data: { record: nextRecord, objectUrl } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to upload photo.',
    };
  }
}

export async function removeProfilePhotoService(
  session: ActiveUserSession,
  targetUserId: string,
  slotKey: string
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_profile');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const meta = current.photos[slotKey];
  await removeUserPhotoAsset(targetUserId, slotKey, meta);

  const nextPhotos = { ...current.photos };
  delete nextPhotos[slotKey];
  const nowIso = new Date().toISOString();
  const nextRecord: FullUserProfileRecord = {
    ...current,
    profile:
      slotKey === 'avatar'
        ? { ...current.profile, avatarPhotoId: null, updatedAt: nowIso }
        : current.profile,
    photos: nextPhotos,
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to update profile after removing photo.' };
  }
  return { ok: true, data: nextRecord };
}

export async function updateInterestsService(
  session: ActiveUserSession,
  targetUserId: string,
  interests: UserInterest[]
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_profile');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const clean = interests
    .filter((item) => item.label.trim().length > 0)
    .slice(0, 30);

  const nextRecord: FullUserProfileRecord = {
    ...current,
    interests: clean,
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save interests.' };
  }
  return { ok: true, data: nextRecord };
}

export async function updateFavouritesService(
  session: ActiveUserSession,
  targetUserId: string,
  favourites: UserFavouriteItem[]
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_profile');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const nowIso = new Date().toISOString();
  const clean = favourites
    .filter((f) => f.title.trim().length > 0 || f.description.trim().length > 0)
    .map((f) => ({
      ...f,
      title: f.title.trim().slice(0, 120),
      description: f.description.trim().slice(0, 300),
      updatedAt: nowIso,
    }));

  const nextRecord: FullUserProfileRecord = {
    ...current,
    favourites: clean,
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save favourite items.' };
  }
  return { ok: true, data: nextRecord };
}

export async function updateCommunicationPrefsService(
  session: ActiveUserSession,
  targetUserId: string,
  updates: Partial<UserCommunicationPreferences> & {
    howToCommunicateWithMe?: Partial<HowToCommunicateConfig>;
  }
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_communication');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const nowIso = new Date().toISOString();
  const nextComm: UserCommunicationPreferences = {
    ...current.communication,
    ...updates,
    howToCommunicateWithMe: {
      ...current.communication.howToCommunicateWithMe,
      ...(updates.howToCommunicateWithMe || {}),
    },
    updatedAt: nowIso,
  };

  const nextRecord: FullUserProfileRecord = {
    ...current,
    communication: nextComm,
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save communication preferences.' };
  }
  return { ok: true, data: nextRecord };
}

export async function updateAccessibilityPrefsService(
  session: ActiveUserSession,
  targetUserId: string,
  updates: Partial<UserAccessibilitySettings>
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_accessibility');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const nowIso = new Date().toISOString();
  const nextRecord: FullUserProfileRecord = {
    ...current,
    accessibility: {
      ...current.accessibility,
      ...updates,
      updatedAt: nowIso,
    },
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save accessibility preferences.' };
  }
  return { ok: true, data: nextRecord };
}

export async function restoreAccessibilityDefaultsService(
  session: ActiveUserSession,
  targetUserId: string
): Promise<ProfileActionResult> {
  const defaults = createDefaultAccessibilitySettings();
  return updateAccessibilityPrefsService(session, targetUserId, defaults);
}

export async function updateMedicalInfoService(
  session: ActiveUserSession,
  targetUserId: string,
  updates: Partial<UserMedicalInformation>
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  const perm = checkCaregiverPermission(session, current, 'edit_medical');
  if (!perm.allowed) {
    return { ok: false, error: perm.reason };
  }

  const nowIso = new Date().toISOString();
  const nextRecord: FullUserProfileRecord = {
    ...current,
    medical: {
      ...current.medical,
      ...updates,
      updatedAt: nowIso,
    },
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save health and care information.' };
  }
  return { ok: true, data: nextRecord };
}

export async function updatePrivacyControlsService(
  session: ActiveUserSession,
  targetUserId: string,
  updates: Partial<UserPrivacyControls> & {
    caregiverAccess?: Partial<CaregiverAccessPermissions>;
  }
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  if (session.currentUserId !== targetUserId) {
    return {
      ok: false,
      error: 'Only the profile owner may change privacy and caregiver security permissions.',
    };
  }

  const nowIso = new Date().toISOString();
  const nextRecord: FullUserProfileRecord = {
    ...current,
    privacy: {
      ...current.privacy,
      ...updates,
      caregiverAccess: {
        ...current.privacy.caregiverAccess,
        ...(updates.caregiverAccess || {}),
      },
      updatedAt: nowIso,
    },
  };

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to save privacy settings.' };
  }
  return { ok: true, data: nextRecord };
}

export type DeletableProfileSection =
  | 'interests'
  | 'favourites'
  | 'health'
  | 'communication'
  | 'history';

export async function deleteProfileSectionService(
  session: ActiveUserSession,
  targetUserId: string,
  section: DeletableProfileSection
): Promise<ProfileActionResult> {
  const current = loadUserProfileRecord(targetUserId);
  if (session.currentUserId !== targetUserId) {
    return {
      ok: false,
      error: 'Only the profile owner can permanently delete profile sections.',
    };
  }

  const nowIso = new Date().toISOString();
  let nextRecord: FullUserProfileRecord = { ...current };

  if (section === 'interests') {
    nextRecord.interests = [];
  } else if (section === 'favourites') {
    // Also clean up any favourite photos stored locally/remotely
    for (const fav of current.favourites) {
      const slot = `fav_${fav.id}`;
      if (current.photos[slot]) {
        await removeUserPhotoAsset(targetUserId, slot, current.photos[slot]);
        const copy = { ...nextRecord.photos };
        delete copy[slot];
        nextRecord.photos = copy;
      }
    }
    nextRecord.favourites = [];
  } else if (section === 'health') {
    nextRecord.medical = {
      allergies: '',
      existingConditions: '',
      medications: '',
      preferredDoctor: '',
      doctorContact: '',
      preferredHospital: '',
      careInstructions: '',
      updatedAt: nowIso,
    };
  } else if (section === 'communication') {
    nextRecord.communication = createDefaultCommunicationPreferences(nowIso);
  } else if (section === 'history') {
    clearAllCommunicationHistory(targetUserId);
  }

  if (!persistUserProfileRecordLocal(nextRecord)) {
    return { ok: false, error: 'Failed to delete the selected profile section.' };
  }

  return { ok: true, data: nextRecord };
}

export function exportPersonalDataBundle(
  session: ActiveUserSession,
  targetUserId: string
): ProfileActionResult<string> {
  const record = loadUserProfileRecord(targetUserId);
  if (session.currentUserId !== targetUserId) {
    return {
      ok: false,
      error: 'Only the profile owner may export a full personal data archive.',
    };
  }

  const bundle = {
    exportedAt: new Date().toISOString(),
    application: 'NayanSathi (GazeConnect)',
    account: {
      userId: record.profile.userId,
      role: record.profile.role,
    },
    personalInformation: record.profile,
    interests: record.interests,
    favourites: record.favourites,
    communicationPreferences: record.communication,
    accessibilitySettings: record.accessibility,
    medicalInformation: record.medical,
    privacyControls: record.privacy,
    photoMetadata: record.photos,
    emergencyContacts: readContactsFromLocalStorage().contacts,
    customCategories: loadCategories(targetUserId).filter((c) => c.isCustom),
    customPhrases: loadPhrases(targetUserId).filter((p) => p.isCustom),
    communicationHistory: loadCommunicationHistory(targetUserId),
  };

  return {
    ok: true,
    data: JSON.stringify(bundle, null, 2),
  };
}

export async function deleteAccountAndDataService(
  session: ActiveUserSession,
  targetUserId: string
): Promise<ProfileActionResult<{ nextSession: ActiveUserSession }>> {
  if (session.currentUserId !== targetUserId) {
    return {
      ok: false,
      error: 'Only the profile owner may delete their account and associated data.',
    };
  }

  // Delete stored photo blobs in IndexedDB
  await deleteAllUserPhotosFromIndexedDb(targetUserId);

  // Remove scoped localStorage keys (settings, calibration, phrases, contacts, history)
  clearScopedUserLocalData(targetUserId);

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(getProfileRecordKey(targetUserId));
  }

  // Update accounts registry cleanly
  const remaining = listAccounts().filter((a) => a.userId !== targetUserId);
  let nextSession: ActiveUserSession;

  if (remaining.length === 0) {
    // Re-seed clean fresh default account so app never enters an empty broken state
    const freshDefault = seedDefaultPatientAccount();
    nextSession = setActiveSession({
      currentUserId: freshDefault.userId,
      role: 'patient',
      activePatientId: freshDefault.userId,
      authProvider: 'local',
    });
  } else {
    saveAccounts(remaining);
    const nextAcc = remaining.find((a) => a.role === 'patient') ?? remaining[0];
    nextSession = setActiveSession({
      currentUserId: nextAcc.userId,
      role: nextAcc.role,
      activePatientId:
        nextAcc.role === 'patient'
          ? nextAcc.userId
          : nextAcc.linkedPatientId || DEFAULT_USER_ID,
      authProvider: 'local',
      email: nextAcc.email,
    });
  }

  // Remote cleanup if signed in with Supabase
  if (isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const {
        data: { session: sbSession },
      } = await client.auth.getSession();
      if (sbSession?.user?.id === targetUserId) {
        await client.from('user_profiles').delete().eq('user_id', targetUserId);
        await client.auth.signOut();
      }
    }
  }

  return { ok: true, data: { nextSession } };
}

async function syncCoreProfileToSupabase(record: FullUserProfileRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session?.user) return;

    await client.from('user_profiles').upsert(
      {
        user_id: record.profile.userId,
        role: record.profile.role,
        email: record.profile.email || null,
        full_name: record.profile.fullName,
        preferred_name: record.profile.preferredName,
        date_of_birth: record.profile.dateOfBirth || null,
        show_age_publicly: record.profile.showAgePublicly,
        occupation: record.profile.occupation,
        education_status: record.profile.educationStatus,
        city: record.profile.city,
        state: record.profile.state,
        country: record.profile.country,
        short_bio: record.profile.shortBio,
        onboarding_completed: record.profile.onboardingCompleted,
        avatar_photo_id: record.profile.avatarPhotoId,
        profile_visibility: record.privacy.profileVisibility,
        share_personal_with_caregiver: record.privacy.sharePersonalInfoWithCaregiver,
        share_health_with_caregiver: record.privacy.shareHealthInfoWithCaregiver,
        allow_interest_personalization: record.privacy.allowInterestPersonalization,
        updated_at: record.profile.updatedAt,
      },
      { onConflict: 'user_id' }
    );
  } catch {
    // Graceful local-first fallback
  }
}

export async function signInSupabaseEmail(
  email: string,
  password: string
): Promise<ProfileActionResult<ActiveUserSession>> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase authentication is not configured in this environment.',
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase client unavailable.' };
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: error?.message || 'Sign in failed.' };
  }

  const userId = data.user.id;
  const accounts = listAccounts();
  const existing = accounts.find((a) => a.userId === userId);
  if (!existing) {
    const fresh = createEmptyFullProfileRecord(userId, 'patient', {
      fullName: data.user.user_metadata?.full_name || email.split('@')[0],
      email,
    });
    safeJsonWrite(getProfileRecordKey(userId), fresh);
    saveAccounts([
      ...accounts,
      {
        userId,
        role: 'patient',
        displayName: fresh.profile.preferredName,
        email,
        createdAt: fresh.profile.createdAt,
      },
    ]);
  }

  const session = setActiveSession({
    currentUserId: userId,
    role: existing?.role ?? 'patient',
    activePatientId: existing?.role === 'caregiver' ? existing.linkedPatientId || DEFAULT_USER_ID : userId,
    authProvider: 'supabase',
    email,
  });
  return { ok: true, data: session };
}

export async function signOutSupabaseService(): Promise<ProfileActionResult<ActiveUserSession>> {
  if (isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut().catch(() => {});
    }
  }
  const fallback = switchLocalAccountService(DEFAULT_USER_ID);
  return fallback;
}
