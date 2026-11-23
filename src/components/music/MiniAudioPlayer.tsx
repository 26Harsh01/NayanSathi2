import React from 'react';
import { Music2, Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { AMBIENT_SOUNDSCAPES } from '../../features/music/ambient-synth';
import type { AppRoute } from '../layout/AppShell';
import { GazeButton } from '../gaze/GazeButton';

interface MiniAudioPlayerProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const MiniAudioPlayer: React.FC<MiniAudioPlayerProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const {
    currentTrack,
    isPlaying,
    activeAmbientId,
    isAmbientPlaying,
    togglePlayPause,
    pausePlayback,
    nextTrack,
    previousTrack,
    toggleAmbientPlayPause,
    stopAmbientSound,
  } = useMusic();

  if (!currentTrack && !activeAmbientId) return null;
  if (currentRoute === 'calibration' || currentRoute === 'onboarding') return null;

  const ambientInfo = activeAmbientId
    ? AMBIENT_SOUNDSCAPES.find((s) => s.id === activeAmbientId)
    : null;

  return (
    <div
      role="region"
      aria-label="Mini Audio Player"
      className="sticky bottom-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-2.5 no-print"
    >
      <div className="max-w-[1480px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-gaze-target="mini_player_open_music"
          onClick={() => onNavigate('music')}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {ambientInfo ? ambientInfo.titleEn : currentTrack?.title}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {ambientInfo
                ? isAmbientPlaying
                  ? 'Relaxation Soundscape · Playing'
                  : 'Relaxation Soundscape · Paused'
                : `${currentTrack?.artist} · ${isPlaying ? 'Playing' : 'Paused'}`}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {ambientInfo ? (
            <>
              <GazeButton
                gazeId="mini_ambient_toggle"
                variant="primary"
                sizeOverride="standard"
                onClick={toggleAmbientPlayPause}
              >
                {isAmbientPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isAmbientPlaying ? 'Pause' : 'Play'}</span>
              </GazeButton>
              <GazeButton
                gazeId="mini_ambient_stop"
                variant="subtle"
                sizeOverride="standard"
                onClick={stopAmbientSound}
              >
                <Square className="w-4 h-4" />
              </GazeButton>
            </>
          ) : (
            <>
              <GazeButton
                gazeId="mini_prev"
                sizeOverride="standard"
                onClick={() => void previousTrack()}
                aria-label="Previous song"
              >
                <SkipBack className="w-4 h-4" />
              </GazeButton>
              <GazeButton
                gazeId="mini_play_pause"
                variant="primary"
                sizeOverride="standard"
                onClick={() => void togglePlayPause()}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </GazeButton>
              <GazeButton
                gazeId="mini_next"
                sizeOverride="standard"
                onClick={() => void nextTrack()}
                aria-label="Next song"
              >
                <SkipForward className="w-4 h-4" />
              </GazeButton>
              {isPlaying && (
                <GazeButton
                  gazeId="mini_stop"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={pausePlayback}
                  aria-label="Stop music"
                >
                  <Square className="w-4 h-4" />
                </GazeButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
