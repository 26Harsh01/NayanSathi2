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
    speechRate: 0.95,
    preferredVoiceEn: '',
    preferredVoiceHi: '',
    activeContext: 'home',
  },
  privacy: {
    historyConsentEnabled: false, // Strictly OFF by default
  },
};

export const DEFAULT_PROFILE: PatientProfile = {
  name: 'Guest User',
  preferredName: 'Friend',
  caregiverName: '',
  notes: '',
  onboardingCompleted: false,
};

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

export function loadSettings(): AppSettings {
  const saved = safeRead<Partial<AppSettings>>(KEYS.SETTINGS, {});
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

export function saveSettings(settings: AppSettings): void {
  safeWrite(KEYS.SETTINGS, settings);
}

export function loadCalibration(): CalibrationProfile | null {
  const saved = safeRead<CalibrationProfile | null>(KEYS.CALIBRATION, null);
  if (!saved || !saved.model) return null;

  // Discard incompatible pre-upgrade calibration shapes cleanly so user recalibrates safely
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

export function saveCalibration(profile: CalibrationProfile): void {
  safeWrite(KEYS.CALIBRATION, profile);
}

export function eraseCalibration(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEYS.CALIBRATION);
}

export function loadPatientProfile(): PatientProfile {
  return { ...DEFAULT_PROFILE, ...safeRead<Partial<PatientProfile>>(KEYS.PROFILE, {}) };
}

export function savePatientProfile(profile: PatientProfile): void {
  safeWrite(KEYS.PROFILE, profile);
}

export function loadCategories(): PhraseCategory[] {
  const custom = safeRead<PhraseCategory[]>(KEYS.CATEGORIES, []);
  return [...DEFAULT_CATEGORIES, ...custom.filter((c) => c.isCustom)];
}

export function saveCustomCategories(categories: PhraseCategory[]): void {
  safeWrite(
    KEYS.CATEGORIES,
    categories.filter((c) => c.isCustom)
  );
}

export function loadPhrases(): PhraseItem[] {
  const savedCustom = safeRead<PhraseItem[]>(KEYS.PHRASES, []);
  const favorites = new Set(loadFavoriteIds());
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

export function saveCustomPhrases(phrases: PhraseItem[]): void {
  const customOnly = phrases.filter((p) => p.isCustom);
  safeWrite(KEYS.PHRASES, customOnly);
}

export function loadFavoriteIds(): string[] {
  return safeRead<string[]>(KEYS.FAVORITES, []);
}

export function saveFavoriteIds(ids: string[]): void {
  safeWrite(KEYS.FAVORITES, Array.from(new Set(ids)));
}

export function loadRecentPhrases(): string[] {
  return safeRead<string[]>(KEYS.RECENTS, []);
}

export function pushRecentPhrase(phrase: string): string[] {
  const clean = phrase.trim();
  if (!clean) return loadRecentPhrases();
  const current = loadRecentPhrases().filter((p) => p !== clean);
  const next = [clean, ...current].slice(0, 10);
  safeWrite(KEYS.RECENTS, next);
  return next;
}

export function loadCommunicationHistory(): CommunicationHistoryEntry[] {
  return safeRead<CommunicationHistoryEntry[]>(KEYS.HISTORY, []);
}

export function appendCommunicationHistory(
  entry: CommunicationHistoryEntry,
  consentEnabled: boolean
): CommunicationHistoryEntry[] {
  if (!consentEnabled) {
    return loadCommunicationHistory();
  }
  const current = loadCommunicationHistory();
  const next = [entry, ...current].slice(0, 100);
  safeWrite(KEYS.HISTORY, next);
  return next;
}

export function deleteCommunicationHistoryEntry(id: string): CommunicationHistoryEntry[] {
  const next = loadCommunicationHistory().filter((e) => e.id !== id);
  safeWrite(KEYS.HISTORY, next);
  return next;
}

export function clearAllCommunicationHistory(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEYS.HISTORY);
}

export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  window.localStorage.removeItem(EMERGENCY_CONTACTS_STORAGE_KEY);
  if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT));
  }
}
