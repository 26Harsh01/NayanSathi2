import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppState } from './AppStateContext';
import {
  createDefaultHubPreferences,
  loadHubPreferences,
  saveHubPreferences,
} from '../features/storage/hub-preferences-storage';
import type {
  EntertainmentSectionId,
  GameCategoryId,
  GameId,
  HubPersonalizationPreferences,
  MusicCategoryId,
  NewsCategoryId,
  PersonalBirthdayReminder,
  SportCategoryId,
} from '../types';

interface HubPreferencesContextValue {
  hubPrefs: HubPersonalizationPreferences;
  toggleFavoriteGameCategory: (cat: GameCategoryId) => void;
  toggleGameEnabled: (gameId: GameId) => void;
  toggleMusicCategoryEnabled: (cat: MusicCategoryId | 'favourites' | 'relaxation') => void;
  toggleFavoriteNewsCategory: (cat: NewsCategoryId) => void;
  toggleNewsCategoryEnabled: (cat: NewsCategoryId) => void;
  toggleFavoriteSport: (sport: SportCategoryId) => void;
  toggleFavoriteEntertainmentSection: (sec: EntertainmentSectionId) => void;
  toggleEntertainmentSectionEnabled: (sec: EntertainmentSectionId) => void;
  addBirthdayReminder: (item: Omit<PersonalBirthdayReminder, 'id'>) => { ok: boolean; error?: string };
  removeBirthdayReminder: (id: string) => void;
  resetHubPreferences: () => void;
}

const HubPreferencesContext = createContext<HubPreferencesContextValue | null>(null);

function toggleInList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export const HubPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activePatientId } = useAppState();
  const [hubPrefs, setHubPrefs] = useState<HubPersonalizationPreferences>(() =>
    loadHubPreferences(activePatientId)
  );

  useEffect(() => {
    setHubPrefs(loadHubPreferences(activePatientId));
  }, [activePatientId]);

  const update = useCallback(
    (updater: (prev: HubPersonalizationPreferences) => HubPersonalizationPreferences) => {
      setHubPrefs((prev) => {
        const next = updater(prev);
        saveHubPreferences(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const toggleFavoriteGameCategory = useCallback(
    (cat: GameCategoryId) => {
      update((prev) => ({
        ...prev,
        favoriteGameCategories: toggleInList(prev.favoriteGameCategories, cat),
      }));
    },
    [update]
  );

  const toggleGameEnabled = useCallback(
    (gameId: GameId) => {
      update((prev) => ({
        ...prev,
        disabledGameIds: toggleInList(prev.disabledGameIds, gameId),
      }));
    },
    [update]
  );

  const toggleMusicCategoryEnabled = useCallback(
    (cat: MusicCategoryId | 'favourites' | 'relaxation') => {
      update((prev) => ({
        ...prev,
        disabledMusicCategories: toggleInList(prev.disabledMusicCategories, cat),
      }));
    },
    [update]
  );

  const toggleFavoriteNewsCategory = useCallback(
    (cat: NewsCategoryId) => {
      update((prev) => ({
        ...prev,
        favoriteNewsCategories: toggleInList(prev.favoriteNewsCategories, cat),
      }));
    },
    [update]
  );

  const toggleNewsCategoryEnabled = useCallback(
    (cat: NewsCategoryId) => {
      update((prev) => ({
        ...prev,
        disabledNewsCategories: toggleInList(prev.disabledNewsCategories, cat),
      }));
    },
    [update]
  );

  const toggleFavoriteSport = useCallback(
    (sport: SportCategoryId) => {
      update((prev) => ({
        ...prev,
        favoriteSports: toggleInList(prev.favoriteSports, sport),
      }));
    },
    [update]
  );

  const toggleFavoriteEntertainmentSection = useCallback(
    (sec: EntertainmentSectionId) => {
      update((prev) => ({
        ...prev,
        favoriteEntertainmentSections: toggleInList(prev.favoriteEntertainmentSections, sec),
      }));
    },
    [update]
  );

  const toggleEntertainmentSectionEnabled = useCallback(
    (sec: EntertainmentSectionId) => {
      update((prev) => ({
        ...prev,
        disabledEntertainmentSections: toggleInList(prev.disabledEntertainmentSections, sec),
      }));
    },
    [update]
  );

  const addBirthdayReminder = useCallback(
    (item: Omit<PersonalBirthdayReminder, 'id'>): { ok: boolean; error?: string } => {
      const cleanName = item.personName.trim().slice(0, 80);
      const cleanDate = item.monthDay.trim();
      if (!cleanName) return { ok: false, error: 'Please enter a name.' };
      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(cleanDate)) {
        return { ok: false, error: 'Please enter date as MM-DD (e.g. 08-14).' };
      }
      const nextItem: PersonalBirthdayReminder = {
        id: `bday_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        personName: cleanName,
        relationship: item.relationship.trim().slice(0, 40) || 'Family / Friend',
        monthDay: cleanDate,
        note: item.note?.trim().slice(0, 120) || undefined,
      };
      update((prev) => ({
        ...prev,
        birthdays: [nextItem, ...prev.birthdays],
      }));
      return { ok: true };
    },
    [update]
  );

  const removeBirthdayReminder = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        birthdays: prev.birthdays.filter((b) => b.id !== id),
      }));
    },
    [update]
  );

  const resetHubPreferences = useCallback(() => {
    const defaults = createDefaultHubPreferences();
    saveHubPreferences(defaults, activePatientId);
    setHubPrefs(defaults);
  }, [activePatientId]);

  const value = useMemo<HubPreferencesContextValue>(
    () => ({
      hubPrefs,
      toggleFavoriteGameCategory,
      toggleGameEnabled,
      toggleMusicCategoryEnabled,
      toggleFavoriteNewsCategory,
      toggleNewsCategoryEnabled,
      toggleFavoriteSport,
      toggleFavoriteEntertainmentSection,
      toggleEntertainmentSectionEnabled,
      addBirthdayReminder,
      removeBirthdayReminder,
      resetHubPreferences,
    }),
    [
      addBirthdayReminder,
      hubPrefs,
      removeBirthdayReminder,
      resetHubPreferences,
      toggleEntertainmentSectionEnabled,
      toggleFavoriteEntertainmentSection,
      toggleFavoriteGameCategory,
      toggleFavoriteNewsCategory,
      toggleFavoriteSport,
      toggleGameEnabled,
      toggleMusicCategoryEnabled,
      toggleNewsCategoryEnabled,
    ]
  );

  return <HubPreferencesContext.Provider value={value}>{children}</HubPreferencesContext.Provider>;
};

export function useHubPreferences(): HubPreferencesContextValue {
  const ctx = useContext(HubPreferencesContext);
  if (!ctx) throw new Error('useHubPreferences must be used inside HubPreferencesProvider');
  return ctx;
}
