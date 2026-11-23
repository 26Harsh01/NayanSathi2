import React from 'react';
import {
  Heart,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { AMBIENT_SOUNDSCAPES } from '../../features/music/ambient-synth';
import { GazeButton } from '../gaze/GazeButton';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export const AudioPlayer: React.FC = () => {
  const {
    musicState,
    currentTrack,
    isPlaying,
    isLoadingTrack,
    currentTimeSec,
    durationSec,
    volume,
    isMuted,
    playbackError,
    activeAmbientId,
    isAmbientPlaying,
    clearPlaybackError,
    togglePlayPause,
    toggleAmbientPlayPause,
    stopAmbientSound,
    nextTrack,
    previousTrack,
    seekTo,
    seekBy,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    toggleFavouriteTrack,
  } = useMusic();

  const activeAmbient = activeAmbientId
    ? AMBIENT_SOUNDSCAPES.find((a) => a.id === activeAmbientId) || null
    : null;

  const isFavourite = currentTrack
    ? musicState.favouriteTrackIds.includes(currentTrack.id)
    : false;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
      {playbackError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-2"
        >
          <span>{playbackError}</span>
          <button
            type="button"
            onClick={clearPlaybackError}
            className="font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Track or Ambient Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
            <Music2 className="w-7 h-7 text-teal-700 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              {activeAmbient
                ? 'Relaxation Corner Soundscape'
                : currentTrack
                  ? currentTrack.category.replace(/_/g, ' ')
                  : 'Music Player Ready'}
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {activeAmbient
                ? activeAmbient.titleEn
                : currentTrack
                  ? currentTrack.title
                  : 'Select a track or calming nature sound'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {activeAmbient
                ? activeAmbient.description
                : currentTrack
                  ? `${currentTrack.artist} · ${currentTrack.album}`
                  : 'Audio starts only when you click Play (no autoplay).'}
            </p>
          </div>
        </div>

        {currentTrack && !activeAmbient && (
          <GazeButton
            gazeId="player_fav_toggle"
            gazeLabel={isFavourite ? 'Remove from Favourites' : 'Add to Favourites'}
            variant={isFavourite ? 'primary' : 'default'}
            sizeOverride="standard"
            onClick={() => toggleFavouriteTrack(currentTrack.id)}
          >
            <Heart className={`w-4 h-4 ${isFavourite ? 'fill-current' : ''}`} />
            <span>{isFavourite ? 'Favourited' : 'Add Favourite'}</span>
          </GazeButton>
        )}
      </div>

      {/* Seek / Progress Bar for Tracks */}
      {!activeAmbient && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums text-slate-500 w-10">
              {formatTime(currentTimeSec)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(durationSec || currentTrack?.durationSec || 100))}
              value={Math.min(
                Math.floor(currentTimeSec),
                Math.max(1, Math.floor(durationSec || currentTrack?.durationSec || 100))
              )}
              disabled={!currentTrack}
              aria-label="Seek audio position"
              onChange={(e) => seekTo(Number(e.target.value))}
              className="flex-1 accent-teal-600 cursor-pointer"
            />
            <span className="text-xs font-mono tabular-nums text-slate-500 w-10 text-right">
              {formatTime(durationSec || currentTrack?.durationSec || 0)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <GazeButton
              gazeId="player_seek_back"
              sizeOverride="standard"
              disabled={!currentTrack}
              onClick={() => seekBy(-10)}
            >
              <span>-10s</span>
            </GazeButton>
            <GazeButton
              gazeId="player_seek_fwd"
              sizeOverride="standard"
              disabled={!currentTrack}
              onClick={() => seekBy(10)}
            >
              <span>+10s</span>
            </GazeButton>
          </div>
        </div>
      )}

      {/* Main Transport + Repeat / Shuffle */}
      <div className="flex flex-wrap items-center gap-2.5">
        {activeAmbient ? (
          <>
            <GazeButton
              gazeId="player_ambient_toggle"
              variant="primary"
              sizeOverride="large"
              onClick={toggleAmbientPlayPause}
            >
              {isAmbientPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isAmbientPlaying ? 'Pause Soundscape' : 'Play Soundscape'}</span>
            </GazeButton>
            <GazeButton
              gazeId="player_ambient_stop"
              variant="subtle"
              sizeOverride="standard"
              onClick={stopAmbientSound}
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </GazeButton>
          </>
        ) : (
          <>
            <GazeButton
              gazeId="player_prev"
              sizeOverride="standard"
              disabled={musicState.tracks.length === 0}
              onClick={() => void previousTrack()}
            >
              <SkipBack className="w-4 h-4" />
              <span>Previous</span>
            </GazeButton>

            <GazeButton
              gazeId="player_play_pause"
              variant="primary"
              sizeOverride="large"
              disabled={isLoadingTrack || musicState.tracks.length === 0}
              onClick={() => void togglePlayPause()}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isLoadingTrack ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}</span>
            </GazeButton>

            <GazeButton
              gazeId="player_next"
              sizeOverride="standard"
              disabled={musicState.tracks.length === 0}
              onClick={() => void nextTrack()}
            >
              <SkipForward className="w-4 h-4" />
              <span>Next</span>
            </GazeButton>

            <GazeButton
              gazeId="player_repeat"
              variant={musicState.preferences.repeatMode !== 'off' ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={cycleRepeatMode}
            >
              <Repeat className="w-4 h-4" />
              <span className="capitalize">Repeat: {musicState.preferences.repeatMode}</span>
            </GazeButton>

            <GazeButton
              gazeId="player_shuffle"
              variant={musicState.preferences.shuffleEnabled ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={toggleShuffle}
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle: {musicState.preferences.shuffleEnabled ? 'On' : 'Off'}</span>
            </GazeButton>
          </>
        )}
      </div>

      {/* Accessible Volume Controls */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <GazeButton
          gazeId="player_mute"
          sizeOverride="standard"
          variant={isMuted ? 'selected' : 'subtle'}
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </GazeButton>

        <GazeButton
          gazeId="player_vol_down"
          sizeOverride="standard"
          onClick={() => setVolume(Math.max(0, Number((volume - 0.1).toFixed(2))))}
        >
          <Minus className="w-4 h-4" />
        </GazeButton>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          aria-label="Audio Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-36 sm:w-48 accent-teal-600 cursor-pointer"
        />

        <GazeButton
          gazeId="player_vol_up"
          sizeOverride="standard"
          onClick={() => setVolume(Math.min(1, Number((volume + 0.1).toFixed(2))))}
        >
          <Plus className="w-4 h-4" />
        </GazeButton>

        <span className="text-xs font-mono tabular-nums text-slate-500">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
};
