import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppState } from './AppStateContext';
import {
  deletePatientAudioBlob,
  loadPatientAudioBlob,
  probeAudioDurationSec,
  savePatientAudioBlob,
  validateAudioFileForBrowser,
} from '../features/storage/indexeddb-audio';
import {
  processImageFileToDataUrl,
  savePatientImage,
} from '../features/storage/indexeddb-media';
import {
  AMBIENT_SOUNDSCAPES,
  ambientSoundEngine,
  type AmbientSoundId,
} from '../features/music/ambient-synth';
import {
  loadMusicState,
  saveMusicState,
} from '../features/storage/games-music-storage';
import type {
  MusicCategoryId,
  MusicPatientState,
  MusicPreferences,
  MusicRepeatMode,
  MusicTrack,
} from '../types';

interface UploadTrackParams {
  file: File;
  title: string;
  artist: string;
  album: string;
  category: MusicCategoryId;
  coverFile?: File | null;
  authorizedConfirmed: boolean;
}

interface MusicContextValue {
  musicState: MusicPatientState;
  currentTrack: MusicTrack | null;
  queueTrackIds: string[];
  isPlaying: boolean;
  isLoadingTrack: boolean;
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  playbackError: string | null;
  activeAmbientId: AmbientSoundId | null;
  isAmbientPlaying: boolean;
  clearPlaybackError: () => void;
  playTrack: (trackId: string, queueIds?: string[]) => Promise<void>;
  playAmbientSound: (id: AmbientSoundId) => void;
  toggleAmbientPlayPause: () => void;
  stopAmbientSound: () => void;
  togglePlayPause: () => Promise<void>;
  pausePlayback: () => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  toggleFavouriteTrack: (trackId: string) => void;
  uploadAudioTrack: (params: UploadTrackParams) => Promise<{ ok: boolean; track?: MusicTrack; error?: string }>;
  removeTrack: (trackId: string) => Promise<void>;
  createPlaylist: (name: string) => { ok: boolean; id?: string; error?: string };
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  updateMusicPreferences: (updater: (prev: MusicPreferences) => MusicPreferences) => void;
  clearRecentlyPlayed: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activePatientId } = useAppState();
  const [musicState, setMusicState] = useState<MusicPatientState>(() =>
    loadMusicState(activePatientId)
  );

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolumeState] = useState<number>(() =>
    loadMusicState(activePatientId).preferences.defaultVolume
  );
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [activeAmbientId, setActiveAmbientId] = useState<AmbientSoundId | null>(null);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const musicStateRef = useRef(musicState);
  musicStateRef.current = musicState;
  const currentTrackIdRef = useRef(currentTrackId);
  currentTrackIdRef.current = currentTrackId;
  const queueRef = useRef(queueTrackIds);
  queueRef.current = queueTrackIds;

  const updateAndPersist = useCallback(
    (updater: (prev: MusicPatientState) => MusicPatientState) => {
      setMusicState((prev) => {
        const next = updater(prev);
        saveMusicState(next, activePatientId);
        return next;
      });
    },
    [activePatientId]
  );

  const revokeObjectUrl = useCallback(() => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
  }, []);

  // Reload isolated patient music library & reset playback when patient switches
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    ambientSoundEngine.stop();
    revokeObjectUrl();
    const loaded = loadMusicState(activePatientId);
    setMusicState(loaded);
    setCurrentTrackId(null);
    setQueueTrackIds([]);
    setIsPlaying(false);
    setActiveAmbientId(null);
    setIsAmbientPlaying(false);
    setCurrentTimeSec(0);
    setDurationSec(0);
    setVolumeState(loaded.preferences.defaultVolume);
    setPlaybackError(null);
  }, [activePatientId, revokeObjectUrl]);

  const recordRecentPlay = useCallback(
    (trackId: string) => {
      updateAndPersist((prev) => {
        if (!prev.preferences.trackRecentlyPlayed) return prev;
        const filtered = prev.recentlyPlayed.filter((r) => r.trackId !== trackId);
        return {
          ...prev,
          recentlyPlayed: [{ trackId, playedAt: new Date().toISOString() }, ...filtered].slice(
            0,
            25
          ),
        };
      });
    },
    [updateAndPersist]
  );

  const loadAndPlayTrackInternal = useCallback(
    async (track: MusicTrack) => {
      const audio = audioRef.current;
      if (!audio) {
        setPlaybackError('Audio playback is unavailable in this browser environment.');
        return;
      }

      setIsLoadingTrack(true);
      setPlaybackError(null);

      try {
        const stored = await loadPatientAudioBlob(activePatientId, track.audioAssetId);
        if (!stored) {
          setIsLoadingTrack(false);
          setIsPlaying(false);
          setPlaybackError(
            `Audio file for "${track.title}" could not be found in local storage. Please re-upload the track.`
          );
          return;
        }

        if (typeof audio.canPlayType === 'function' && stored.mimeType) {
          if (audio.canPlayType(stored.mimeType) === '') {
            setIsLoadingTrack(false);
            setIsPlaying(false);
            setPlaybackError(
              `This browser does not support playing "${stored.mimeType}" audio.`
            );
            return;
          }
        }

        revokeObjectUrl();
        const url = URL.createObjectURL(stored.blob);
        currentObjectUrlRef.current = url;
        audio.src = url;
        audio.currentTime = 0;
        audio.volume = isMuted ? 0 : volume;

        setCurrentTrackId(track.id);
        setCurrentTimeSec(0);
        setDurationSec(track.durationSec || 0);

        await audio.play();
        setIsPlaying(true);
        setIsLoadingTrack(false);
        recordRecentPlay(track.id);
      } catch (err) {
        setIsLoadingTrack(false);
        setIsPlaying(false);
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError') {
          setPlaybackError(
            'Browser blocked audio playback until you press Play directly.'
          );
        } else if (name === 'NotSupportedError') {
          setPlaybackError('Unsupported audio format for this browser.');
        } else {
          setPlaybackError(
            err instanceof Error ? `Playback error: ${err.message}` : 'Unable to play this track.'
          );
        }
      }
    },
    [activePatientId, isMuted, recordRecentPlay, revokeObjectUrl, volume]
  );

  const pickAdjacentTrack = useCallback(
    (direction: 'next' | 'prev', fromEnded = false): MusicTrack | null => {
      const st = musicStateRef.current;
      const listIds =
        queueRef.current.length > 0 ? queueRef.current : st.tracks.map((t) => t.id);
      const validTracks = listIds
        .map((id) => st.tracks.find((t) => t.id === id))
        .filter((t): t is MusicTrack => Boolean(t));

      if (validTracks.length === 0) return null;

      const curIdx = validTracks.findIndex((t) => t.id === currentTrackIdRef.current);
      if (curIdx === -1) return validTracks[0];

      if (fromEnded && st.preferences.repeatMode === 'one') {
        return validTracks[curIdx];
      }

      if (st.preferences.shuffleEnabled && validTracks.length > 1) {
        const candidates = validTracks.filter((_, idx) => idx !== curIdx);
        return candidates[Math.floor(Math.random() * candidates.length)] || validTracks[0];
      }

      if (direction === 'next') {
        if (curIdx + 1 < validTracks.length) return validTracks[curIdx + 1];
        return st.preferences.repeatMode === 'all' || !fromEnded ? validTracks[0] : null;
      }

      if (curIdx - 1 >= 0) return validTracks[curIdx - 1];
      return validTracks[validTracks.length - 1];
    },
    []
  );

  // Initialize single persistent browser Audio element once
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTimeSec(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDurationSec(audio.duration);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onStalled = () =>
      setPlaybackError('Audio stream interrupted or stalled. Press Play to retry.');
    const onError = () => {
      setIsPlaying(false);
      setIsLoadingTrack(false);
      setPlaybackError('Audio file could not be decoded or playback failed.');
    };
    const onEnded = () => {
      const next = pickAdjacentTrack('next', true);
      if (next) {
        void loadAndPlayTrackInternal(next);
      } else {
        setIsPlaying(false);
        setCurrentTimeSec(0);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      ambientSoundEngine.stop();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      revokeObjectUrl();
    };
  }, [loadAndPlayTrackInternal, pickAdjacentTrack, revokeObjectUrl]);

  useEffect(() => {
    const effective = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = effective;
    }
    ambientSoundEngine.setVolume(effective);
  }, [volume, isMuted]);

  const stopAmbientSound = useCallback(() => {
    ambientSoundEngine.stop();
    setActiveAmbientId(null);
    setIsAmbientPlaying(false);
  }, []);

  const playAmbientSound = useCallback(
    (id: AmbientSoundId) => {
      // Pause track playback before starting ambient soundscape
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      const effectiveVol = isMuted ? 0 : volume;
      const res = ambientSoundEngine.start(id, effectiveVol);
      if (!res.ok) {
        setPlaybackError(res.error || 'Could not start relaxing audio.');
        return;
      }
      setPlaybackError(null);
      setActiveAmbientId(id);
      setIsAmbientPlaying(true);
    },
    [isMuted, volume]
  );

  const toggleAmbientPlayPause = useCallback(() => {
    if (!activeAmbientId) {
      playAmbientSound(AMBIENT_SOUNDSCAPES[0].id);
      return;
    }
    if (isAmbientPlaying) {
      ambientSoundEngine.stop();
      setIsAmbientPlaying(false);
    } else {
      const res = ambientSoundEngine.start(activeAmbientId, isMuted ? 0 : volume);
      if (res.ok) setIsAmbientPlaying(true);
    }
  }, [activeAmbientId, isAmbientPlaying, isMuted, playAmbientSound, volume]);

  const playTrack = useCallback(
    async (trackId: string, queueIds?: string[]) => {
      const track = musicStateRef.current.tracks.find((t) => t.id === trackId);
      if (!track) {
        setPlaybackError('Selected track could not be found.');
        return;
      }
      ambientSoundEngine.stop();
      setActiveAmbientId(null);
      setIsAmbientPlaying(false);
      if (queueIds && queueIds.length > 0) {
        setQueueTrackIds(queueIds);
      } else if (queueRef.current.length === 0) {
        setQueueTrackIds(musicStateRef.current.tracks.map((t) => t.id));
      }
      await loadAndPlayTrackInternal(track);
    },
    [loadAndPlayTrackInternal]
  );

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrackIdRef.current) {
      const first = musicStateRef.current.tracks[0];
      if (first) {
        await playTrack(first.id);
      } else {
        setPlaybackError('Upload an audio file first to start playback.');
      }
      return;
    }

    if (audio.paused) {
      try {
        setPlaybackError(null);
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        setPlaybackError(
          err instanceof Error ? `Could not resume playback: ${err.message}` : 'Playback blocked.'
        );
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [playTrack]);

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const nextTrack = useCallback(async () => {
    const next = pickAdjacentTrack('next', false);
    if (next) {
      await loadAndPlayTrackInternal(next);
    }
  }, [loadAndPlayTrackInternal, pickAdjacentTrack]);

  const previousTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTimeSec(0);
      return;
    }
    const prev = pickAdjacentTrack('prev', false);
    if (prev) {
      await loadAndPlayTrackInternal(prev);
    }
  }, [loadAndPlayTrackInternal, pickAdjacentTrack]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maxDur = Number.isFinite(audio.duration) ? audio.duration : durationSec;
    const clamped = Math.max(0, Math.min(maxDur || 0, seconds));
    audio.currentTime = clamped;
    setCurrentTimeSec(clamped);
  }, [durationSec]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const cur = audioRef.current ? audioRef.current.currentTime : currentTimeSec;
      seekTo(cur + deltaSeconds);
    },
    [currentTimeSec, seekTo]
  );

  const setVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      setVolumeState(clamped);
      if (clamped > 0 && isMuted) setIsMuted(false);
      updateAndPersist((prev) => ({
        ...prev,
        preferences: { ...prev.preferences, defaultVolume: clamped },
      }));
    },
    [isMuted, updateAndPersist]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const order: MusicRepeatMode[] = ['off', 'all', 'one'];
    updateAndPersist((prev) => {
      const idx = order.indexOf(prev.preferences.repeatMode);
      const nextMode = order[(idx + 1) % order.length];
      return {
        ...prev,
        preferences: { ...prev.preferences, repeatMode: nextMode },
      };
    });
  }, [updateAndPersist]);

  const toggleShuffle = useCallback(() => {
    updateAndPersist((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, shuffleEnabled: !prev.preferences.shuffleEnabled },
    }));
  }, [updateAndPersist]);

  const toggleFavouriteTrack = useCallback(
    (trackId: string) => {
      updateAndPersist((prev) => {
        const exists = prev.favouriteTrackIds.includes(trackId);
        return {
          ...prev,
          favouriteTrackIds: exists
            ? prev.favouriteTrackIds.filter((id) => id !== trackId)
            : [trackId, ...prev.favouriteTrackIds],
        };
      });
    },
    [updateAndPersist]
  );

  const uploadAudioTrack = useCallback(
    async (
      params: UploadTrackParams
    ): Promise<{ ok: boolean; track?: MusicTrack; error?: string }> => {
      if (!params.authorizedConfirmed) {
        return {
          ok: false,
          error: 'Please confirm that you are permitted/authorized to upload and listen to this audio file.',
        };
      }
      const cleanTitle = params.title.trim().slice(0, 120);
      if (!cleanTitle) {
        return { ok: false, error: 'Please enter a track title.' };
      }

      const check = validateAudioFileForBrowser(params.file);
      if (!check.ok) {
        return { ok: false, error: check.error };
      }

      try {
        const audioAssetId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await savePatientAudioBlob(activePatientId, audioAssetId, params.file, check.mimeType);
        const dur = await probeAudioDurationSec(params.file);

        let coverAssetId: string | undefined;
        if (params.coverFile) {
          const dataUrl = await processImageFileToDataUrl(params.coverFile);
          coverAssetId = `cov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await savePatientImage(activePatientId, coverAssetId, dataUrl);
        }

        const track: MusicTrack = {
          id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: cleanTitle,
          artist: params.artist.trim().slice(0, 80) || 'Personal Upload',
          album: params.album.trim().slice(0, 80) || 'My Library',
          category: params.category,
          audioAssetId,
          coverAssetId,
          durationSec: dur,
          mimeType: check.mimeType,
          fileSizeBytes: params.file.size,
          authorizedConfirmed: true,
          sourceType: 'uploaded_local',
          createdAt: new Date().toISOString(),
        };

        updateAndPersist((prev) => ({
          ...prev,
          tracks: [track, ...prev.tracks],
        }));

        return { ok: true, track };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unable to save uploaded audio file.',
        };
      }
    },
    [activePatientId, updateAndPersist]
  );

  const removeTrack = useCallback(
    async (trackId: string) => {
      const target = musicStateRef.current.tracks.find((t) => t.id === trackId);
      if (currentTrackIdRef.current === trackId) {
        audioRef.current?.pause();
        if (audioRef.current) {
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
        revokeObjectUrl();
        setCurrentTrackId(null);
        setIsPlaying(false);
        setCurrentTimeSec(0);
        setDurationSec(0);
      }
      if (target) {
        await deletePatientAudioBlob(activePatientId, target.audioAssetId);
      }
      updateAndPersist((prev) => ({
        ...prev,
        tracks: prev.tracks.filter((t) => t.id !== trackId),
        favouriteTrackIds: prev.favouriteTrackIds.filter((id) => id !== trackId),
        recentlyPlayed: prev.recentlyPlayed.filter((r) => r.trackId !== trackId),
        playlists: prev.playlists.map((pl) => ({
          ...pl,
          trackIds: pl.trackIds.filter((id) => id !== trackId),
        })),
      }));
    },
    [activePatientId, revokeObjectUrl, updateAndPersist]
  );

  const createPlaylist = useCallback(
    (name: string): { ok: boolean; id?: string; error?: string } => {
      const clean = name.trim().slice(0, 80);
      if (!clean) return { ok: false, error: 'Please enter a playlist name.' };
      const nowIso = new Date().toISOString();
      const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      updateAndPersist((prev) => ({
        ...prev,
        playlists: [
          ...prev.playlists,
          { id, name: clean, trackIds: [], createdAt: nowIso, updatedAt: nowIso },
        ],
      }));
      return { ok: true, id };
    },
    [updateAndPersist]
  );

  const renamePlaylist = useCallback(
    (playlistId: string, name: string) => {
      const clean = name.trim().slice(0, 80);
      if (!clean) return;
      updateAndPersist((prev) => ({
        ...prev,
        playlists: prev.playlists.map((pl) =>
          pl.id === playlistId ? { ...pl, name: clean, updatedAt: new Date().toISOString() } : pl
        ),
      }));
    },
    [updateAndPersist]
  );

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        playlists: prev.playlists.filter((pl) => pl.id !== playlistId),
        preferences: {
          ...prev.preferences,
          preferredPlaylistIds: prev.preferences.preferredPlaylistIds.filter((id) => id !== playlistId),
        },
      }));
    },
    [updateAndPersist]
  );

  const addTrackToPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        playlists: prev.playlists.map((pl) =>
          pl.id === playlistId && !pl.trackIds.includes(trackId)
            ? {
                ...pl,
                trackIds: [...pl.trackIds, trackId],
                updatedAt: new Date().toISOString(),
              }
            : pl
        ),
      }));
    },
    [updateAndPersist]
  );

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      updateAndPersist((prev) => ({
        ...prev,
        playlists: prev.playlists.map((pl) =>
          pl.id === playlistId
            ? {
                ...pl,
                trackIds: pl.trackIds.filter((id) => id !== trackId),
                updatedAt: new Date().toISOString(),
              }
            : pl
        ),
      }));
    },
    [updateAndPersist]
  );

  const updateMusicPreferences = useCallback(
    (updater: (prev: MusicPreferences) => MusicPreferences) => {
      updateAndPersist((prev) => ({
        ...prev,
        preferences: updater(prev.preferences),
      }));
    },
    [updateAndPersist]
  );

  const clearRecentlyPlayed = useCallback(() => {
    updateAndPersist((prev) => ({ ...prev, recentlyPlayed: [] }));
  }, [updateAndPersist]);

  const currentTrack = useMemo(
    () => musicState.tracks.find((t) => t.id === currentTrackId) || null,
    [currentTrackId, musicState.tracks]
  );

  const value = useMemo<MusicContextValue>(
    () => ({
      musicState,
      currentTrack,
      queueTrackIds,
      isPlaying,
      isLoadingTrack,
      currentTimeSec,
      durationSec,
      volume,
      isMuted,
      playbackError,
      activeAmbientId,
      isAmbientPlaying,
      clearPlaybackError: () => setPlaybackError(null),
      playTrack,
      playAmbientSound,
      toggleAmbientPlayPause,
      stopAmbientSound,
      togglePlayPause,
      pausePlayback,
      nextTrack,
      previousTrack,
      seekTo,
      seekBy,
      setVolume,
      toggleMute,
      cycleRepeatMode,
      toggleShuffle,
      toggleFavouriteTrack,
      uploadAudioTrack,
      removeTrack,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
      updateMusicPreferences,
      clearRecentlyPlayed,
    }),
    [
      activeAmbientId,
      addTrackToPlaylist,
      clearRecentlyPlayed,
      createPlaylist,
      currentTimeSec,
      currentTrack,
      cycleRepeatMode,
      deletePlaylist,
      durationSec,
      isAmbientPlaying,
      isLoadingTrack,
      isMuted,
      isPlaying,
      musicState,
      nextTrack,
      pausePlayback,
      playAmbientSound,
      playbackError,
      playTrack,
      previousTrack,
      queueTrackIds,
      removeTrack,
      removeTrackFromPlaylist,
      renamePlaylist,
      seekBy,
      seekTo,
      setVolume,
      stopAmbientSound,
      toggleAmbientPlayPause,
      toggleFavouriteTrack,
      toggleMute,
      togglePlayPause,
      toggleShuffle,
      updateMusicPreferences,
      uploadAudioTrack,
      volume,
    ]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic must be used inside MusicProvider');
  return ctx;
}
