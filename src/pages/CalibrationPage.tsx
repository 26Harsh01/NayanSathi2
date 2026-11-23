import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  Trash2,
  Video,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { WebcamLandmarkPreview } from '../components/gaze/WebcamLandmarkPreview';
import { GazeButton } from '../components/gaze/GazeButton';
import {
  buildCalibrationProfile,
  CALIBRATION_SETTLE_MS,
  NINE_POINT_TARGETS,
  TARGET_SAMPLES_PER_POINT,
} from '../features/eye-tracking/calibration';
import { buildGazeFeatureVector } from '../features/eye-tracking/gaze-features';
import type { CalibrationSample, GazeFeatures } from '../types';

interface CalibrationPageProps {
  onNavigate: (route: AppRoute) => void;
}

type CalibrationStage = 'setup' | 'collecting' | 'results';

function getViewportSize(): { width: number; height: number } {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  return {
    width: Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1280),
    height: Math.max(1, document.documentElement.clientHeight || window.innerHeight || 720),
  };
}

export const CalibrationPage: React.FC<CalibrationPageProps> = ({ onNavigate }) => {
  const { calibration, setCalibrationProfile, clearCalibrationProfile, settings } = useAppState();
  const {
    isRunning,
    startTracking,
    setIsCalibrating,
    status,
    errorMessage,
    calibrationStale,
    diagnostics,
    subscribeFrameFeatures,
  } = useEyeTracking();

  const lang = settings.communication.language;
  const [stage, setStage] = useState<CalibrationStage>(calibration ? 'results' : 'setup');
  const [activePointIdx, setActivePointIdx] = useState(0);
  const [singlePointRecalId, setSinglePointRecalId] = useState<string | null>(null);
  const [pointSampleCount, setPointSampleCount] = useState(0);
  const [isSettling, setIsSettling] = useState(true);
  const [collectionFeedback, setCollectionFeedback] = useState<string>(
    'Look directly at the illuminated target.'
  );
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [testPadHits, setTestPadHits] = useState<string[]>([]);

  const samplesRef = useRef<Record<string, CalibrationSample[]>>({});
  const settleUntilRef = useRef<number>(0);

  // Suppress blink selection and dwell triggers during active calibration
  useEffect(() => {
    setIsCalibrating(stage === 'collecting');
    return () => setIsCalibrating(false);
  }, [setIsCalibrating, stage]);

  const beginFullCalibration = async () => {
    setCalibrationError(null);
    if (!isRunning) {
      const ok = await startTracking();
      if (!ok) return;
    }
    samplesRef.current = {};
    setSinglePointRecalId(null);
    setActivePointIdx(0);
    setPointSampleCount(0);
    setIsSettling(true);
    settleUntilRef.current = performance.now() + CALIBRATION_SETTLE_MS;
    setStage('collecting');
  };

  const beginSinglePointRecalibration = async (targetId: string) => {
    const idx = NINE_POINT_TARGETS.findIndex((t) => t.id === targetId);
    if (idx === -1) return;
    setCalibrationError(null);
    if (!isRunning) {
      const ok = await startTracking();
      if (!ok) return;
    }
    samplesRef.current[targetId] = [];
    setSinglePointRecalId(targetId);
    setActivePointIdx(idx);
    setPointSampleCount(0);
    setIsSettling(true);
    settleUntilRef.current = performance.now() + CALIBRATION_SETTLE_MS;
    setStage('collecting');
  };

  useEffect(() => {
    if (stage !== 'collecting') return;

    const currentTarget = NINE_POINT_TARGETS[activePointIdx];
    if (!currentTarget) return;

    const unsubscribe = subscribeFrameFeatures((features: GazeFeatures | null) => {
      const now = performance.now();
      if (now < settleUntilRef.current) {
        setIsSettling(true);
        const remSec = ((settleUntilRef.current - now) / 1000).toFixed(1);
        setCollectionFeedback(`Look steadily at the target — capturing begins in ${remSec}s...`);
        return;
      }
      setIsSettling(false);

      if (!features || features.faceCount === 0) {
        setCollectionFeedback('Face not detected — keep your face centered in the camera.');
        return;
      }
      if (features.faceCount > 1) {
        setCollectionFeedback('Multiple faces detected — ensure only one face is in frame.');
        return;
      }
      if (features.isBlinking) {
        setCollectionFeedback('Blink detected — holding sample collection briefly.');
        return;
      }
      if (features.confidence < 0.45) {
        setCollectionFeedback('Low landmark confidence — adjust lighting or face angle.');
        return;
      }

      const list = samplesRef.current[currentTarget.id] ?? [];
      if (list.length >= TARGET_SAMPLES_PER_POINT) return;

      const vp = getViewportSize();
      const targetX = currentTarget.normX * vp.width;
      const targetY = currentTarget.normY * vp.height;

      list.push({
        targetId: currentTarget.id,
        targetX,
        targetY,
        featureVector: buildGazeFeatureVector(features),
        confidence: features.confidence,
        timestamp: now,
      });
      samplesRef.current[currentTarget.id] = list;
      setPointSampleCount(list.length);
      setCollectionFeedback(
        `Keep eyes fixed on center dot (${list.length}/${TARGET_SAMPLES_PER_POINT})...`
      );

      if (list.length >= TARGET_SAMPLES_PER_POINT) {
        if (singlePointRecalId) {
          try {
            const profile = buildCalibrationProfile(samplesRef.current, vp.width, vp.height);
            setCalibrationProfile(profile);
            setSinglePointRecalId(null);
            setStage('results');
          } catch (err) {
            setCalibrationError(
              err instanceof Error ? err.message : 'Unable to update calibration.'
            );
            setStage('setup');
          }
          return;
        }

        if (activePointIdx + 1 < NINE_POINT_TARGETS.length) {
          setActivePointIdx((prev) => prev + 1);
          setPointSampleCount(0);
          setIsSettling(true);
          settleUntilRef.current = performance.now() + CALIBRATION_SETTLE_MS;
        } else {
          try {
            const profile = buildCalibrationProfile(samplesRef.current, vp.width, vp.height);
            setCalibrationProfile(profile);
            setStage('results');
          } catch (err) {
            setCalibrationError(
              err instanceof Error
                ? err.message
                : 'Calibration failed due to insufficient valid samples.'
            );
            setStage('setup');
          }
        }
      }
    });

    return () => unsubscribe();
  }, [
    activePointIdx,
    setCalibrationProfile,
    singlePointRecalId,
    stage,
    subscribeFrameFeatures,
  ]);

  if (stage === 'collecting') {
    const target = NINE_POINT_TARGETS[activePointIdx];
    const pct = Math.round((pointSampleCount / TARGET_SAMPLES_PER_POINT) * 100);
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white select-none">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm">
          <span className="font-semibold">
            {singlePointRecalId
              ? `Recalibrating ${target.labelEn}`
              : `Point ${activePointIdx + 1} of ${NINE_POINT_TARGETS.length}: ${target.labelEn}`}
          </span>
          <span className="text-slate-300 tabular-nums">
            {isSettling ? 'Focusing...' : `${pct}%`}
          </span>
          <button
            type="button"
            onClick={() => setStage(calibration ? 'results' : 'setup')}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 text-center">
          {collectionFeedback}
        </div>

        {/* Active calibration target */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
          style={{
            left: `${target.normX * 100}%`,
            top: `${target.normY * 100}%`,
          }}
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="rgba(15,23,42,0.85)"
                stroke={isSettling ? 'rgba(245,158,11,0.55)' : 'rgba(148,163,184,0.35)'}
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                strokeDashoffset={
                  2 * Math.PI * 26 * (1 - pointSampleCount / TARGET_SAMPLES_PER_POINT)
                }
              />
            </svg>
            <div
              className={`absolute rounded-full border-2 border-white transition-all duration-200 ${
                isSettling ? 'w-4 h-4 bg-amber-400 scale-110' : 'w-3 h-3 bg-teal-300'
              }`}
            />
          </div>
        </div>
      </div>
    );
  }

  const vpNow = getViewportSize();
  const estValidationPx = calibration
    ? Math.round(calibration.meanValidationNormError * Math.hypot(vpNow.width, vpNow.height))
    : 0;
  const estValX = calibration
    ? Math.round((calibration.validationHorizErrorNorm ?? 0) * vpNow.width)
    : 0;
  const estValY = calibration
    ? Math.round((calibration.validationVertErrorNorm ?? 0) * vpNow.height)
    : 0;
  const estTrainPx = calibration
    ? Math.round((calibration.trainingErrorNorm ?? 0) * Math.hypot(vpNow.width, vpNow.height))
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {lang === 'hi' ? '9-बिंदु नेत्र कैलिब्रेशन' : '9-Point Gaze Calibration'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Train your personalized regularized Ridge Regression model. Calibration quality depends on lighting, seating distance, and steady gaze on each target.
          </p>
        </div>

        {calibration && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={beginFullCalibration}
              className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recalibrate All 9 Points</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearCalibrationProfile();
                setStage('setup');
              }}
              className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Erase Calibration</span>
            </button>
          </div>
        )}
      </div>

      {calibrationStale && calibration && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Your browser window size or aspect ratio changed since this calibration ({calibration.viewportWidth}x{calibration.viewportHeight} vs {vpNow.width}x{vpNow.height}). Recalibrating is recommended for optimal key alignment.
            </span>
          </div>
          <button
            type="button"
            onClick={beginFullCalibration}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
          >
            Recalibrate Now
          </button>
        </div>
      )}

      {(errorMessage || calibrationError) && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-start gap-3 text-sm text-red-800 dark:text-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{calibrationError || errorMessage}</span>
        </div>
      )}

      {stage === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <WebcamLandmarkPreview showLandmarks />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-500 block">Tracking Status</span>
                <span className="font-semibold text-slate-900 dark:text-white">{status}</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-500 block">Faces Detected</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {diagnostics.faceCount}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-500 block">Confidence</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {diagnostics.confidence.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pre-Calibration Checklist
            </h2>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>1. Center your face in the preview so both cyan eye contours and teal iris centers sit squarely over your eyes.</li>
              <li>2. Keep your head steady during the 9-point sequence and move only your eyes from target to target.</li>
              <li>3. Wait briefly during the amber 0.75s settle phase before capturing starts; blinks are skipped automatically.</li>
            </ul>

            <div className="pt-2 space-y-3">
              {!isRunning && (
                <button
                  type="button"
                  onClick={() => startTracking()}
                  className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Start Webcam Preview</span>
                </button>
              )}

              <button
                type="button"
                onClick={beginFullCalibration}
                className="w-full py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crosshair className="w-5 h-5" />
                <span>Begin 9-Point Calibration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'results' && calibration && (
        <div className="space-y-8">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>Chronological 70/30 Holdout Validation</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{calibration.totalSamplesCollected} clean samples</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                    {calibration.qualityTier === 'strong'
                      ? 'Strong Gaze Fit'
                      : calibration.qualityTier === 'moderate'
                        ? 'Moderate Gaze Fit'
                        : 'Needs Recalibration in Highlighted Zones'}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Held-out validation tests the final 30% of each fixation against a model trained on the first 70%. Run real-time Diagnostic Tests on the Patient Hub to measure live screen accuracy.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Open Diagnostic Mode
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('communicate')}
                  className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-teal-600 text-white font-semibold cursor-pointer"
                >
                  Open Communicate Board
                </button>
              </div>
            </div>

            {/* Model Diagnostics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">Held-out Error (Radial)</span>
                <span className="font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                  ~{estValidationPx} px ({(calibration.meanValidationNormError * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">Held-out Horiz (X)</span>
                <span className="font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                  ~{estValX} px
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">Held-out Vert (Y)</span>
                <span className="font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                  ~{estValY} px
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">Training Fit (In-Sample)</span>
                <span className="font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                  ~{estTrainPx} px
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">Iris Signal Var (X / Y)</span>
                <span className="font-bold font-mono text-sm tabular-nums text-slate-900 dark:text-white">
                  {((calibration.featureVariance?.irisX ?? 0) * 1000).toFixed(2)} /{' '}
                  {((calibration.featureVariance?.irisY ?? 0) * 1000).toFixed(2)} e-3
                </span>
              </div>
            </div>
          </div>

          {/* 3x3 Regional Validation Map */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Screen Region Check (Click any region to recalibrate that point)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {NINE_POINT_TARGETS.map((tgt) => {
                const res = calibration.pointResults.find((p) => p.targetId === tgt.id);
                const needsFix = res?.needsRecalibration ?? false;
                const ptPx = Math.round(
                  (res?.meanResidualNorm ?? 0) * Math.hypot(vpNow.width, vpNow.height)
                );
                const ptX = Math.round((res?.meanErrorXNorm ?? 0) * vpNow.width);
                const ptY = Math.round((res?.meanErrorYNorm ?? 0) * vpNow.height);
                return (
                  <button
                    key={tgt.id}
                    type="button"
                    onClick={() => beginSinglePointRecalibration(tgt.id)}
                    className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                      needsFix
                        ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {tgt.labelEn}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          needsFix ? 'text-amber-700 dark:text-amber-400' : 'text-teal-700 dark:text-teal-400'
                        }`}
                      >
                        {needsFix ? 'Recalibrate suggested' : 'Good fit'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      Samples: {res?.sampleCount ?? 0} · Holdout: ~{ptPx}px (dx {ptX}, dy {ptY})
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Gaze Dwell Verification Pad */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Live Gaze Dwell Test Pad
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Ensure camera tracking is active, then look at any test target below to verify cursor smoothing and dwell activation.
                </p>
              </div>
              {!isRunning && (
                <button
                  type="button"
                  onClick={() => startTracking()}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Start Tracking to Test
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['Target A', 'Target B', 'Target C', 'Target D'].map((label, idx) => {
                const hit = testPadHits.includes(label);
                return (
                  <GazeButton
                    key={label}
                    gazeId={`cal_test_${idx}`}
                    variant={hit ? 'selected' : 'default'}
                    sizeOverride="large"
                    onClick={() =>
                      setTestPadHits((prev) =>
                        prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
                      )
                    }
                  >
                    <span>{hit ? `${label} Selected` : label}</span>
                  </GazeButton>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
