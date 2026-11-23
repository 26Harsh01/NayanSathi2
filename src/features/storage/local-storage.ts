import type {
  AppSettings,
  CalibrationProfile,
  CommunicationHistoryEntry,
  EyeTrackingSettings,
  PatientProfile,
  PhraseCategory,
  PhraseItem,
} from '../../types';
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from '../communication/phrase-library';
import {
  CONTACTS_CHANGED_EVENT,
  EMERGENCY_CONTACTS_STORAGE_KEY,
} from '../contacts/emergency-contact-service';
import {
  DEFAULT_LOCAL_PATIENT_ID,
  getActivePatientId,
  getPatientScopedStorageKey,
  setActivePatientId,
} from './patient-accounts';
import { eraseGamesState, eraseMusicState } from './games-music-storage';
import { eraseHubPreferences } from './hub-preferences-storage';
import { deleteAllAudioForPatient } from './indexeddb-audio';

const KEYS = {
  SETTINGS: 'nayansathi_settings_v1',
  CALIBRATION: 'nayansathi_calibration_v1',
  PROFILE: 'nayansathi_profile_v1',
  CATEGORIES: 'nayansathi_categories_v1',
  PHRASES: 'nayansathi_phrases_v1',
  CONTACTS: 'nayansathi_contacts_v1',
  HISTORY: 'nayansathi_history_v1',
  RECENTS: 'nayansathi_recents_v1',
  FAVORITES: 'nayansathi_favorites_v1',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  eyeTracking: {
    enabled: false,
    dwellDurationMs: 1000,
    cursorSize: 28,
    cursorVisible: true,
    minCutoff: 1.15,
    beta: 0.9,
    dCutoff: 1.0,
    confidenceThreshold: 0.48,
    blinkSelectionEnabled: false,
    longBlinkDurationMs: 700,
    blinkOpenEar: 0.29,
    blinkClosedEar: 0.11,
    allowSingleEyeBlinkFallback: true,
    showDebugOverlay: false,
    dwellTolerancePx: 14,
    targetHysteresisPx: 14,
    outlierThreshold: 3.0,
    trackingLossTimeoutMs: 650,
    selectionCooldownMs: 900,
  },
  interface: {
    buttonSize: 'large',
    buttonSpacing: 'comfortable',
    fontSize: 'large',
    highContrast: false,
    theme: 'light',
    interactionMode: 'gaze',
  },
  communication: {
    language: 'en',
    secondaryLanguage: 'hi',
    speechRate: 0.95,
    preferredVoiceEn: '',
    preferredVoiceHi: '',
    activeContext: 'home',
    preferredSentenceLength: 'balanced',
    communicationInstructions: '',
  },
  privacy: {
    historyConsentEnabled: false, // Strictly OFF by default
    medicalEmergencyCardConsent: false,
    shareWellbeingWithCaregivers: false,
    shareHandoverWithCaregivers: false,
    hidePrivateIdentityFields: true,
  },
};

export const DEFAULT_PROFILE: PatientProfile = {
  name: 'Guest User',
  preferredName: 'Friend',
  caregiverName: '',
  notes: '',
  onboardingCompleted: false,
  dateOfBirth: '',
  occupation: '',
  education: '',
  city: '',
  state: '',
  country: '',
  personalIntroduction: '',
  photoAssetId: '',
};

function scoped(baseKey: string, patientId?: string): string {
  return getPatientScopedStorageKey(baseKey, patientId ?? getActivePatientId());
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadSettings(patientId?: string): AppSettings {
  const saved = safeRead<Partial<AppSettings>>(scoped(KEYS.SETTINGS, patientId), {});
  const savedEye: Partial<EyeTrackingSettings> = saved.eyeTracking || {};

  // Legacy builds stored pixel-scale beta (e.g. 0.015). Normalized viewport coords require ~0.9.
  const migratedBeta =
    typeof savedEye.beta === 'number' && savedEye.beta > 0.08 && savedEye.beta <= 5.0
      ? savedEye.beta
      : DEFAULT_SETTINGS.eyeTracking.beta;

  const minCutoff =
    typeof savedEye.minCutoff === 'number' && savedEye.minCutoff >= 0.2 && savedEye.minCutoff <= 5.0
      ? savedEye.minCutoff
      : DEFAULT_SETTINGS.eyeTracking.minCutoff;

  const dCutoff =
    typeof savedEye.dCutoff === 'number' && savedEye.dCutoff >= 0.2 && savedEye.dCutoff <= 5.0
      ? savedEye.dCutoff
      : DEFAULT_SETTINGS.eyeTracking.dCutoff;

  const cursorSize =
    typeof savedEye.cursorSize === 'number' &&
    savedEye.cursorSize >= 22 &&
    savedEye.cursorSize <= 36
      ? savedEye.cursorSize
      : DEFAULT_SETTINGS.eyeTracking.cursorSize;

  return {
    eyeTracking: {
      ...DEFAULT_SETTINGS.eyeTracking,
      ...savedEye,
      cursorSize,
      minCutoff,
      beta: migratedBeta,
      dCutoff,
    },
    interface: { ...DEFAULT_SETTINGS.interface, ...(saved.interface || {}) },
    communication: { ...DEFAULT_SETTINGS.communication, ...(saved.communication || {}) },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(saved.privacy || {}) },
  };
}

export function saveSettings(settings: AppSettings, patientId?: string): void {
  safeWrite(scoped(KEYS.SETTINGS, patientId), settings);
}

export function loadCalibration(patientId?: string): CalibrationProfile | null {
  const saved = safeRead<CalibrationProfile | null>(scoped(KEYS.CALIBRATION, patientId), null);
  if (!saved || !saved.model) return null;

  if (
    !Array.isArray(saved.model.weightsX) ||
    !Array.isArray(saved.model.weightsY) ||
    saved.model.weightsX.length !== 15 ||
    saved.model.weightsY.length !== 15 ||
    !Array.isArray(saved.model.featureScales) ||
    saved.model.featureScales.length !== 9 ||
    !saved.model.baselinePose
  ) {
    return null;
  }

  return saved;
}

export function saveCalibration(profile: CalibrationProfile, patientId?: string): void {
  safeWrite(scoped(KEYS.CALIBRATION, patientId), profile);
}

export function eraseCalibration(patientId?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(scoped(KEYS.CALIBRATION, patientId));
}

export function loadPatientProfile(patientId?: string): PatientProfile {
  return {
    ...DEFAULT_PROFILE,
    ...safeRead<Partial<PatientProfile>>(scoped(KEYS.PROFILE, patientId), {}),
  };
}

export function savePatientProfile(profile: PatientProfile, patientId?: string): void {
  safeWrite(scoped(KEYS.PROFILE, patientId), profile);
}

export function loadCategories(patientId?: string): PhraseCategory[] {
  const custom = safeRead<PhraseCategory[]>(scoped(KEYS.CATEGORIES, patientId), []);
  return [...DEFAULT_CATEGORIES, ...custom.filter((c) => c.isCustom)];
}

export function saveCustomCategories(categories: PhraseCategory[], patientId?: string): void {
  safeWrite(
    scoped(KEYS.CATEGORIES, patientId),
    categories.filter((c) => c.isCustom)
  );
}

export function loadPhrases(patientId?: string): PhraseItem[] {
  const savedCustom = safeRead<PhraseItem[]>(scoped(KEYS.PHRASES, patientId), []);
  const favorites = new Set(loadFavoriteIds(patientId));
  const customMap = new Map(savedCustom.map((p) => [p.id, p]));

  const mergedDefaults = DEFAULT_PHRASES.map((p) => ({
    ...p,
    ...(customMap.get(p.id) || {}),
    isFavorite: favorites.has(p.id),
  }));

  const pureCustom = savedCustom
    .filter((p) => p.isCustom)
    .map((p) => ({ ...p, isFavorite: favorites.has(p.id) }));

  return [...mergedDefaults, ...pureCustom];
}

export function saveCustomPhrases(phrases: PhraseItem[], patientId?: string): void {
  const customOnly = phrases.filter((p) => p.isCustom);
  safeWrite(scoped(KEYS.PHRASES, patientId), customOnly);
}

export function loadFavoriteIds(patientId?: string): string[] {
  return safeRead<string[]>(scoped(KEYS.FAVORITES, patientId), []);
}

export function saveFavoriteIds(ids: string[], patientId?: string): void {
  safeWrite(scoped(KEYS.FAVORITES, patientId), Array.from(new Set(ids)));
}

export function loadRecentPhrases(patientId?: string): string[] {
  return safeRead<string[]>(scoped(KEYS.RECENTS, patientId), []);
}

export function pushRecentPhrase(phrase: string, patientId?: string): string[] {
  const clean = phrase.trim();
  if (!clean) return loadRecentPhrases(patientId);
  const current = loadRecentPhrases(patientId).filter((p) => p !== clean);
  const next = [clean, ...current].slice(0, 10);
  safeWrite(scoped(KEYS.RECENTS, patientId), next);
  return next;
}

export function loadCommunicationHistory(patientId?: string): CommunicationHistoryEntry[] {
  return safeRead<CommunicationHistoryEntry[]>(scoped(KEYS.HISTORY, patientId), []);
}

export function appendCommunicationHistory(
  entry: CommunicationHistoryEntry,
  consentEnabled: boolean,
  patientId?: string
): CommunicationHistoryEntry[] {
  if (!consentEnabled) {
    return loadCommunicationHistory(patientId);
  }
  const current = loadCommunicationHistory(patientId);
  const next = [entry, ...current].slice(0, 100);
  safeWrite(scoped(KEYS.HISTORY, patientId), next);
  return next;
}

export function deleteCommunicationHistoryEntry(
  id: string,
  patientId?: string
): CommunicationHistoryEntry[] {
  const next = loadCommunicationHistory(patientId).filter((e) => e.id !== id);
  safeWrite(scoped(KEYS.HISTORY, patientId), next);
  return next;
}

export function clearAllCommunicationHistory(patientId?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(scoped(KEYS.HISTORY, patientId));
}

export function clearPatientStorageKeys(patientId: string): void {
  if (typeof window === 'undefined') return;
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(scoped(k, patientId)));
  window.localStorage.removeItem(
    getPatientScopedStorageKey(EMERGENCY_CONTACTS_STORAGE_KEY, patientId)
  );
  if (patientId === DEFAULT_LOCAL_PATIENT_ID) {
    window.localStorage.removeItem(EMERGENCY_CONTACTS_STORAGE_KEY);
  }
  eraseGamesState(patientId);
  eraseMusicState(patientId);
  eraseHubPreferences(patientId);
  void deleteAllAudioForPatient(patientId);
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT));
  }
}

export const DEFAULT_USER_ID = DEFAULT_LOCAL_PATIENT_ID;
export const setActiveScopePatientId = setActivePatientId;
export const clearScopedUserLocalData = clearPatientStorageKeys;

export function clearAllLocalData(): void {
  clearPatientStorageKeys(getActivePatientId());
}
