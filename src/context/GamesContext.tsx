import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAppState } from './AppStateContext';
import {
  createDefaultGamesState,
  loadGamesState,
  saveGamesState,
} from '../features/storage/games-music-storage';
import {
  processImageFileToDataUrl,
  savePatientImage,
} from '../features/storage/indexeddb-media';
import type {
  GameDifficulty,
  GameId,
  GamesPatientState,
} from '../types';

interface GamesContextValue {
  gamesState: GamesPatientState;
  setSaveActivityEnabled: (enabled: boolean) => void;
  setPreferredDifficulty: (difficulty: GameDifficulty) => void;
  setAudioInstructionsEnabled: (enabled: boolean) => void;
  recordGameResult: (params: {
    gameId: GameId;
    outcome: 'win' | 'loss' | 'draw' | 'completed';
    difficulty: GameDifficulty;
    moves: number;
    summary: string;
    puzzleSolved?: boolean;
  }) => void;
  clearGameHistory: () => void;
  addCustomMemoryCard: (label: string, file: File) => Promise<{ ok: boolean; error?: string }>;
  removeCustomMemoryCard: (id: string) => void;
  addCustomPuzzlePhoto: (file: File) => Promise<{ ok: boolean; assetId?: string; error?: string }>;
  removeCustomPuzzlePhoto: (assetId: string) => void;
}

const GamesContext = createContext<GamesContextValue | null>(null);

export const GamesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activePatientId } = useAppState();
  const [gamesState, setGamesState] = useState<GamesPatientState>(() =>
    loadGamesState(activePatientId)
  );

  useEffect(() => {
    setGamesState(loadGamesState(activePatientId));
  }, [activePatientId]);

  const updateAndPersist = useCallback(
    (updater: (prev: GamesPatientState) => GamesPatientState) => {
      setGamesState((prev) => {
        const next = updater(prev);
        saveGamesState(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const setSaveActivityEnabled = useCallback(
    (enabled: boolean) => {
      updateAndPersist((prev) => ({
        ...prev,
        saveActivityEnabled: enabled,
      }));
    },
    [updateAndPersist]
  );

  const setPreferredDifficulty = useCallback(
    (difficulty: GameDifficulty) => {
      updateAndPersist((prev) => ({
        ...prev,
        preferredDifficulty: difficulty,
      }));
    },
    [updateAndPersist]
  );

  const setAudioInstructionsEnabled = useCallback(
    (enabled: boolean) => {
      updateAndPersist((prev) => ({
        ...prev,
        audioInstructionsEnabled: enabled,
      }));
    },
    [updateAndPersist]
  );

  const recordGameResult = useCallback(
    (params: {
      gameId: GameId;
      outcome: 'win' | 'loss' | 'draw' | 'completed';
      difficulty: GameDifficulty;
      moves: number;
      summary: string;
      puzzleSolved?: boolean;
    }) => {
      setGamesState((prev) => {
        if (!prev.saveActivityEnabled) {
          return prev;
        }
        const nowIso = new Date().toISOString();
        const existingScore = prev.scores[params.gameId];
        const prevBest = existingScore.bestMoves;
        const nextBest =
          (params.outcome === 'win' || params.outcome === 'completed') && params.moves > 0
            ? prevBest === undefined
              ? params.moves
              : Math.min(prevBest, params.moves)
            : prevBest;

        const next: GamesPatientState = {
          ...prev,
          scores: {
            ...prev.scores,
            [params.gameId]: {
              ...existingScore,
              wins: existingScore.wins + (params.outcome === 'win' ? 1 : 0),
              losses: existingScore.losses + (params.outcome === 'loss' ? 1 : 0),
              draws: existingScore.draws + (params.outcome === 'draw' ? 1 : 0),
              gamesPlayed: existingScore.gamesPlayed + 1,
              bestMoves: nextBest,
              puzzlesSolved: existingScore.puzzlesSolved + (params.puzzleSolved ? 1 : 0),
              lastPlayedAt: nowIso,
            },
          },
          history: [
            {
              id: `gh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              gameId: params.gameId,
              summary: params.summary,
              outcome: params.outcome,
              difficulty: params.difficulty,
              moves: params.moves,
              timestamp: nowIso,
            },
            ...prev.history,
          ].slice(0, 80),
        };
        saveGamesState(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const clearGameHistory = useCallback(() => {
    updateAndPersist((prev) => {
      const defaults = createDefaultGamesState();
      return {
        ...prev,
        scores: defaults.scores,
        history: [],
      };
    });
  }, [updateAndPersist]);

  const addCustomMemoryCard = useCallback(
    async (label: string, file: File): Promise<{ ok: boolean; error?: string }> => {
      const cleanLabel = label.trim().slice(0, 40);
      if (!cleanLabel) return { ok: false, error: 'Please enter a short label for this card.' };
      try {
        const dataUrl = await processImageFileToDataUrl(file);
        const assetId = `gmem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await savePatientImage(activePatientId, assetId, dataUrl);
        updateAndPersist((prev) => ({
          ...prev,
          customMemoryCards: [
            ...prev.customMemoryCards,
            { id: assetId, label: cleanLabel, assetId },
          ].slice(0, 12),
        }));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to save custom card picture.',
        };
      }
    },
    [activePatientId, updateAndPersist]
  );

  const removeCustomMemoryCard = useCallback(
    (id: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        customMemoryCards: prev.customMemoryCards.filter((c) => c.id !== id),
      }));
    },
    [updateAndPersist]
  );

  const addCustomPuzzlePhoto = useCallback(
    async (file: File): Promise<{ ok: boolean; assetId?: string; error?: string }> => {
      try {
        const dataUrl = await processImageFileToDataUrl(file);
        const assetId = `gpuz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await savePatientImage(activePatientId, assetId, dataUrl);
        updateAndPersist((prev) => ({
          ...prev,
          customPuzzlePhotoIds: [assetId, ...prev.customPuzzlePhotoIds].slice(0, 6),
        }));
        return { ok: true, assetId };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to save puzzle photo.',
        };
      }
    },
    [activePatientId, updateAndPersist]
  );

  const removeCustomPuzzlePhoto = useCallback(
    (assetId: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        customPuzzlePhotoIds: prev.customPuzzlePhotoIds.filter((id) => id !== assetId),
      }));
    },
    [updateAndPersist]
  );

  const value = useMemo<GamesContextValue>(
    () => ({
      gamesState,
      setSaveActivityEnabled,
      setPreferredDifficulty,
      setAudioInstructionsEnabled,
      recordGameResult,
      clearGameHistory,
      addCustomMemoryCard,
      removeCustomMemoryCard,
      addCustomPuzzlePhoto,
      removeCustomPuzzlePhoto,
    }),
    [
      addCustomMemoryCard,
      addCustomPuzzlePhoto,
      clearGameHistory,
      gamesState,
      recordGameResult,
      removeCustomMemoryCard,
      removeCustomPuzzlePhoto,
      setAudioInstructionsEnabled,
      setPreferredDifficulty,
      setSaveActivityEnabled,
    ]
  );

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
};

export function useGames(): GamesContextValue {
  const ctx = useContext(GamesContext);
  if (!ctx) throw new Error('useGames must be used inside GamesProvider');
  return ctx;
}
