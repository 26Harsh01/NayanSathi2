import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AppSettings,
  CalibrationProfile,
  CommunicationHistoryEntry,
  Language,
  PatientProfile,
  PhraseCategory,
  PhraseItem,
} from '../types';
import {
  appendCommunicationHistory,
  clearAllCommunicationHistory,
  clearAllLocalData,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  deleteCommunicationHistoryEntry,
  eraseCalibration,
  loadCalibration,
  loadCategories,
  loadCommunicationHistory,
  loadFavoriteIds,
  loadPatientProfile,
  loadPhrases,
  loadRecentPhrases,
  loadSettings,
  pushRecentPhrase,
  saveCalibration,
  saveCustomCategories,
  saveCustomPhrases,
  saveFavoriteIds,
  savePatientProfile,
  saveSettings,
} from '../features/storage/local-storage';
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from '../features/communication/phrase-library';

interface AppStateContextValue {
  settings: AppSettings;
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  setLanguage: (lang: Language) => void;
  calibration: CalibrationProfile | null;
  setCalibrationProfile: (profile: CalibrationProfile) => void;
  clearCalibrationProfile: () => void;
  profile: PatientProfile;
  updateProfile: (updater: (prev: PatientProfile) => PatientProfile) => void;
  categories: PhraseCategory[];
  addCategory: (nameEn: string, nameHi: string) => void;
  deleteCategory: (id: string) => void;
  phrases: PhraseItem[];
  addCustomPhrase: (categoryId: string, textEn: string, textHi: string) => void;
  updatePhrase: (id: string, textEn: string, textHi: string) => void;
  deletePhrase: (id: string) => void;
  toggleFavoritePhrase: (id: string) => void;
  recentPhrases: string[];
  recordRecentPhrase: (text: string) => void;
  history: CommunicationHistoryEntry[];
  recordCommunication: (text: string, spoken: boolean) => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  resetAllAppData: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(() => loadCalibration());
  const [profile, setProfile] = useState<PatientProfile>(() => loadPatientProfile());
  const [categories, setCategories] = useState<PhraseCategory[]>(() => loadCategories());
  const [phrases, setPhrases] = useState<PhraseItem[]>(() => loadPhrases());
  const [recentPhrases, setRecentPhrases] = useState<string[]>(() => loadRecentPhrases());
  const [history, setHistory] = useState<CommunicationHistoryEntry[]>(() =>
    loadCommunicationHistory()
  );

  // Sync theme and high-contrast classes onto document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (settings.interface.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (settings.interface.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [settings.interface.theme, settings.interface.highContrast]);

  const updateSettings = useCallback((updater: (prev: AppSettings) => AppSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next);
      return next;
    });
  }, []);

  const setLanguage = useCallback(
    (lang: Language) => {
      updateSettings((prev) => ({
        ...prev,
        communication: { ...prev.communication, language: lang },
      }));
    },
    [updateSettings]
  );

  const setCalibrationProfile = useCallback((cal: CalibrationProfile) => {
    setCalibration(cal);
    saveCalibration(cal);
  }, []);

  const clearCalibrationProfile = useCallback(() => {
    setCalibration(null);
    eraseCalibration();
  }, []);

  const updateProfile = useCallback((updater: (prev: PatientProfile) => PatientProfile) => {
    setProfile((prev) => {
      const next = updater(prev);
      savePatientProfile(next);
      return next;
    });
  }, []);

  const addCategory = useCallback((nameEn: string, nameHi: string) => {
    const newCat: PhraseCategory = {
      id: `cat_${Date.now()}`,
      nameEn: nameEn.trim(),
      nameHi: nameHi.trim() || nameEn.trim(),
      isCustom: true,
    };
    setCategories((prev) => {
      const next = [...prev, newCat];
      saveCustomCategories(next);
      return next;
    });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id || !c.isCustom);
      saveCustomCategories(next);
      return next;
    });
  }, []);

  const addCustomPhrase = useCallback((categoryId: string, textEn: string, textHi: string) => {
    const item: PhraseItem = {
      id: `phr_${Date.now()}`,
      categoryId,
      textEn: textEn.trim(),
      textHi: textHi.trim() || textEn.trim(),
      isCustom: true,
      isFavorite: false,
    };
    setPhrases((prev) => {
      const next = [...prev, item];
      saveCustomPhrases(next);
      return next;
    });
  }, []);

  const updatePhrase = useCallback((id: string, textEn: string, textHi: string) => {
    setPhrases((prev) => {
      const next = prev.map((p) =>
        p.id === id
          ? {
              ...p,
              textEn: textEn.trim(),
              textHi: textHi.trim() || textEn.trim(),
              isCustom: p.isCustom ?? true,
            }
          : p
      );
      saveCustomPhrases(next.filter((p) => p.isCustom));
      return next;
    });
  }, []);

  const deletePhrase = useCallback((id: string) => {
    setPhrases((prev) => {
      const next = prev.filter((p) => p.id !== id || !p.isCustom);
      saveCustomPhrases(next);
      return next;
    });
  }, []);

  const toggleFavoritePhrase = useCallback((id: string) => {
    const favIds = new Set(loadFavoriteIds());
    if (favIds.has(id)) {
      favIds.delete(id);
    } else {
      favIds.add(id);
    }
    saveFavoriteIds(Array.from(favIds));
    setPhrases((prev) => prev.map((p) => ({ ...p, isFavorite: favIds.has(p.id) })));
  }, []);

  const recordRecentPhrase = useCallback((text: string) => {
    const next = pushRecentPhrase(text);
    setRecentPhrases(next);
  }, []);

  const recordCommunication = useCallback(
    (text: string, spoken: boolean) => {
      const clean = text.trim();
      if (!clean) return;
      recordRecentPhrase(clean);
      if (!settings.privacy.historyConsentEnabled) return;
      const entry: CommunicationHistoryEntry = {
        id: `hist_${Date.now()}`,
        text: clean,
        language: settings.communication.language,
        timestamp: new Date().toISOString(),
        spoken,
      };
      const next = appendCommunicationHistory(entry, true);
      setHistory(next);
    },
    [recordRecentPhrase, settings.communication.language, settings.privacy.historyConsentEnabled]
  );

  const deleteHistoryEntry = useCallback((id: string) => {
    const next = deleteCommunicationHistoryEntry(id);
    setHistory(next);
  }, []);

  const clearHistory = useCallback(() => {
    clearAllCommunicationHistory();
    setHistory([]);
  }, []);

  const resetAllAppData = useCallback(() => {
    clearAllLocalData();
    setSettings(DEFAULT_SETTINGS);
    setCalibration(null);
    setProfile(DEFAULT_PROFILE);
    setCategories(DEFAULT_CATEGORIES);
    setPhrases(DEFAULT_PHRASES);
    setRecentPhrases([]);
    setHistory([]);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        settings,
        updateSettings,
        setLanguage,
        calibration,
        setCalibrationProfile,
        clearCalibrationProfile,
        profile,
        updateProfile,
        categories,
        addCategory,
        deleteCategory,
        phrases,
        addCustomPhrase,
        updatePhrase,
        deletePhrase,
        toggleFavoritePhrase,
        recentPhrases,
        recordRecentPhrase,
        history,
        recordCommunication,
        deleteHistoryEntry,
        clearHistory,
        resetAllAppData,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
