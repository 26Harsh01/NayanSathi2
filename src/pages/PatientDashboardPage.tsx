import React from 'react';
import { AlertTriangle, Crosshair, Eye, MessageSquare, Settings, Star } from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { WebcamLandmarkPreview } from '../components/gaze/WebcamLandmarkPreview';
import { GazeStabilityTestPanel } from '../components/gaze/GazeStabilityTestPanel';

interface PatientDashboardPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const PatientDashboardPage: React.FC<PatientDashboardPageProps> = ({ onNavigate }) => {
  const {
    profile,
    settings,
    calibration,
    phrases,
    toggleFavoritePhrase,
    recentPhrases,
  } = useAppState();
  const { diagnostics, isRunning, startTracking, errorMessage, calibrationStale } = useEyeTracking();

  const lang = settings.communication.language;
  const favoritePhrases = phrases.filter((p) => p.isFavorite);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {lang === 'hi' ? 'रोगी केंद्र और लाइव डायग्नोस्टिक्स' : 'Patient Hub & Live Gaze Diagnostics'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Welcome, {profile.name || 'Friend'} · Language: {lang === 'hi' ? 'हिंदी' : 'English'} · Interaction: {settings.interface.interactionMode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('calibration')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold inline-flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
            <span>{calibration ? 'Review Calibration' : 'Run Calibration'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('communicate')}
            className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Communicate</span>
          </button>
        </div>
      </div>

      {calibrationStale && calibration && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Viewport size or aspect ratio changed significantly since last calibration ({calibration.viewportWidth}x{calibration.viewportHeight}). Recalibrating is recommended.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('calibration')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
          >
            Recalibrate Now
          </button>
        </div>
      )}

      {/* Real-time Eye-Tracking Pipeline Verification & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Local Webcam & Iris Landmark Feed
            </h2>
            {!isRunning && (
              <button
                type="button"
                onClick={() => startTracking()}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Start Tracking</span>
              </button>
            )}
          </div>
          <WebcamLandmarkPreview showLandmarks />
          {errorMessage && (
            <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMessage}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Webcam frames are processed locally inside your browser. Gaze stability depends on lighting, seating distance, camera angle, and calibration quality.
          </p>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Live Pipeline Diagnostics
            </h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Status: {diagnostics.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Frame Rate', value: `${diagnostics.fps} FPS` },
              { label: 'Confidence', value: diagnostics.confidence.toFixed(2) },
              {
                label: 'Blink State / EAR L·R',
                value: `${diagnostics.blink.state} (${diagnostics.blink.earLeft.toFixed(2)}/${diagnostics.blink.earRight.toFixed(2)})`,
              },
              {
                label: 'Raw Gaze (X, Y)',
                value: `${Math.round(diagnostics.rawX)}, ${Math.round(diagnostics.rawY)}`,
              },
              {
                label: '1-Euro Filtered',
                value: `${Math.round(diagnostics.filteredX)}, ${Math.round(diagnostics.filteredY)}`,
              },
              {
                label: 'Head Yaw / Pitch',
                value: `${diagnostics.yaw.toFixed(2)} / ${diagnostics.pitch.toFixed(2)}`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  {stat.label}
                </span>
                <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-1 block">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                Calibration Status
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {calibration
                  ? `${calibration.qualityTier} (${calibration.totalSamplesCollected} samples)`
                  : 'Not yet calibrated'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                Dwell & Blink Settings
              </span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                {settings.eyeTracking.dwellDurationMs} ms ·{' '}
                {settings.eyeTracking.blinkSelectionEnabled ? 'Long-blink ON' : 'Blink-safe pause'}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Adjust Smoothing & Dwell Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Gaze Stability, 9-Point Accuracy & Keyboard Tracking Test Suite */}
      <GazeStabilityTestPanel onNavigateCalibration={() => onNavigate('calibration')} />

      {/* Favorites & Recently Used Phrases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Favorite Phrases ({favoritePhrases.length})
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {phrases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60"
              >
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  {lang === 'hi' ? p.textHi : p.textEn}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFavoritePhrase(p.id)}
                  aria-label="Toggle favorite phrase"
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Star
                    className={`w-4 h-4 ${
                      p.isFavorite
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-slate-400'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Recently Spoken Phrases
          </h2>
          {recentPhrases.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Phrases you speak aloud in Communicate appear here for quick reference.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentPhrases.map((text, idx) => (
                <li
                  key={`${text}_${idx}`}
                  className="py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-200"
                >
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
