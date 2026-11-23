import type {
  GameId,
  GameScoreSummary,
  GamesPatientState,
  MusicCategoryId,
  MusicPatientState,
} from '../../types';
import { getActivePatientId, getPatientScopedStorageKey } from './patient-accounts';

const GAMES_STORAGE_KEY = 'nayanSathi.games.v1';
const MUSIC_STORAGE_KEY = 'nayanSathi.music.v1';

export const MUSIC_CATEGORIES: {
  id: MusicCategoryId;
  labelEn: string;
  labelHi: string;
  description: string;
}[] = [
  { id: 'hindi_songs', labelEn: 'Hindi Songs', labelHi: 'हिंदी गीत', description: 'Uploaded Bollywood, melodic, and Hindi vocal tracks' },
  { id: 'english_songs', labelEn: 'English Songs', labelHi: 'अंग्रेज़ी गीत', description: 'English vocal, acoustic, and contemporary tracks' },
  { id: 'devotional', labelEn: 'Devotional Music', labelHi: 'भक्ति संगीत', description: 'Bhajans, hymns, chants, and prayers' },
  { id: 'instrumental', labelEn: 'Instrumental Music', labelHi: 'वाद्य संगीत', description: 'Flute, sitar, piano, guitar, and instrumental pieces' },
  { id: 'classical', labelEn: 'Classical Music', labelHi: 'शास्त्रीय संगीत', description: 'Hindustani, Carnatic, and Western classical pieces' },
  { id: 'relaxing', labelEn: 'Relaxing Music', labelHi: 'आरामदायक संगीत', description: 'Calm ambient tracks for quiet listening' },
  { id: 'nature_sounds', labelEn: 'Nature Sounds', labelHi: 'प्रकृति की ध्वनियाँ', description: 'Rain, ocean waves, forest birds, and stream sounds' },
  { id: 'personal_recordings', labelEn: 'Personal Recordings', labelHi: 'व्यक्तिगत रिकॉर्डिंग', description: 'Voice messages, family songs, and personal clips' },
  { id: 'custom_music', labelEn: 'Custom Music', labelHi: 'कस्टम संगीत', description: 'Your own personal audio collections' },
];

export const NATURE_SOUND_PREFERENCE_TAGS = [
  'Rain',
  'Ocean Waves',
  'Forest Birds',
  'Flowing Stream',
  'Gentle Wind',
  'Night Crickets',
];

function emptyScore(): GameScoreSummary {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    gamesPlayed: 0,
    puzzlesSolved: 0,
  };
}

export function createDefaultGamesState(): GamesPatientState {
  const scores: Record<GameId, GameScoreSummary> = {
    'tic-tac-toe': emptyScore(),
    chess: emptyScore(),
    'memory-match': emptyScore(),
    'picture-puzzle': emptyScore(),
    'word-guess': emptyScore(),
    'connect-four': emptyScore(),
    'pattern-sequence': emptyScore(),
  };

  return {
    saveActivityEnabled: true,
    preferredDifficulty: 'easy',
    audioInstructionsEnabled: true,
    customPuzzlePhotoIds: [],
    customMemoryCards: [],
    scores,
    history: [],
  };
}

export function loadGamesState(patientId = getActivePatientId()): GamesPatientState {
  const defaults = createDefaultGamesState();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(getPatientScopedStorageKey(GAMES_STORAGE_KEY, patientId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GamesPatientState>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    const mergedScores = { ...defaults.scores };
    if (parsed.scores && typeof parsed.scores === 'object') {
      (Object.keys(defaults.scores) as GameId[]).forEach((gid) => {
        if (parsed.scores?.[gid]) {
          mergedScores[gid] = { ...emptyScore(), ...parsed.scores[gid] };
        }
      });
    }

    return {
      saveActivityEnabled:
        typeof parsed.saveActivityEnabled === 'boolean'
          ? parsed.saveActivityEnabled
          : defaults.saveActivityEnabled,
      preferredDifficulty:
        parsed.preferredDifficulty === 'medium' || parsed.preferredDifficulty === 'hard'
          ? parsed.preferredDifficulty
          : 'easy',
      audioInstructionsEnabled:
        typeof parsed.audioInstructionsEnabled === 'boolean'
          ? parsed.audioInstructionsEnabled
          : defaults.audioInstructionsEnabled,
      customPuzzlePhotoIds: Array.isArray(parsed.customPuzzlePhotoIds)
        ? parsed.customPuzzlePhotoIds
        : [],
      customMemoryCards: Array.isArray(parsed.customMemoryCards) ? parsed.customMemoryCards : [],
      scores: mergedScores,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return defaults;
  }
}

export function saveGamesState(
  state: GamesPatientState,
  patientId = getActivePatientId()
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(GAMES_STORAGE_KEY, patientId),
      JSON.stringify(state)
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to save games state.',
    };
  }
}

export function eraseGamesState(patientId = getActivePatientId()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getPatientScopedStorageKey(GAMES_STORAGE_KEY, patientId));
}

export function createDefaultMusicState(): MusicPatientState {
  return {
    tracks: [],
    favouriteTrackIds: [],
    playlists: [],
    recentlyPlayed: [],
    preferences: {
      favouriteGenres: [],
      favouriteArtists: [],
      preferredPlaylistIds: [],
      favouriteNatureSounds: [],
      trackRecentlyPlayed: true,
      defaultVolume: 0.8,
      repeatMode: 'off',
      shuffleEnabled: false,
    },
  };
}

export function loadMusicState(patientId = getActivePatientId()): MusicPatientState {
  const defaults = createDefaultMusicState();
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(getPatientScopedStorageKey(MUSIC_STORAGE_KEY, patientId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MusicPatientState>;
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
      favouriteTrackIds: Array.isArray(parsed.favouriteTrackIds) ? parsed.favouriteTrackIds : [],
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
      recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed : [],
      preferences: {
        ...defaults.preferences,
        ...(parsed.preferences || {}),
        favouriteGenres: Array.isArray(parsed.preferences?.favouriteGenres)
          ? parsed.preferences.favouriteGenres
          : [],
        favouriteArtists: Array.isArray(parsed.preferences?.favouriteArtists)
          ? parsed.preferences.favouriteArtists
          : [],
        preferredPlaylistIds: Array.isArray(parsed.preferences?.preferredPlaylistIds)
          ? parsed.preferences.preferredPlaylistIds
          : [],
        favouriteNatureSounds: Array.isArray(parsed.preferences?.favouriteNatureSounds)
          ? parsed.preferences.favouriteNatureSounds
          : [],
      },
    };
  } catch {
    return defaults;
  }
}

export function saveMusicState(
  state: MusicPatientState,
  patientId = getActivePatientId()
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(
      getPatientScopedStorageKey(MUSIC_STORAGE_KEY, patientId),
      JSON.stringify(state)
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to save music state.',
    };
  }
}

export function eraseMusicState(patientId = getActivePatientId()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getPatientScopedStorageKey(MUSIC_STORAGE_KEY, patientId));
}
