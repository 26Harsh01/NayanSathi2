import React from 'react';
import { Bird, CloudRain, Music, Pause, Play, Trees, Waves } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useMusic } from '../../context/MusicContext';
import { AMBIENT_SOUNDSCAPES, type AmbientSoundId } from '../../features/music/ambient-synth';
import { GazeButton } from '../gaze/GazeButton';

const AMBIENT_ICONS: Record<AmbientSoundId, React.ReactNode> = {
  rain: <CloudRain className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  ocean: <Waves className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  birds: <Bird className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  forest: <Trees className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  instrumental: <Music className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
};

export const RelaxationCorner: React.FC = () => {
  const { settings } = useAppState();
  const {
    musicState,
    activeAmbientId,
    isAmbientPlaying,
    playAmbientSound,
    stopAmbientSound,
    playTrack,
  } = useMusic();

  const lang = settings.communication.language;
  const calmingUploads = musicState.tracks.filter(
    (t) => t.category === 'relaxing' || t.category === 'nature_sounds'
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Relaxation Corner — Gentle Soundscapes
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Synthesized calming nature & instrumental sounds play directly in your browser without external streaming links or interrupting your communication voice.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AMBIENT_SOUNDSCAPES.map((sound) => {
          const isActive = activeAmbientId === sound.id && isAmbientPlaying;
          return (
            <div
              key={sound.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
                isActive
                  ? 'border-teal-700 bg-teal-50/50 dark:bg-teal-950/40'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                  {AMBIENT_ICONS[sound.id]}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'hi' ? sound.titleHi : sound.titleEn}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {sound.description}
                  </p>
                </div>
              </div>

              <GazeButton
                gazeId={`relax_sound_${sound.id}`}
                variant={isActive ? 'selected' : 'primary'}
                sizeOverride="large"
                onClick={() => {
                  if (isActive) {
                    stopAmbientSound();
                  } else {
                    playAmbientSound(sound.id);
                  }
                }}
                className="w-full"
              >
                {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isActive ? 'Stop Soundscape' : 'Play Calming Sound'}</span>
              </GazeButton>
            </div>
          );
        })}
      </div>

      {calmingUploads.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Your Uploaded Relaxing & Nature Tracks ({calmingUploads.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {calmingUploads.map((track) => (
              <GazeButton
                key={track.id}
                gazeId={`relax_upload_${track.id}`}
                variant="default"
                sizeOverride="standard"
                onClick={() =>
                  void playTrack(
                    track.id,
                    calmingUploads.map((t) => t.id)
                  )
                }
                className="justify-start text-left"
              >
                <Play className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="truncate">{track.title}</span>
              </GazeButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
