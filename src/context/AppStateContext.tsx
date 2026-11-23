import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  AppSettings,
  CalibrationProfile,
  CommunicationHistoryEntry,
  Language,
  PatientAccountSummary,
  PatientProfile,
  PhraseCategory,
  PhraseItem,
} from '../types';
import {
  appendCommunicationHistory,
  clearAllCommunicationHistory,
  clearPatientStorageKeys,
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
import {
  ACTIVE_PATIENT_CHANGED_EVENT,
  createPatientAccount,
  getActivePatientId,
  listPatientAccounts,
  removePatientAccountFromDirectory,
  setActivePatientId,
  updatePatientAccountDisplayName,
} from '../features/storage/patient-accounts';
import { eraseLifeHubState } from '../features/storage/life-hub-storage';
import { deleteAllImagesForPatient } from '../features/storage/indexeddb-media';
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from '../features/communication/phrase-library';

interface AppStateContextValue {
  activePatientId: string;
  patientAccounts: PatientAccountSummary[];
  switchPatient: (patientId: string) => void;
  createNewPatient: (displayName: string) => PatientAccountSummary;
  deleteActivePatientAccount: () => Promise<void>;
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
  const [activePatientId, setActivePatientIdState] = useState<string>(() => getActivePatientId());
  const [patientAccounts, setPatientAccounts] = useState<PatientAccountSummary[]>(() =>
    listPatientAccounts()
  );

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(activePatientId));
  const [calibration, setCalibration] = useState<CalibrationProfile | null>(() =>
    loadCalibration(activePatientId)
  );
  const [profile, setProfile] = useState<PatientProfile>(() =>
    loadPatientProfile(activePatientId)
  );
  const [categories, setCategories] = useState<PhraseCategory[]>(() =>
    loadCategories(activePatientId)
  );
  const [phrases, setPhrases] = useState<PhraseItem[]>(() => loadPhrases(activePatientId));
  const [recentPhrases, setRecentPhrases] = useState<string[]>(() =>
    loadRecentPhrases(activePatientId)
  );
  const [history, setHistory] = useState<CommunicationHistoryEntry[]>(() =>
    loadCommunicationHistory(activePatientId)
  );

  const reloadForPatient = useCallback((patientId: string) => {
    setActivePatientIdState(patientId);
    setPatientAccounts(listPatientAccounts());
    setSettings(loadSettings(patientId));
    setCalibration(loadCalibration(patientId));
    setProfile(loadPatientProfile(patientId));
    setCategories(loadCategories(patientId));
    setPhrases(loadPhrases(patientId));
    setRecentPhrases(loadRecentPhrases(patientId));
    setHistory(loadCommunicationHistory(patientId));
  }, []);

  useEffect(() => {
    const onPatientChanged = (e: Event) => {
      const custom = e as CustomEvent<{ patientId?: string }>;
      const nextId = custom.detail?.patientId || getActivePatientId();
      reloadForPatient(nextId);
    };
    window.addEventListener(ACTIVE_PATIENT_CHANGED_EVENT, onPatientChanged);
    return () => window.removeEventListener(ACTIVE_PATIENT_CHANGED_EVENT, onPatientChanged);
  }, [reloadForPatient]);

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

  const switchPatient = useCallback(
    (patientId: string) => {
      setActivePatientId(patientId);
      reloadForPatient(patientId);
    },
    [reloadForPatient]
  );

  const createNewPatient = useCallback(
    (displayName: string): PatientAccountSummary => {
      const created = createPatientAccount(displayName);
      savePatientProfile(
        {
          ...DEFAULT_PROFILE,
          name: created.displayName,
          preferredName: created.displayName.split(' ')[0] || created.displayName,
          onboardingCompleted: true,
        },
        created.id
      );
      reloadForPatient(created.id);
      return created;
    },
    [reloadForPatient]
  );

  const deleteActivePatientAccount = useCallback(async () => {
    const doomedId = activePatientId;
    clearPatientStorageKeys(doomedId);
    eraseLifeHubState(doomedId);
    await deleteAllImagesForPatient(doomedId);
    const nextId = removePatientAccountFromDirectory(doomedId);
    reloadForPatient(nextId);
  }, [activePatientId, reloadForPatient]);

  const updateSettings = useCallback(
    (updater: (prev: AppSettings) => AppSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        saveSettings(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      updateSettings((prev) => ({
        ...prev,
        communication: { ...prev.communication, language: lang },
      }));
    },
    [updateSettings]
  );

  const setCalibrationProfile = useCallback(
    (cal: CalibrationProfile) => {
      setCalibration(cal);
      saveCalibration(cal, activePatientId);
    },
    [activePatientId]
  );

  const clearCalibrationProfile = useCallback(() => {
    setCalibration(null);
    eraseCalibration(activePatientId);
  }, [activePatientId]);

  const updateProfile = useCallback(
    (updater: (prev: PatientProfile) => PatientProfile) => {
      setProfile((prev) => {
        const next = updater(prev);
        savePatientProfile(next, activePatientId);
        if (next.name?.trim()) {
          updatePatientAccountDisplayName(activePatientId, next.name);
          setPatientAccounts(listPatientAccounts());
        }
        return next;
      });
    },
    [activePatientId]
  );

  const addCategory = useCallback(
    (nameEn: string, nameHi: string) => {
      const newCat: PhraseCategory = {
        id: `cat_${Date.now()}`,
        nameEn: nameEn.trim(),
        nameHi: nameHi.trim() || nameEn.trim(),
        isCustom: true,
      };
      setCategories((prev) => {
        const next = [...prev, newCat];
        saveCustomCategories(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      setCategories((prev) => {
        const next = prev.filter((c) => c.id !== id || !c.isCustom);
        saveCustomCategories(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const addCustomPhrase = useCallback(
    (categoryId: string, textEn: string, textHi: string) => {
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
        saveCustomPhrases(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const updatePhrase = useCallback(
    (id: string, textEn: string, textHi: string) => {
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
        saveCustomPhrases(
          next.filter((p) => p.isCustom),
          activePatientId
        );
        return next;
      });
    },
    [activePatientId]
  );

  const deletePhrase = useCallback(
    (id: string) => {
      setPhrases((prev) => {
        const next = prev.filter((p) => p.id !== id || !p.isCustom);
        saveCustomPhrases(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const toggleFavoritePhrase = useCallback(
    (id: string) => {
      const favIds = new Set(loadFavoriteIds(activePatientId));
      if (favIds.has(id)) {
        favIds.delete(id);
      } else {
        favIds.add(id);
      }
      saveFavoriteIds(Array.from(favIds), activePatientId);
      setPhrases((prev) => prev.map((p) => ({ ...p, isFavorite: favIds.has(p.id) })));
    },
    [activePatientId]
  );

  const recordRecentPhrase = useCallback(
    (text: string) => {
      const next = pushRecentPhrase(text, activePatientId);
      setRecentPhrases(next);
    },
    [activePatientId]
  );

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
      const next = appendCommunicationHistory(entry, true, activePatientId);
      setHistory(next);
    },
    [
      activePatientId,
      recordRecentPhrase,
      settings.communication.language,
      settings.privacy.historyConsentEnabled,
    ]
  );

  const deleteHistoryEntry = useCallback(
    (id: string) => {
      const next = deleteCommunicationHistoryEntry(id, activePatientId);
      setHistory(next);
    },
    [activePatientId]
  );

  const clearHistory = useCallback(() => {
    clearAllCommunicationHistory(activePatientId);
    setHistory([]);
  }, [activePatientId]);

  const resetAllAppData = useCallback(() => {
    clearPatientStorageKeys(activePatientId);
    eraseLifeHubState(activePatientId);
    void deleteAllImagesForPatient(activePatientId);
    setSettings(DEFAULT_SETTINGS);
    setCalibration(null);
    setProfile(DEFAULT_PROFILE);
    setCategories(DEFAULT_CATEGORIES);
    setPhrases(DEFAULT_PHRASES);
    setRecentPhrases([]);
    setHistory([]);
  }, [activePatientId]);

  return (
    <AppStateContext.Provider
      value={{
        activePatientId,
        patientAccounts,
        switchPatient,
        createNewPatient,
        deleteActivePatientAccount,
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
