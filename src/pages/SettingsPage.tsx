import React, { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw, ShieldCheck, Sliders, Trash2 } from 'lucide-react';
import { useAppState } from '../context/AppStateContext';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { queryCameraPermissionState } from '../features/eye-tracking/camera-manager';
import { computePersonalizedBlinkThresholds } from '../features/eye-tracking/blink-detector';
import { getAvailableVoices, type VoiceSummary } from '../features/communication/text-to-speech';
import { DEFAULT_SETTINGS } from '../features/storage/local-storage';
import { isSupabaseConfigured } from '../lib/supabase';
import type { ButtonSize, InteractionMode, Language, ThemeMode } from '../types';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    setLanguage,
    calibration,
    clearCalibrationProfile,
    resetAllAppData,
  } = useAppState();
  const { isRunning, startTracking, stopTracking } = useEyeTracking();

  const [camPerm, setCamPerm] = useState<string>('checking...');
  const [enVoices, setEnVoices] = useState<VoiceSummary[]>([]);
  const [hiVoices, setHiVoices] = useState<VoiceSummary[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    queryCameraPermissionState().then(setCamPerm);

    const loadVoices = () => {
      setEnVoices(getAvailableVoices('en'));
      setHiVoices(getAvailableVoices('hi'));
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const resetTrackingDefaults = () => {
    updateSettings((prev) => ({
      ...prev,
      eyeTracking: {
        ...DEFAULT_SETTINGS.eyeTracking,
        enabled: prev.eyeTracking.enabled,
      },
    }));
  };

  const blinkThresh = computePersonalizedBlinkThresholds(
    settings.eyeTracking.blinkOpenEar,
    settings.eyeTracking.blinkClosedEar
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Settings & Accessibility
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Configure eye-tracking dwell & normalized 1-Euro smoothing, personalized blink thresholds, visual contrast, bilingual speech output, and local privacy controls.
        </p>
      </div>

      {/* 1. Eye-Tracking Settings */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Eye-Tracking, Blink & Cursor Smoothing
          </h2>
          <button
            type="button"
            onClick={() => (isRunning ? stopTracking() : startTracking())}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
              isRunning
                ? 'bg-slate-900 text-white dark:bg-slate-700'
                : 'bg-teal-700 text-white'
            }`}
          >
            {isRunning ? 'Stop Webcam Tracking' : 'Enable Webcam Tracking'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Dwell Duration</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.dwellDurationMs} ms</span>
            </div>
            <input
              type="range"
              min={500}
              max={3000}
              step={100}
              value={settings.eyeTracking.dwellDurationMs}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: { ...prev.eyeTracking, dwellDurationMs: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Intentional Long-Blink Threshold</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.longBlinkDurationMs} ms</span>
            </div>
            <input
              type="range"
              min={400}
              max={1500}
              step={50}
              value={settings.eyeTracking.longBlinkDurationMs}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: {
                    ...prev.eyeTracking,
                    longBlinkDurationMs: Number(e.target.value),
                  },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Cursor Size</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.cursorSize} px</span>
            </div>
            <input
              type="range"
              min={22}
              max={36}
              step={2}
              value={settings.eyeTracking.cursorSize}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: { ...prev.eyeTracking, cursorSize: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">1-Euro Min Cutoff (Fixation Stability)</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.minCutoff.toFixed(2)} Hz</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.0}
              step={0.05}
              value={settings.eyeTracking.minCutoff}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: { ...prev.eyeTracking, minCutoff: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">1-Euro Beta (Saccade Responsiveness)</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.beta.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.05}
              value={settings.eyeTracking.beta}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: { ...prev.eyeTracking, beta: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Tracking Confidence Threshold</span>
              <span className="font-mono tabular-nums">{settings.eyeTracking.confidenceThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.85}
              step={0.02}
              value={settings.eyeTracking.confidenceThreshold}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  eyeTracking: { ...prev.eyeTracking, confidenceThreshold: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <div className="space-y-2.5 text-sm md:col-span-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.eyeTracking.cursorVisible}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    eyeTracking: { ...prev.eyeTracking, cursorVisible: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-600"
              />
              <span className="font-medium">Show gaze cursor overlay when calibrated</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.eyeTracking.blinkSelectionEnabled}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    eyeTracking: { ...prev.eyeTracking, blinkSelectionEnabled: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-600"
              />
              <span className="font-medium">
                Enable intentional long-blink selection ({settings.eyeTracking.longBlinkDurationMs} ms · edge-triggered once per closure)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.eyeTracking.allowSingleEyeBlinkFallback}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    eyeTracking: {
                      ...prev.eyeTracking,
                      allowSingleEyeBlinkFallback: e.target.checked,
                    },
                  }))
                }
                className="w-4 h-4 accent-teal-600"
              />
              <span className="font-medium">
                Allow single-eye blink fallback when one eye has glasses glare or partial occlusion
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.eyeTracking.showDebugOverlay}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    eyeTracking: { ...prev.eyeTracking, showDebugOverlay: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-teal-600"
              />
              <span className="font-medium">
                Show predicted viewport coordinate debug overlay on cursor & preview
              </span>
            </label>
          </div>
        </div>

        {/* Personalized Blink Baseline Summary */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-800 dark:text-slate-100 block">
              Personalized Blink EAR Profile
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              Open: {settings.eyeTracking.blinkOpenEar.toFixed(3)} · Closed:{' '}
              {settings.eyeTracking.blinkClosedEar.toFixed(3)} · Close Threshold:{' '}
              {blinkThresh.closeThreshold.toFixed(3)} · Reopen Threshold:{' '}
              {blinkThresh.openThreshold.toFixed(3)}
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            Calibrate live in Patient Hub → Test C (Blink Test)
          </span>
        </div>

        {/* Expandable Advanced Tracking Parameters */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-expanded={advancedOpen}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Advanced Tracking Parameters</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {advancedOpen && (
              <button
                type="button"
                onClick={resetTrackingDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Tracking Defaults</span>
              </button>
            )}
          </div>

          {advancedOpen && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <label className="block space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">1-Euro Derivative Cutoff (dCutoff)</span>
                  <span className="font-mono tabular-nums">{settings.eyeTracking.dCutoff.toFixed(2)} Hz</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={settings.eyeTracking.dCutoff}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      eyeTracking: { ...prev.eyeTracking, dCutoff: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-teal-600"
                />
                <span className="text-xs text-slate-500 block">
                  Smooths velocity estimation used to adapt cutoff frequency during rapid eye movements.
                </span>
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Hampel Outlier Threshold (MAD σ)</span>
                  <span className="font-mono tabular-nums">{settings.eyeTracking.outlierThreshold.toFixed(1)} σ</span>
                </div>
                <input
                  type="range"
                  min={2.0}
                  max={5.0}
                  step={0.2}
                  value={settings.eyeTracking.outlierThreshold}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      eyeTracking: { ...prev.eyeTracking, outlierThreshold: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-teal-600"
                />
                <span className="text-xs text-slate-500 block">
                  Lower values aggressively suppress 1-frame landmark spikes; 2-frame eye shifts still pass immediately.
                </span>
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Target Hysteresis Margin</span>
                  <span className="font-mono tabular-nums">{settings.eyeTracking.targetHysteresisPx} px</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={32}
                  step={2}
                  value={settings.eyeTracking.targetHysteresisPx}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      eyeTracking: {
                        ...prev.eyeTracking,
                        targetHysteresisPx: Number(e.target.value),
                        dwellTolerancePx: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-full accent-teal-600"
                />
                <span className="text-xs text-slate-500 block">
                  Extra exit buffer around focused keys (e.g., Q vs W) to prevent micro-jitter from dropping dwell.
                </span>
              </label>

              <label className="block space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Tracking-Loss Hold Timeout</span>
                  <span className="font-mono tabular-nums">{settings.eyeTracking.trackingLossTimeoutMs} ms</span>
                </div>
                <input
                  type="range"
                  min={200}
                  max={1500}
                  step={50}
                  value={settings.eyeTracking.trackingLossTimeoutMs}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      eyeTracking: {
                        ...prev.eyeTracking,
                        trackingLossTimeoutMs: Number(e.target.value),
                      },
                    }))
                  }
                  className="w-full accent-teal-600"
                />
                <span className="text-xs text-slate-500 block">
                  Duration to hold last reliable position during transient occlusion before hiding the cursor cleanly.
                </span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* 2. Interface & Interaction Mode */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Interface & Accessibility
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <label className="block space-y-1">
            <span className="font-medium">Interaction Mode</span>
            <select
              value={settings.interface.interactionMode}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  interface: { ...prev.interface, interactionMode: e.target.value as InteractionMode },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="gaze">Gaze + Dwell</option>
              <option value="mouse">Mouse / Touch</option>
              <option value="keyboard">Keyboard Navigation</option>
              <option value="switch">Switch / Tab Access</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-medium">Button Size</span>
            <select
              value={settings.interface.buttonSize}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  interface: { ...prev.interface, buttonSize: e.target.value as ButtonSize },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra-Large</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-medium">Button Spacing</span>
            <select
              value={settings.interface.buttonSpacing}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  interface: {
                    ...prev.interface,
                    buttonSpacing: e.target.value as 'compact' | 'comfortable' | 'wide',
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="wide">Wide</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-medium">Theme</span>
            <select
              value={settings.interface.theme}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  interface: { ...prev.interface, theme: e.target.value as ThemeMode },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
            </select>
          </label>
        </div>

        <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={settings.interface.highContrast}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                interface: { ...prev.interface, highContrast: e.target.checked },
              }))
            }
            className="w-4 h-4 accent-teal-600"
          />
          <span>Enable High-Contrast Borders & Surfaces</span>
        </label>
      </section>

      {/* 3. Communication & Speech Settings */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Language & Text-to-Speech
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <label className="block space-y-1">
            <span className="font-medium">Preferred Communication Language</span>
            <select
              value={settings.communication.language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <div className="flex justify-between">
              <span className="font-medium">Speech Speed</span>
              <span className="font-mono tabular-nums">{settings.communication.speechRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.5}
              step={0.05}
              value={settings.communication.speechRate}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: { ...prev.communication, speechRate: Number(e.target.value) },
                }))
              }
              className="w-full accent-teal-600"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-medium">English Voice ({enVoices.length} available)</span>
            <select
              value={settings.communication.preferredVoiceEn}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: { ...prev.communication, preferredVoiceEn: e.target.value },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Auto-select best English voice</option>
              {enVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="font-medium">Hindi Voice ({hiVoices.length} available)</span>
            <select
              value={settings.communication.preferredVoiceHi}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: { ...prev.communication, preferredVoiceHi: e.target.value },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">Auto-select best Hindi voice</option>
              {hiVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            {hiVoices.length === 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400 block">
                No Hindi Web Speech voice detected on this OS/browser; system fallback will be attempted.
              </span>
            )}
          </label>
        </div>
      </section>

      {/* 4. Privacy & Data Management */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Privacy & Local Data Management
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-xs text-slate-500 block">Camera Permission</span>
            <span className="font-semibold capitalize">{camPerm}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-xs text-slate-500 block">Cloud Sync Mode</span>
            <span className="font-semibold">
              {isSupabaseConfigured ? 'Supabase Connected' : 'Local Demo Mode (Browser only)'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-xs text-slate-500 block">Calibration Profile</span>
            <span className="font-semibold">
              {calibration ? `${calibration.qualityTier} saved locally` : 'None'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!calibration}
            onClick={clearCalibrationProfile}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold disabled:opacity-45 cursor-pointer"
          >
            Erase Saved Calibration
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Local Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetAllAppData();
                  setConfirmReset(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Confirm Erase Everything
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
