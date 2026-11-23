import type {
  EntertainmentSectionId,
  GameCategoryId,
  GameId,
  HubPersonalizationPreferences,
  MusicCategoryId,
  NewsCategoryId,
  PersonalBirthdayReminder,
  SportCategoryId,
} from '../../types';
import { getActivePatientId, getPatientScopedStorageKey } from './patient-accounts';

const HUB_PREFS_STORAGE_KEY = 'nayanSathi.hubPrefs.v1';

export function createDefaultHubPreferences(): HubPersonalizationPreferences {
  return {
    favoriteGameCategories: ['board', 'word'],
    disabledGameIds: [],
    disabledMusicCategories: [],
    favoriteNewsCategories: ['top', 'india', 'health'],
    disabledNewsCategories: [],
    favoriteSports: ['cricket', 'badminton'],
    favoriteEntertainmentSections: ['facts', 'jokes', 'stories'],
    disabledEntertainmentSections: [],
    birthdays: [],
  };
}

export function loadHubPreferences(
  patientId = getActivePatientId()
): HubPersonalizationPreferences {
  const defaults = createDefaultHubPreferences();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(
      getPatientScopedStorageKey(HUB_PREFS_STORAGE_KEY, patientId)
    );
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<HubPersonalizationPreferences>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      favoriteGameCategories: Array.isArray(parsed.favoriteGameCategories)
        ? (parsed.favoriteGameCategories as GameCategoryId[])
        : defaults.favoriteGameCategories,
      disabledGameIds: Array.isArray(parsed.disabledGameIds)
        ? (parsed.disabledGameIds as GameId[])
        : [],
      disabledMusicCategories: Array.isArray(parsed.disabledMusicCategories)
        ? (parsed.disabledMusicCategories as (MusicCategoryId | 'favourites' | 'relaxation')[])
        : [],
      favoriteNewsCategories: Array.isArray(parsed.favoriteNewsCategories)
        ? (parsed.favoriteNewsCategories as NewsCategoryId[])
        : defaults.favoriteNewsCategories,
      disabledNewsCategories: Array.isArray(parsed.disabledNewsCategories)
        ? (parsed.disabledNewsCategories as NewsCategoryId[])
        : [],
      favoriteSports: Array.isArray(parsed.favoriteSports)
        ? (parsed.favoriteSports as SportCategoryId[])
        : defaults.favoriteSports,
      favoriteEntertainmentSections: Array.isArray(parsed.favoriteEntertainmentSections)
        ? (parsed.favoriteEntertainmentSections as EntertainmentSectionId[])
        : defaults.favoriteEntertainmentSections,
      disabledEntertainmentSections: Array.isArray(parsed.disabledEntertainmentSections)
        ? (parsed.disabledEntertainmentSections as EntertainmentSectionId[])
        : [],
      birthdays: Array.isArray(parsed.birthdays)
        ? (parsed.birthdays as PersonalBirthdayReminder[])
        : [],
    };
  } catch {
    return defaults;
  }
}

export function saveHubPreferences(
  prefs: HubPersonalizationPreferences,
  patientId = getActivePatientId()
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(HUB_PREFS_STORAGE_KEY, patientId),
      JSON.stringify(prefs)
    );
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function eraseHubPreferences(patientId = getActivePatientId()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(
    getPatientScopedStorageKey(HUB_PREFS_STORAGE_KEY, patientId)
  );
}
