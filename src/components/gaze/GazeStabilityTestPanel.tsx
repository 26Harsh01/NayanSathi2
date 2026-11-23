import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Eye,
  Keyboard,
  Play,
  RotateCcw,
  Square,
  Target,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useEyeTracking, type GazeFrameTelemetry } from '../../hooks/useEyeTracking';
import { GazeButton } from './GazeButton';
import { EN_LETTER_ROWS } from '../../features/communication/virtual-keyboard';
import { computePersonalizedBlinkThresholds } from '../../features/eye-tracking/blink-detector';
import {
  CALIBRATION_SETTLE_MS,
  NINE_POINT_TARGETS,
} from '../../features/eye-tracking/calibration';
import type { BlinkDiagnosticState, BlinkEvent } from '../../types';

type StabilityTab = 'fixed' | 'nine-point' | 'blink' | 'keyboard';

interface FixedPointSample {
  rawX: number;
  rawY: number;
  filteredX: number;
  filteredY: number;
  confidence: number;
  fps: number;
  wasOutlier: boolean;
}

interface FixedPointResult {
  sampleCount: number;
  outlierCount: number;
  lastRawX: number;
  lastRawY: number;
  lastFilteredX: number;
  lastFilteredY: number;
  rawStdX: number;
  rawStdY: number;
  filteredStdX: number;
  filteredStdY: number;
  maxDeviationPx: number;
  meanConfidence: number;
  avgFps: number;
}

interface NinePointTargetStat {
  targetId: string;
  label: string;
  normX: number;
  normY: number;
  targetX: number;
  targetY: number;
  predMeanX: number;
  predMeanY: number;
  predMeanNormX: number;
  predMeanNormY: number;
  sampleCount: number;
  meanErrorPx: number;
  meanAbsX: number;
  meanAbsY: number;
  maxErrorPx: number;
  spreadPx: number;
}

interface NinePointResult {
  meanErrorPx: number;
  meanNormErrorPct: number;
  meanHorizErrorPx: number;
  meanVertErrorPx: number;
  maxErrorPx: number;
  meanSpreadPx: number;
  perTarget: NinePointTargetStat[];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) * 0.5
    : sorted[mid];
}

function getViewportSize(): { width: number; height: number } {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  return {
    width: Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1280),
    height: Math.max(1, document.documentElement.clientHeight || window.innerHeight || 720),
  };
}

export const GazeStabilityTestPanel: React.FC<{ onNavigateCalibration?: () => void }> = ({
  onNavigateCalibration,
}) => {
  const { calibration, settings, updateSettings } = useAppState();
  const { isRunning, startTracking, subscribeGazeFrame, diagnostics, resetBlinkStats } =
    useEyeTracking();

  const [activeTab, setActiveTab] = useState<StabilityTab>('fixed');

  // --- TEST A: Fixed-Point 5s Test ---
  const [fixedRunning, setFixedRunning] = useState(false);
  const [fixedElapsedMs, setFixedElapsedMs] = useState(0);
  const [fixedLive, setFixedLive] = useState<{
    rawX: number;
    rawY: number;
    filteredX: number;
    filteredY: number;
    confidence: number;
    fps: number;
  } | null>(null);
  const [fixedResult, setFixedResult] = useState<FixedPointResult | null>(null);
  const fixedSamplesRef = useRef<FixedPointSample[]>([]);

  // --- TEST B: Nine-Point Accuracy Test ---
  const [nineRunning, setNineRunning] = useState(false);
  const [nineIdx, setNineIdx] = useState(0);
  const [ninePhase, setNinePhase] = useState<'settle' | 'measure'>('settle');
  const [nineResult, setNineResult] = useState<NinePointResult | null>(null);
  const nineDataRef = useRef<
    Record<string, { dx: number; dy: number; err: number; fx: number; fy: number; fnx: number; fny: number }[]>
  >({});

  // --- TEST C: Blink Calibration & Guided Test ---
  const [blinkCalStep, setBlinkCalStep] = useState<'idle' | 'open' | 'closed'>('idle');
  const [blinkCalMessage, setBlinkCalMessage] = useState<string | null>(null);
  const [openEarCandidate, setOpenEarCandidate] = useState<number | null>(null);
  const [blinkTestActive, setBlinkTestActive] = useState(false);
  const [blinkEventLog, setBlinkEventLog] = useState<BlinkEvent[]>([]);
  const [liveBlinkSnap, setLiveBlinkSnap] = useState<BlinkDiagnosticState>(diagnostics.blink);
  const blinkSamplesRef = useRef<number[]>([]);
  const lastLoggedEventTsRef = useRef<number>(0);

  // --- TEST D: Alphabet Tracking Test (Q, W, E, R, T) ---
  const [intendedKey, setIntendedKey] = useState<string>('Q');
  const [typedPreview, setTypedPreview] = useState<string>('');
  const [dwellCompletions, setDwellCompletions] = useState(0);
  const [accidentalSelections, setAccidentalSelections] = useState(0);
  const [kbdTelemetry, setKbdTelemetry] = useState<{
    rawX: number;
    rawY: number;
    filteredX: number;
    filteredY: number;
    focusedLetter: string | null;
    dwellProgress: number;
    stabilityPct: number | null;
    switchCount: number;
    switchesPerSec: number;
    timeToFocusMs: number | null;
    totalSamples: number;
  }>({
    rawX: 0,
    rawY: 0,
    filteredX: 0,
    filteredY: 0,
    focusedLetter: null,
    dwellProgress: 0,
    stabilityPct: null,
    switchCount: 0,
    switchesPerSec: 0,
    timeToFocusMs: null,
    totalSamples: 0,
  });
  const kbdWindowRef = useRef<boolean[]>([]);
  const kbdStartMsRef = useRef<number>(0);
  const kbdFirstFocusMsRef = useRef<number | null>(null);
  const kbdPrevFocusedRef = useRef<string | null>(null);
  const kbdSwitchCountRef = useRef<number>(0);

  const ensureTrackingStarted = async (): Promise<boolean> => {
    if (!isRunning) {
      return startTracking();
    }
    return true;
  };

  // --- TEST A Effect ---
  const startFixedPointTest = async () => {
    if (!calibration) return;
    const ok = await ensureTrackingStarted();
    if (!ok) return;
    fixedSamplesRef.current = [];
    setFixedElapsedMs(0);
    setFixedResult(null);
    setFixedRunning(true);
  };

  useEffect(() => {
    if (!fixedRunning) return;

    const DURATION_MS = 5000;
    const SETTLE_MS = 500;
    const startMs = performance.now();
    let uiTimer = 0;

    const finalize = () => {
      const list = fixedSamplesRef.current;
      if (list.length > 0) {
        const last = list[list.length - 1];
        const meanX = list.reduce((a, b) => a + b.filteredX, 0) / list.length;
        const meanY = list.reduce((a, b) => a + b.filteredY, 0) / list.length;
        const maxDeviationPx = Math.max(
          ...list.map((s) => Math.hypot(s.filteredX - meanX, s.filteredY - meanY))
        );
        const meanConf = list.reduce((a, b) => a + b.confidence, 0) / list.length;
        const fpsVals = list.map((s) => s.fps).filter((f) => f > 0);
        const avgFps =
          fpsVals.length > 0 ? Math.round(fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length) : 0;

        setFixedResult({
          sampleCount: list.length,
          outlierCount: list.filter((s) => s.wasOutlier).length,
          lastRawX: last.rawX,
          lastRawY: last.rawY,
          lastFilteredX: last.filteredX,
          lastFilteredY: last.filteredY,
          rawStdX: stdDev(list.map((s) => s.rawX)),
          rawStdY: stdDev(list.map((s) => s.rawY)),
          filteredStdX: stdDev(list.map((s) => s.filteredX)),
          filteredStdY: stdDev(list.map((s) => s.filteredY)),
          maxDeviationPx,
          meanConfidence: meanConf,
          avgFps,
        });
      }
      setFixedRunning(false);
    };

    const unsub = subscribeGazeFrame((frame: GazeFrameTelemetry) => {
      const elapsed = performance.now() - startMs;
      setFixedElapsedMs(Math.min(DURATION_MS, elapsed));

      if (elapsed >= DURATION_MS + SETTLE_MS) {
        finalize();
        return;
      }
      if (elapsed < SETTLE_MS) return;

      if (frame.confident && !frame.isBlinking && frame.features) {
        fixedSamplesRef.current.push({
          rawX: frame.rawX,
          rawY: frame.rawY,
          filteredX: frame.filteredX,
          filteredY: frame.filteredY,
          confidence: frame.features.confidence,
          fps: frame.fps,
          wasOutlier: frame.wasOutlier,
        });
      }

      if (performance.now() - uiTimer > 90) {
        uiTimer = performance.now();
        setFixedLive({
          rawX: frame.rawX,
          rawY: frame.rawY,
          filteredX: frame.filteredX,
          filteredY: frame.filteredY,
          confidence: frame.features?.confidence ?? 0,
          fps: frame.fps,
        });
      }
    });

    const hardStop = window.setTimeout(() => {
      finalize();
    }, DURATION_MS + SETTLE_MS + 250);

    return () => {
      unsub();
      window.clearTimeout(hardStop);
    };
  }, [fixedRunning, subscribeGazeFrame]);

  // --- TEST B Effect ---
  const startNinePointTest = async () => {
    if (!calibration) return;
    const ok = await ensureTrackingStarted();
    if (!ok) return;
    nineDataRef.current = {};
    setNineResult(null);
    setNineIdx(0);
    setNinePhase('settle');
    setNineRunning(true);
  };

  useEffect(() => {
    if (!nineRunning) return;

    const MEASURE_MS = 1400;
    const target = NINE_POINT_TARGETS[nineIdx];
    if (!target) {
      setNineRunning(false);
      return;
    }

    const startMs = performance.now();
    nineDataRef.current[target.id] = [];

    const finalizeAll = () => {
      const vp = getViewportSize();
      const diag = Math.hypot(vp.width, vp.height);
      const perTarget: NinePointTargetStat[] = [];
      let allErrs: number[] = [];
      let allAbsX: number[] = [];
      let allAbsY: number[] = [];
      let spreadSum = 0;

      for (const tgt of NINE_POINT_TARGETS) {
        const tx = tgt.normX * vp.width;
        const ty = tgt.normY * vp.height;
        const list = nineDataRef.current[tgt.id] ?? [];
        if (list.length === 0) {
          perTarget.push({
            targetId: tgt.id,
            label: tgt.labelEn,
            normX: tgt.normX,
            normY: tgt.normY,
            targetX: tx,
            targetY: ty,
            predMeanX: tx,
            predMeanY: ty,
            predMeanNormX: tgt.normX,
            predMeanNormY: tgt.normY,
            sampleCount: 0,
            meanErrorPx: 0,
            meanAbsX: 0,
            meanAbsY: 0,
            maxErrorPx: 0,
            spreadPx: 0,
          });
          continue;
        }
        const meanErr = list.reduce((a, b) => a + b.err, 0) / list.length;
        const meanX = list.reduce((a, b) => a + b.dx, 0) / list.length;
        const meanY = list.reduce((a, b) => a + b.dy, 0) / list.length;
        const predMeanX = list.reduce((a, b) => a + b.fx, 0) / list.length;
        const predMeanY = list.reduce((a, b) => a + b.fy, 0) / list.length;
        const predMeanNormX = list.reduce((a, b) => a + b.fnx, 0) / list.length;
        const predMeanNormY = list.reduce((a, b) => a + b.fny, 0) / list.length;
        const maxE = Math.max(...list.map((b) => b.err));
        const sx = stdDev(list.map((b) => b.fx));
        const sy = stdDev(list.map((b) => b.fy));
        const spread = Math.hypot(sx, sy);

        allErrs = allErrs.concat(list.map((b) => b.err));
        allAbsX = allAbsX.concat(list.map((b) => b.dx));
        allAbsY = allAbsY.concat(list.map((b) => b.dy));
        spreadSum += spread;

        perTarget.push({
          targetId: tgt.id,
          label: tgt.labelEn,
          normX: tgt.normX,
          normY: tgt.normY,
          targetX: tx,
          targetY: ty,
          predMeanX,
          predMeanY,
          predMeanNormX,
          predMeanNormY,
          sampleCount: list.length,
          meanErrorPx: meanErr,
          meanAbsX: meanX,
          meanAbsY: meanY,
          maxErrorPx: maxE,
          spreadPx: spread,
        });
      }

      const validCount = Math.max(1, allErrs.length);
      const meanErrPx = allErrs.reduce((a, b) => a + b, 0) / validCount;

      setNineResult({
        meanErrorPx: meanErrPx,
        meanNormErrorPct: (meanErrPx / Math.max(1, diag)) * 100,
        meanHorizErrorPx: allAbsX.reduce((a, b) => a + b, 0) / validCount,
        meanVertErrorPx: allAbsY.reduce((a, b) => a + b, 0) / validCount,
        maxErrorPx: allErrs.length > 0 ? Math.max(...allErrs) : 0,
        meanSpreadPx: spreadSum / NINE_POINT_TARGETS.length,
        perTarget,
      });
      setNineRunning(false);
    };

    const unsub = subscribeGazeFrame((frame: GazeFrameTelemetry) => {
      const elapsed = performance.now() - startMs;
      if (elapsed < CALIBRATION_SETTLE_MS) {
        setNinePhase('settle');
        return;
      }
      setNinePhase('measure');

      if (elapsed >= CALIBRATION_SETTLE_MS + MEASURE_MS) {
        if (nineIdx + 1 < NINE_POINT_TARGETS.length) {
          setNineIdx((prev) => prev + 1);
        } else {
          finalizeAll();
        }
        return;
      }

      if (frame.confident && !frame.isBlinking && frame.features) {
        const vp = getViewportSize();
        const tx = target.normX * vp.width;
        const ty = target.normY * vp.height;
        const dx = Math.abs(frame.filteredX - tx);
        const dy = Math.abs(frame.filteredY - ty);
        const err = Math.hypot(dx, dy);
        nineDataRef.current[target.id].push({
          dx,
          dy,
          err,
          fx: frame.filteredX,
          fy: frame.filteredY,
          fnx: frame.filteredNormX,
          fny: frame.filteredNormY,
        });
      }
    });

    const fallbackNext = window.setTimeout(() => {
      if (nineIdx + 1 < NINE_POINT_TARGETS.length) {
        setNineIdx((prev) => prev + 1);
      } else {
        finalizeAll();
      }
    }, CALIBRATION_SETTLE_MS + MEASURE_MS + 180);

    return () => {
      unsub();
      window.clearTimeout(fallbackNext);
    };
  }, [nineIdx, nineRunning, subscribeGazeFrame]);

  // --- TEST C Effect: Live Blink Telemetry + Personalized Open/Closed Calibration ---
  useEffect(() => {
    if (activeTab !== 'blink' || !isRunning) return;

    let lastUi = 0;
    const unsub = subscribeGazeFrame((frame: GazeFrameTelemetry) => {
      if (blinkCalStep === 'open' && frame.features && frame.features.earAvg > 0.14) {
        blinkSamplesRef.current.push(frame.features.earAvg);
      } else if (blinkCalStep === 'closed' && frame.features && frame.features.earAvg > 0.03) {
        blinkSamplesRef.current.push(frame.features.earAvg);
      }

      if (
        blinkTestActive &&
        frame.blink.lastBlinkEvent &&
        frame.blink.lastBlinkEvent.timestamp !== lastLoggedEventTsRef.current
      ) {
        lastLoggedEventTsRef.current = frame.blink.lastBlinkEvent.timestamp;
        const evt = frame.blink.lastBlinkEvent;
        setBlinkEventLog((prev) => [...prev, evt]);
      }

      const now = performance.now();
      if (now - lastUi >= 80) {
        lastUi = now;
        setLiveBlinkSnap(frame.blink);
      }
    });

    return () => unsub();
  }, [activeTab, blinkCalStep, blinkTestActive, isRunning, subscribeGazeFrame]);

  const runOpenEyeBaselineCapture = async () => {
    const ok = await ensureTrackingStarted();
    if (!ok) return;
    blinkSamplesRef.current = [];
    setBlinkCalMessage('Keep both eyes naturally open and look forward (2.5s)...');
    setBlinkCalStep('open');

    window.setTimeout(() => {
      const vals = blinkSamplesRef.current;
      setBlinkCalStep('idle');
      if (vals.length < 10) {
        setBlinkCalMessage('Insufficient frames captured. Ensure camera preview sees your face.');
        return;
      }
      const openMed = median(vals);
      setOpenEarCandidate(openMed);
      updateSettings((prev) => ({
        ...prev,
        eyeTracking: { ...prev.eyeTracking, blinkOpenEar: Number(openMed.toFixed(3)) },
      }));
      setBlinkCalMessage(
        `Open-eye EAR baseline saved: ${openMed.toFixed(3)}. Now capture natural blinks in Step 2.`
      );
    }, 2500);
  };

  const runNaturalBlinkCapture = async () => {
    const ok = await ensureTrackingStarted();
    if (!ok) return;
    blinkSamplesRef.current = [];
    setBlinkCalMessage('Perform 3–4 natural relaxed blinks over the next 4.5 seconds...');
    setBlinkCalStep('closed');

    window.setTimeout(() => {
      const vals = blinkSamplesRef.current;
      setBlinkCalStep('idle');
      if (vals.length < 15) {
        setBlinkCalMessage('Insufficient blink samples captured.');
        return;
      }
      // Lowest 10th percentile approximates full eyelid closure values during natural blinks
      const sorted = [...vals].sort((a, b) => a - b);
      const sliceCount = Math.max(2, Math.floor(sorted.length * 0.1));
      const closedMed = median(sorted.slice(0, sliceCount));
      const openVal = openEarCandidate ?? settings.eyeTracking.blinkOpenEar;
      const { closeThreshold, openThreshold } = computePersonalizedBlinkThresholds(
        openVal,
        closedMed
      );

      updateSettings((prev) => ({
        ...prev,
        eyeTracking: {
          ...prev.eyeTracking,
          blinkOpenEar: Number(openVal.toFixed(3)),
          blinkClosedEar: Number(closedMed.toFixed(3)),
        },
      }));
      setBlinkCalMessage(
        `Personalized blink thresholds saved — Open: ${openVal.toFixed(3)}, Closed: ${closedMed.toFixed(
          3
        )}, Close Thresh: ${closeThreshold.toFixed(3)}, Reopen Thresh: ${openThreshold.toFixed(3)}.`
      );
    }, 4500);
  };

  const startGuidedBlinkTest = async () => {
    const ok = await ensureTrackingStarted();
    if (!ok) return;
    if (!settings.eyeTracking.blinkSelectionEnabled) {
      updateSettings((prev) => ({
        ...prev,
        eyeTracking: { ...prev.eyeTracking, blinkSelectionEnabled: true },
      }));
    }
    resetBlinkStats();
    lastLoggedEventTsRef.current = 0;
    setBlinkEventLog([]);
    setBlinkTestActive(true);
  };

  // --- TEST D Effect: Keyboard Q, W, E, R, T & Alphabet Metrics ---
  useEffect(() => {
    if (activeTab !== 'keyboard' || !isRunning || !calibration) return;

    let lastUi = 0;
    const unsub = subscribeGazeFrame((frame: GazeFrameTelemetry) => {
      const rawId = frame.activeTargetId ?? '';
      const focusedLetter = rawId.startsWith('test_kbd_') ? rawId.replace('test_kbd_', '') : null;

      if (focusedLetter !== kbdPrevFocusedRef.current) {
        if (kbdPrevFocusedRef.current !== null || focusedLetter !== null) {
          kbdSwitchCountRef.current += 1;
        }
        kbdPrevFocusedRef.current = focusedLetter;
      }

      if (intendedKey !== 'FREE' && focusedLetter === intendedKey && kbdFirstFocusMsRef.current === null) {
        kbdFirstFocusMsRef.current = Math.round(performance.now() - kbdStartMsRef.current);
      }

      if (intendedKey && intendedKey !== 'FREE' && frame.confident && !frame.isBlinking) {
        if (focusedLetter !== null) {
          kbdWindowRef.current.push(focusedLetter === intendedKey);
          if (kbdWindowRef.current.length > 90) {
            kbdWindowRef.current.shift();
          }
        }
      }

      const now = performance.now();
      if (now - lastUi >= 90) {
        lastUi = now;
        const win = kbdWindowRef.current;
        const elapsedSec = Math.max(0.5, (now - kbdStartMsRef.current) / 1000);
        const stabilityPct =
          intendedKey !== 'FREE' && win.length >= 3
            ? Math.round((win.filter(Boolean).length / win.length) * 100)
            : null;
        setKbdTelemetry({
          rawX: frame.rawX,
          rawY: frame.rawY,
          filteredX: frame.filteredX,
          filteredY: frame.filteredY,
          focusedLetter,
          dwellProgress: frame.dwellProgress,
          stabilityPct,
          switchCount: kbdSwitchCountRef.current,
          switchesPerSec: Number((kbdSwitchCountRef.current / elapsedSec).toFixed(2)),
          timeToFocusMs: kbdFirstFocusMsRef.current,
          totalSamples: win.length,
        });
      }
    });

    return () => unsub();
  }, [activeTab, calibration, intendedKey, isRunning, subscribeGazeFrame]);

  const resetKeyboardTrial = (nextIntended: string) => {
    setIntendedKey(nextIntended);
    kbdWindowRef.current = [];
    kbdStartMsRef.current = performance.now();
    kbdFirstFocusMsRef.current = null;
    kbdPrevFocusedRef.current = null;
    kbdSwitchCountRef.current = 0;
    setDwellCompletions(0);
    setAccidentalSelections(0);
    setKbdTelemetry((prev) => ({
      ...prev,
      stabilityPct: null,
      switchCount: 0,
      switchesPerSec: 0,
      timeToFocusMs: null,
      totalSamples: 0,
    }));
  };

  // Evaluate Guided Test C sequence: 3 natural -> 1 intentional -> 1 natural
  const naturalCount = blinkEventLog.filter((e) => e.type === 'natural').length;
  const intentionalCount = blinkEventLog.filter((e) => e.type === 'intentional').length;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            <span>Diagnostic Mode & Signal Verification (Tests A–D)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            Empirically verify fixation jitter, 9-point accuracy, blink state transitions, and QWERTY key focus stability.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'fixed' as StabilityTab, label: 'Test A: Fixation (5s)', icon: Target },
            { id: 'nine-point' as StabilityTab, label: 'Test B: 9-Point Error', icon: Crosshair },
            { id: 'blink' as StabilityTab, label: 'Test C: Blink & EAR', icon: Eye },
            { id: 'keyboard' as StabilityTab, label: 'Test D: Alphabet (Q–T)', icon: Keyboard },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!calibration && activeTab !== 'blink' && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Complete 9-point eye calibration before running gaze accuracy and keyboard tests.</span>
          </div>
          {onNavigateCalibration && (
            <button
              type="button"
              onClick={onNavigateCalibration}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
            >
              Open Calibration
            </button>
          )}
        </div>
      )}

      {/* TEST A: Fixation Stability Test (5s) */}
      {activeTab === 'fixed' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Maintain steady fixation on the center target for 5 seconds to measure raw vs. filtered dispersion, max deviation, and rejected outliers.
            </div>
            <button
              type="button"
              disabled={!calibration || fixedRunning}
              onClick={startFixedPointTest}
              className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-45 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>{fixedRunning ? 'Running 5s Test...' : 'Start 5s Fixation Test'}</span>
            </button>
          </div>

          {fixedResult && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {[
                {
                  label: 'Filtered σX (Horiz)',
                  value: `${fixedResult.filteredStdX.toFixed(1)} px`,
                  sub: `Raw σX: ${fixedResult.rawStdX.toFixed(1)} px`,
                },
                {
                  label: 'Filtered σY (Vert)',
                  value: `${fixedResult.filteredStdY.toFixed(1)} px`,
                  sub: `Raw σY: ${fixedResult.rawStdY.toFixed(1)} px`,
                },
                {
                  label: 'Max Deviation',
                  value: `${fixedResult.maxDeviationPx.toFixed(1)} px`,
                  sub: 'Peak from mean',
                },
                {
                  label: 'Raw Gaze (X, Y)',
                  value: `${Math.round(fixedResult.lastRawX)}, ${Math.round(fixedResult.lastRawY)}`,
                  sub: 'Unfiltered last',
                },
                {
                  label: 'Filtered (X, Y)',
                  value: `${Math.round(fixedResult.lastFilteredX)}, ${Math.round(fixedResult.lastFilteredY)}`,
                  sub: '1-Euro output',
                },
                {
                  label: 'Outliers Rejected',
                  value: `${fixedResult.outlierCount}`,
                  sub: `${fixedResult.sampleCount} valid frames`,
                },
                {
                  label: 'Average FPS',
                  value: `${fixedResult.avgFps} FPS`,
                  sub: `Conf ${fixedResult.meanConfidence.toFixed(2)}`,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">{m.label}</span>
                  <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
                    {m.value}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {m.sub}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEST B: Nine-Point Accuracy Test + Spatial Error Visualization */}
      {activeTab === 'nine-point' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Measures real prediction error between ground-truth screen targets and observed filtered gaze across all 9 points.
            </div>
            <button
              type="button"
              disabled={!calibration || nineRunning}
              onClick={startNinePointTest}
              className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-45 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
              <span>{nineRunning ? 'Measuring 9 Points...' : 'Run 9-Point Accuracy Test'}</span>
            </button>
          </div>

          {nineResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  {
                    label: 'Mean Euclidean Error',
                    value: `${nineResult.meanErrorPx.toFixed(1)} px`,
                    sub: `${nineResult.meanNormErrorPct.toFixed(1)}% screen diag`,
                  },
                  {
                    label: 'Horizontal Error',
                    value: `${nineResult.meanHorizErrorPx.toFixed(1)} px`,
                  },
                  {
                    label: 'Vertical Error',
                    value: `${nineResult.meanVertErrorPx.toFixed(1)} px`,
                  },
                  {
                    label: 'Max Target Error',
                    value: `${nineResult.maxErrorPx.toFixed(1)} px`,
                  },
                  {
                    label: 'Fixation Spread (σ)',
                    value: `${nineResult.meanSpreadPx.toFixed(1)} px`,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">{m.label}</span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
                      {m.value}
                    </span>
                    {m.sub && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        {m.sub}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Spatial Error Vector Plot + Per-Target Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 mb-2 px-1">
                    <span>Spatial Error Map (Target ○ → Predicted ●)</span>
                    <span>Normalized Viewport</span>
                  </div>
                  <svg viewBox="0 0 320 200" className="w-full h-auto rounded-lg bg-slate-900">
                    {nineResult.perTarget.map((pt) => {
                      const tx = pt.normX * 320;
                      const ty = pt.normY * 200;
                      const px = Math.max(4, Math.min(316, pt.predMeanNormX * 320));
                      const py = Math.max(4, Math.min(196, pt.predMeanNormY * 200));
                      return (
                        <g key={pt.targetId}>
                          {pt.sampleCount > 0 && (
                            <line
                              x1={tx}
                              y1={ty}
                              x2={px}
                              y2={py}
                              stroke="#f59e0b"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                            />
                          )}
                          <circle cx={tx} cy={ty} r="5" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                          {pt.sampleCount > 0 && <circle cx={px} cy={py} r="4" fill="#14b8a6" />}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="lg:col-span-7 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500">
                        <th className="py-2 pr-3">Target</th>
                        <th className="py-2 pr-3">Ground Truth</th>
                        <th className="py-2 pr-3">Predicted Mean</th>
                        <th className="py-2 pr-3">Horiz / Vert</th>
                        <th className="py-2">Euclidean</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                      {nineResult.perTarget.map((pt) => (
                        <tr key={pt.targetId}>
                          <td className="py-2 pr-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            {pt.label}
                          </td>
                          <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                            {Math.round(pt.targetX)}, {Math.round(pt.targetY)}
                          </td>
                          <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                            {pt.sampleCount > 0
                              ? `${Math.round(pt.predMeanX)}, ${Math.round(pt.predMeanY)}`
                              : '—'}
                          </td>
                          <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                            {pt.sampleCount > 0
                              ? `${Math.round(pt.meanAbsX)} / ${Math.round(pt.meanAbsY)} px`
                              : '—'}
                          </td>
                          <td className="py-2 font-bold text-slate-900 dark:text-white">
                            {pt.sampleCount > 0 ? `${Math.round(pt.meanErrorPx)} px` : 'No data'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEST C: Blink State Machine, Personalized Threshold Calibration & Guided Blink Test */}
      {activeTab === 'blink' && (
        <div className="space-y-5">
          {/* Live Blink Diagnostic Display */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Left EAR (Smoothed)',
                value: liveBlinkSnap.earLeft.toFixed(3),
              },
              {
                label: 'Right EAR (Smoothed)',
                value: liveBlinkSnap.earRight.toFixed(3),
              },
              {
                label: 'Blink State',
                value: liveBlinkSnap.state,
              },
              {
                label: 'Closure Duration',
                value: `${Math.round(liveBlinkSnap.blinkDurationMs)} ms`,
              },
              {
                label: 'Blink Count',
                value: `${liveBlinkSnap.blinkCount}`,
              },
              {
                label: 'Intentional Long Blink',
                value:
                  liveBlinkSnap.lastBlinkEvent?.type === 'intentional'
                    ? `Detected (${liveBlinkSnap.lastBlinkEvent.durationMs}ms)`
                    : 'Not detected',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 block">{item.label}</span>
                <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1 block">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between gap-2">
            <span>
              Smoothed EAR: {liveBlinkSnap.smoothedEar.toFixed(3)} · Close Threshold:{' '}
              {liveBlinkSnap.closeThreshold.toFixed(3)} · Reopen Threshold:{' '}
              {liveBlinkSnap.openThreshold.toFixed(3)}
            </span>
            <span>Intentional Threshold: {settings.eyeTracking.longBlinkDurationMs} ms</span>
          </div>

          {/* Personalized Blink Baseline Calibration */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Personalized Blink Threshold Setup
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Calibrate your own open-eye and closed-eye EAR range with hysteresis instead of relying only on fixed defaults.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={blinkCalStep !== 'idle'}
                  onClick={runOpenEyeBaselineCapture}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
                >
                  {blinkCalStep === 'open' ? 'Sampling Open Eyes...' : '1. Measure Open Eyes (2.5s)'}
                </button>
                <button
                  type="button"
                  disabled={blinkCalStep !== 'idle'}
                  onClick={runNaturalBlinkCapture}
                  className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-45 text-white text-xs font-semibold cursor-pointer"
                >
                  {blinkCalStep === 'closed'
                    ? 'Recording Natural Blinks...'
                    : '2. Record Natural Blinks (4.5s)'}
                </button>
              </div>
            </div>
            {blinkCalMessage && (
              <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
                {blinkCalMessage}
              </p>
            )}
          </div>

          {/* Guided Blink Sequence Verification */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Blink Verification Sequence
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Perform: <strong>3 natural blinks</strong> → <strong>1 longer intentional blink (≥{settings.eyeTracking.longBlinkDurationMs} ms)</strong> → <strong>1 natural blink</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={startGuidedBlinkTest}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
              >
                {blinkTestActive ? 'Restart Blink Test Sequence' : 'Start Blink Test'}
              </button>
            </div>

            {blinkTestActive && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap gap-4 font-medium">
                  <span>Natural blinks recorded: {naturalCount}</span>
                  <span>Intentional long blinks recorded: {intentionalCount}</span>
                </div>
                {blinkEventLog.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {blinkEventLog.map((ev, i) => (
                      <span
                        key={`${ev.timestamp}_${i}`}
                        className={`px-2.5 py-1 rounded-md font-mono ${
                          ev.type === 'intentional'
                            ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-900 dark:text-teal-200 font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        #{i + 1} {ev.type} ({ev.durationMs} ms)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEST D: Alphabet Tracking Test (Q, W, E, R, T & Full QWERTY) */}
      {activeTab === 'keyboard' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Intended Key:</span>
              {['Q', 'W', 'E', 'R', 'T', 'FREE'].map((keyName) => (
                <button
                  key={keyName}
                  type="button"
                  onClick={() => resetKeyboardTrial(keyName)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    intendedKey === keyName
                      ? 'bg-slate-900 dark:bg-teal-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {keyName === 'FREE' ? 'Free Hover' : keyName}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {settings.interface.interactionMode !== 'gaze' && (
                <button
                  type="button"
                  onClick={() =>
                    updateSettings((prev) => ({
                      ...prev,
                      interface: { ...prev.interface, interactionMode: 'gaze' },
                    }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Activate Gaze + Dwell
                </button>
              )}
              {!isRunning && (
                <button
                  type="button"
                  onClick={() => startTracking()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Start Tracking
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Gaze Coords (CSS px)</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {Math.round(kbdTelemetry.filteredX)}, {Math.round(kbdTelemetry.filteredY)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Focused Letter</span>
              <span className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
                {kbdTelemetry.focusedLetter ?? '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Target Recognition ({intendedKey})</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {kbdTelemetry.stabilityPct !== null ? `${kbdTelemetry.stabilityPct}%` : 'Look at key...'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Switch Frequency</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {kbdTelemetry.switchesPerSec}/s ({kbdTelemetry.switchCount})
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Time to Stable Focus</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {kbdTelemetry.timeToFocusMs !== null ? `${kbdTelemetry.timeToFocusMs} ms` : '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Dwell / Accidental</span>
              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {dwellCompletions} OK · {accidentalSelections} Err
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm">
            <div>
              <span className="text-xs text-slate-500 mr-2">Selections:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {typedPreview || '(look steadily at Q, W, E, R, or T to test focus & dwell)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTypedPreview('');
                resetKeyboardTrial(intendedKey);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {EN_LETTER_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {row.map((keyObj) => {
                  const isIntended = intendedKey === keyObj.label;
                  return (
                    <GazeButton
                      key={keyObj.id}
                      gazeId={`test_kbd_${keyObj.label}`}
                      variant={isIntended ? 'selected' : 'default'}
                      sizeOverride={settings.interface.buttonSize === 'standard' ? 'standard' : 'large'}
                      onClick={() => {
                        setTypedPreview((prev) => `${prev}${keyObj.label}`.slice(-24));
                        if (intendedKey !== 'FREE') {
                          if (keyObj.label === intendedKey) {
                            setDwellCompletions((c) => c + 1);
                          } else {
                            setAccidentalSelections((c) => c + 1);
                          }
                        }
                      }}
                      className="px-2"
                    >
                      <span className="text-lg font-semibold">{keyObj.label}</span>
                    </GazeButton>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Fixed-Point Test Overlay (z-40 keeps GazeCursor z-50 visible on top) */}
      {fixedRunning && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 text-white select-none flex items-center justify-center">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-4 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm">
            <span className="font-semibold">
              Test A: Fixation Stability ({(fixedElapsedMs / 1000).toFixed(1)}s / 5.0s)
            </span>
            {fixedLive && (
              <span className="font-mono tabular-nums text-slate-300">
                Raw ({Math.round(fixedLive.rawX)},{Math.round(fixedLive.rawY)}) · Filt (
                {Math.round(fixedLive.filteredX)},{Math.round(fixedLive.filteredY)}) · Conf{' '}
                {fixedLive.confidence.toFixed(2)} · {fixedLive.fps} FPS
              </span>
            )}
            <button
              type="button"
              onClick={() => setFixedRunning(false)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>

          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-teal-400/60" />
            <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white" />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-300">
            Keep your gaze fixed directly on the center dot.
          </div>
        </div>
      )}

      {/* Fullscreen 9-Point Error Test Overlay */}
      {nineRunning && NINE_POINT_TARGETS[nineIdx] && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 text-white select-none">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm">
            <span className="font-semibold">
              Test B: 9-Point Accuracy ({nineIdx + 1}/9): {NINE_POINT_TARGETS[nineIdx].labelEn}
            </span>
            <span className="text-slate-300 text-xs">
              {ninePhase === 'settle' ? 'Settling gaze...' : 'Measuring error...'}
            </span>
            <button
              type="button"
              onClick={() => setNineRunning(false)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{
              left: `${NINE_POINT_TARGETS[nineIdx].normX * 100}%`,
              top: `${NINE_POINT_TARGETS[nineIdx].normY * 100}%`,
            }}
          >
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border-2 ${
                  ninePhase === 'settle' ? 'border-amber-400' : 'border-teal-400'
                }`}
              />
              <div className="w-3 h-3 rounded-full bg-white" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
