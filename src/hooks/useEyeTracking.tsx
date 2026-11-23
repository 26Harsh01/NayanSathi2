import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  BlinkDiagnosticState,
  CameraErrorCode,
  DetectedFaceSummary,
  GazeFeatures,
  TrackingStatus,
} from '../types';
import { useAppState } from '../context/AppStateContext';
import { startWebcamStream, stopWebcamStream } from '../features/eye-tracking/camera-manager';
import { getFaceLandmarker } from '../features/eye-tracking/face-landmarker';
import {
  AdaptiveEarBaseline,
  buildGazeFeatureVector,
  extractGazeFeatures,
} from '../features/eye-tracking/gaze-features';
import { predictGazeNormalized } from '../features/eye-tracking/gaze-regression';
import { GazeOutlierFilter } from '../features/eye-tracking/outlier-filter';
import { OneEuroFilter2D } from '../features/eye-tracking/one-euro-filter';
import {
  BlinkDetector,
  computePersonalizedBlinkThresholds,
} from '../features/eye-tracking/blink-detector';
import { DwellManager, type TargetRect } from '../features/eye-tracking/dwell-manager';
import { isCalibrationStaleForViewport } from '../features/eye-tracking/calibration';
import {
  resolveTrackedFace,
  summarizeDetectedFaces,
  type FaceAnchor,
} from '../features/eye-tracking/face-subject';
import type { NormalizedLandmark } from '../features/eye-tracking/iris-extractor';

export interface GazeDiagnosticsSnapshot {
  status: TrackingStatus;
  fps: number;
  confidence: number;
  rawX: number;
  rawY: number;
  filteredX: number;
  filteredY: number;
  earAvg: number;
  isBlinking: boolean;
  faceCount: number;
  detectedFaces: DetectedFaceSummary[];
  requiresSubjectSelection: boolean;
  selectedSubjectLabel: string | null;
  focusedTargetId: string | null;
  focusedTargetLabel: string | null;
  yaw: number;
  pitch: number;
  roll: number;
  headMovementWarning: boolean;
  landmarks: NormalizedLandmark[] | null;
  allFaceLandmarks: NormalizedLandmark[][];
  blink: BlinkDiagnosticState;
}

export interface LiveGazeCursorState {
  x: number;
  y: number;
  visible: boolean;
  confidence: number;
  isBlinking: boolean;
  activeTargetId: string | null;
  dwellProgress: number;
}

export interface GazeFrameTelemetry {
  timestamp: number;
  status: TrackingStatus;
  features: GazeFeatures | null;
  rawX: number;
  rawY: number;
  rawNormX: number;
  rawNormY: number;
  filteredX: number;
  filteredY: number;
  filteredNormX: number;
  filteredNormY: number;
  wasOutlier: boolean;
  activeTargetId: string | null;
  dwellProgress: number;
  fps: number;
  confident: boolean;
  isBlinking: boolean;
  headMovementWarning: boolean;
  blink: BlinkDiagnosticState;
}

interface EyeTrackingContextValue {
  status: TrackingStatus;
  errorCode: CameraErrorCode | null;
  errorMessage: string | null;
  isRunning: boolean;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  setIsCalibrating: (calibrating: boolean) => void;
  calibrationStale: boolean;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  resetBlinkStats: () => void;
  selectTrackingSubject: (faceIndex: number) => void;
  clearSelectedSubject: () => void;
  diagnostics: GazeDiagnosticsSnapshot;
  cursorStateRef: React.MutableRefObject<LiveGazeCursorState>;
  subscribeFrameFeatures: (cb: (features: GazeFeatures | null) => void) => () => void;
  subscribeGazeFrame: (cb: (frame: GazeFrameTelemetry) => void) => () => void;
  attachPreviewVideo: (videoEl: HTMLVideoElement | null) => void;
}

const DEFAULT_THRESH = computePersonalizedBlinkThresholds(0.29, 0.11);

const INITIAL_BLINK_STATE: BlinkDiagnosticState = {
  state: 'OPEN',
  earLeft: 0,
  earRight: 0,
  smoothedEar: 0,
  isBlinking: false,
  blinkDurationMs: 0,
  blinkCount: 0,
  longBlinkTriggered: false,
  lastBlinkEvent: null,
  openBaselineEar: 0.29,
  closedBaselineEar: 0.11,
  closeThreshold: DEFAULT_THRESH.closeThreshold,
  openThreshold: DEFAULT_THRESH.openThreshold,
};

const INITIAL_DIAGNOSTICS: GazeDiagnosticsSnapshot = {
  status: 'idle',
  fps: 0,
  confidence: 0,
  rawX: 0,
  rawY: 0,
  filteredX: 0,
  filteredY: 0,
  earAvg: 0,
  isBlinking: false,
  faceCount: 0,
  detectedFaces: [],
  requiresSubjectSelection: false,
  selectedSubjectLabel: null,
  focusedTargetId: null,
  focusedTargetLabel: null,
  yaw: 0,
  pitch: 0,
  roll: 0,
  headMovementWarning: false,
  landmarks: null,
  allFaceLandmarks: [],
  blink: INITIAL_BLINK_STATE,
};

function getCssViewport(): { width: number; height: number } {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }
  const width = Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1280);
  const height = Math.max(1, document.documentElement.clientHeight || window.innerHeight || 720);
  return { width, height };
}

const EyeTrackingContext = createContext<EyeTrackingContextValue | null>(null);

export const EyeTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, calibration } = useAppState();

  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [errorCode, setErrorCode] = useState<CameraErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [diagnostics, setDiagnostics] = useState<GazeDiagnosticsSnapshot>(INITIAL_DIAGNOSTICS);
  const [calibrationStale, setCalibrationStale] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const loopSessionRef = useRef<number>(0);
  const startingRef = useRef<boolean>(false);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastDetectTimestampRef = useRef<number>(0);

  const frameListenersRef = useRef<Set<(features: GazeFeatures | null) => void>>(new Set());
  const telemetryListenersRef = useRef<Set<(frame: GazeFrameTelemetry) => void>>(new Set());

  const earBaselineRef = useRef(new AdaptiveEarBaseline());
  const outlierFilterRef = useRef(
    new GazeOutlierFilter({
      sigmaThreshold: settings.eyeTracking.outlierThreshold,
    })
  );
  const filterRef = useRef(
    new OneEuroFilter2D({
      minCutoff: settings.eyeTracking.minCutoff,
      beta: settings.eyeTracking.beta,
      dCutoff: settings.eyeTracking.dCutoff,
    })
  );
  const blinkRef = useRef(
    new BlinkDetector({
      openBaselineEar: settings.eyeTracking.blinkOpenEar,
      closedBaselineEar: settings.eyeTracking.blinkClosedEar,
      longBlinkDurationMs: settings.eyeTracking.longBlinkDurationMs,
      blinkSelectionEnabled: settings.eyeTracking.blinkSelectionEnabled,
      allowSingleEyeFallback: settings.eyeTracking.allowSingleEyeBlinkFallback,
    })
  );
  const dwellRef = useRef(
    new DwellManager({
      dwellDurationMs: settings.eyeTracking.dwellDurationMs,
      dwellTolerancePx: settings.eyeTracking.dwellTolerancePx,
      targetHysteresisPx: settings.eyeTracking.targetHysteresisPx,
      selectionCooldownMs: settings.eyeTracking.selectionCooldownMs,
    })
  );

  const initialVp = getCssViewport();
  const cursorStateRef = useRef<LiveGazeCursorState>({
    x: initialVp.width / 2,
    y: initialVp.height / 2,
    visible: false,
    confidence: 0,
    isBlinking: false,
    activeTargetId: null,
    dwellProgress: 0,
  });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isCalibratingRef = useRef(false);
  const selectedAnchorRef = useRef<FaceAnchor | null>(null);
  const latestDetectedFacesRef = useRef<DetectedFaceSummary[]>([]);

  const setIsCalibrating = useCallback((calibrating: boolean) => {
    isCalibratingRef.current = calibrating;
    if (calibrating) {
      dwellRef.current.reset();
      blinkRef.current.reset();
    }
  }, []);

  const resetBlinkStats = useCallback(() => {
    blinkRef.current.resetAllStats();
  }, []);

  const selectTrackingSubject = useCallback((faceIndex: number) => {
    const match = latestDetectedFacesRef.current.find((f) => f.index === faceIndex);
    if (!match) return;
    selectedAnchorRef.current = {
      centerX: match.centerX,
      centerY: match.centerY,
      scale: match.scale,
      displayNumber: match.displayNumber,
    };
    outlierFilterRef.current.reset();
    filterRef.current.reset();
    dwellRef.current.reset();
  }, []);

  const clearSelectedSubject = useCallback(() => {
    selectedAnchorRef.current = null;
    dwellRef.current.reset();
  }, []);

  useEffect(() => {
    const checkStaleness = () => {
      const vp = getCssViewport();
      setCalibrationStale(isCalibrationStaleForViewport(calibration, vp.width, vp.height));
    };
    checkStaleness();
    window.addEventListener('resize', checkStaleness);
    return () => window.removeEventListener('resize', checkStaleness);
  }, [calibration]);

  useEffect(() => {
    outlierFilterRef.current.updateConfig({
      sigmaThreshold: settings.eyeTracking.outlierThreshold,
    });
    filterRef.current.updateConfig({
      minCutoff: settings.eyeTracking.minCutoff,
      beta: settings.eyeTracking.beta,
      dCutoff: settings.eyeTracking.dCutoff,
    });
    blinkRef.current.updateConfig({
      openBaselineEar: settings.eyeTracking.blinkOpenEar,
      closedBaselineEar: settings.eyeTracking.blinkClosedEar,
      longBlinkDurationMs: settings.eyeTracking.longBlinkDurationMs,
      blinkSelectionEnabled: settings.eyeTracking.blinkSelectionEnabled,
      allowSingleEyeFallback: settings.eyeTracking.allowSingleEyeBlinkFallback,
    });
    dwellRef.current.updateConfig({
      dwellDurationMs: settings.eyeTracking.dwellDurationMs,
      dwellTolerancePx: settings.eyeTracking.dwellTolerancePx,
      targetHysteresisPx: settings.eyeTracking.targetHysteresisPx,
      selectionCooldownMs: settings.eyeTracking.selectionCooldownMs,
    });
  }, [settings]);

  useEffect(() => {
    if (isPaused) {
      cursorStateRef.current.visible = false;
      cursorStateRef.current.activeTargetId = null;
      cursorStateRef.current.dwellProgress = 0;
      dwellRef.current.reset();
      filterRef.current.reset();
      outlierFilterRef.current.reset();
    }
  }, [isPaused]);

  const attachPreviewVideo = useCallback((videoEl: HTMLVideoElement | null) => {
    previewVideoRef.current = videoEl;
    if (videoEl && streamRef.current) {
      videoEl.srcObject = streamRef.current;
      videoEl.play().catch(() => {});
    }
  }, []);

  const subscribeFrameFeatures = useCallback(
    (cb: (features: GazeFeatures | null) => void) => {
      frameListenersRef.current.add(cb);
      return () => {
        frameListenersRef.current.delete(cb);
      };
    },
    []
  );

  const subscribeGazeFrame = useCallback(
    (cb: (frame: GazeFrameTelemetry) => void) => {
      telemetryListenersRef.current.add(cb);
      return () => {
        telemetryListenersRef.current.delete(cb);
      };
    },
    []
  );

  const stopTracking = useCallback(() => {
    loopSessionRef.current += 1;
    startingRef.current = false;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    stopWebcamStream(streamRef.current);
    streamRef.current = null;

    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current.remove();
      hiddenVideoRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }

    lastVideoTimeRef.current = -1;
    selectedAnchorRef.current = null;
    latestDetectedFacesRef.current = [];
    earBaselineRef.current.reset();
    outlierFilterRef.current.reset();
    filterRef.current.reset();
    blinkRef.current.reset();
    dwellRef.current.reset();
    cursorStateRef.current.visible = false;
    cursorStateRef.current.activeTargetId = null;
    cursorStateRef.current.dwellProgress = 0;

    setIsRunning(false);
    setStatus('idle');
    setDiagnostics(INITIAL_DIAGNOSTICS);
  }, []);

  const triggerTargetElement = useCallback((targetId: string) => {
    const el = document.querySelector<HTMLElement>(`[data-gaze-target="${CSS.escape(targetId)}"]`);
    if (el && !el.hasAttribute('disabled')) {
      el.click();
    }
  }, []);

  const startTracking = useCallback(async (): Promise<boolean> => {
    if (isRunning && streamRef.current) return true;
    if (startingRef.current) return false;
    startingRef.current = true;

    const mySession = loopSessionRef.current + 1;
    loopSessionRef.current = mySession;

    setStatus('initializing');
    setErrorCode(null);
    setErrorMessage(null);

    const camRes = await startWebcamStream(640, 480);
    if (loopSessionRef.current !== mySession) {
      if (camRes.stream) stopWebcamStream(camRes.stream);
      startingRef.current = false;
      return false;
    }

    if (!camRes.ok || !camRes.stream) {
      setStatus('camera-error');
      setErrorCode(camRes.errorCode ?? 'unknown');
      setErrorMessage(camRes.errorMessage ?? 'Unable to access webcam.');
      setIsRunning(false);
      startingRef.current = false;
      return false;
    }

    streamRef.current = camRes.stream;

    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.style.position = 'fixed';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.left = '-9999px';
    document.body.appendChild(video);
    video.srcObject = camRes.stream;
    hiddenVideoRef.current = video;

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = camRes.stream;
      previewVideoRef.current.play().catch(() => {});
    }

    try {
      await video.play();
      const landmarker = await getFaceLandmarker();

      if (loopSessionRef.current !== mySession) {
        startingRef.current = false;
        return false;
      }

      startingRef.current = false;
      setIsRunning(true);
      setStatus('ready');

      let fpsCounter = 0;
      let fpsWindowStart = performance.now();
      let measuredFps = 0;
      let lastDiagEmit = 0;
      let lastGoodTimestamp = 0;
      let lastBaselineEar = settingsRef.current.eyeTracking.blinkOpenEar;
      let lastSmoothNormX = 0.5;
      let lastSmoothNormY = 0.5;
      let lastFocusedTargetId: string | null = null;
      let lastFocusedTargetLabel: string | null = null;

      const loop = () => {
        if (loopSessionRef.current !== mySession || !streamRef.current || !hiddenVideoRef.current) {
          return;
        }
        const vid = hiddenVideoRef.current;
        const now = performance.now();

        if (isPausedRef.current) {
          rafIdRef.current = requestAnimationFrame(loop);
          return;
        }

        if (vid.readyState >= 2 && vid.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = vid.currentTime;

          const detectTs = Math.max(lastDetectTimestampRef.current + 1, Math.round(now));
          lastDetectTimestampRef.current = detectTs;

          let result;
          try {
            result = landmarker.detectForVideo(vid, detectTs);
          } catch {
            result = null;
          }

          fpsCounter += 1;
          if (now - fpsWindowStart >= 1000) {
            measuredFps = Math.round((fpsCounter * 1000) / (now - fpsWindowStart));
            fpsCounter = 0;
            fpsWindowStart = now;
          }

          const allFaceLandmarks = (result?.faceLandmarks ?? []) as NormalizedLandmark[][];
          const faceCount = allFaceLandmarks.length;
          const detectedFaces = summarizeDetectedFaces(allFaceLandmarks);
          latestDetectedFacesRef.current = detectedFaces;

          const resolution = resolveTrackedFace(detectedFaces, selectedAnchorRef.current);
          selectedAnchorRef.current = resolution.nextAnchor;

          const activeFaceIdx = resolution.activeIndex;
          const primaryLandmarks =
            activeFaceIdx >= 0 && activeFaceIdx < allFaceLandmarks.length
              ? allFaceLandmarks[activeFaceIdx]
              : null;
          const matrix =
            activeFaceIdx >= 0 &&
            result?.facialTransformationMatrixes &&
            activeFaceIdx < result.facialTransformationMatrixes.length
              ? result.facialTransformationMatrixes[activeFaceIdx].data
              : null;

          const curSettings = settingsRef.current;
          const curCal = calibrationRef.current;

          const effectiveFaceCount = resolution.ambiguous
            ? faceCount
            : primaryLandmarks
              ? 1
              : 0;

          const features =
            !resolution.ambiguous && primaryLandmarks
              ? extractGazeFeatures(primaryLandmarks, effectiveFaceCount, now, matrix, {
                  baselineEar: Math.max(lastBaselineEar, curSettings.eyeTracking.blinkOpenEar * 0.9),
                })
              : null;

          if (
            features &&
            !resolution.ambiguous &&
            !features.isBlinking &&
            features.leftEye?.reliable &&
            features.rightEye?.reliable
          ) {
            lastBaselineEar = earBaselineRef.current.update(features.earAvg);
          }

          for (const listener of frameListenersRef.current) {
            listener(features);
          }

          const vp = getCssViewport();

          let nextStatus: TrackingStatus = 'ready';
          let rawX = cursorStateRef.current.x;
          let rawY = cursorStateRef.current.y;
          let rawNormX = lastSmoothNormX;
          let rawNormY = lastSmoothNormY;
          let filteredX = rawX;
          let filteredY = rawY;
          let filteredNormX = lastSmoothNormX;
          let filteredNormY = lastSmoothNormY;
          let wasOutlier = false;
          let confident = false;
          let isBlinking = false;
          let headMovementWarning = Boolean(features?.headPose.excessiveMovement);
          const blinkState: BlinkDiagnosticState = blinkRef.current.process({
            earLeft: features?.earLeft ?? 0,
            earRight: features?.earRight ?? 0,
            leftReliable: Boolean(features?.leftEye?.reliable),
            rightReliable: Boolean(features?.rightEye?.reliable),
            faceValid: !resolution.ambiguous && features !== null,
            timestampMs: now,
            suppressForCalibration: isCalibratingRef.current,
          });

          if (curCal && features) {
            const bp = curCal.model.baselinePose;
            const dYaw = Math.abs(features.headPose.yaw - bp.yaw);
            const dPitch = Math.abs(features.headPose.pitch - bp.pitch);
            const dCx = Math.abs(features.headPose.faceCenterX - bp.faceCenterX);
            if (dYaw > 0.42 || dPitch > 0.42 || dCx > 0.22) {
              headMovementWarning = true;
            }
          }

          const lossTimeout = curSettings.eyeTracking.trackingLossTimeoutMs;

          if (resolution.ambiguous) {
            nextStatus = 'multiple-faces';
            cursorStateRef.current.visible = false;
            cursorStateRef.current.activeTargetId = null;
            cursorStateRef.current.dwellProgress = 0;
            dwellRef.current.reset();
            outlierFilterRef.current.reset();
            filterRef.current.reset();
          } else if (faceCount === 0 || !features) {
            nextStatus = 'no-face';
            const lostMs = lastGoodTimestamp > 0 ? now - lastGoodTimestamp : Infinity;
            if (lostMs > lossTimeout) {
              cursorStateRef.current.visible = false;
              cursorStateRef.current.activeTargetId = null;
              cursorStateRef.current.dwellProgress = 0;
              outlierFilterRef.current.reset();
              filterRef.current.reset();
            }
            dwellRef.current.reset();
          } else {
            isBlinking = blinkState.isBlinking || features.isBlinking;

            const preBlinkConfident =
              (features.leftEye !== null || features.rightEye !== null) &&
              features.confidence >= curSettings.eyeTracking.confidenceThreshold;

            if (isBlinking) {
              nextStatus = 'blink-paused';
              // Natural blink: pause dwell without cancelling active target
              confident = true;
            } else if (features.confidence < curSettings.eyeTracking.confidenceThreshold) {
              nextStatus = 'low-confidence';
              confident = false;
            } else {
              nextStatus = 'tracking';
              confident = true;
            }

            if (curCal && !isCalibratingRef.current) {
              if (!isBlinking && preBlinkConfident) {
                const featVec = buildGazeFeatureVector(features);
                const rawNorm = predictGazeNormalized(curCal.model, featVec);
                rawNormX = rawNorm.normX;
                rawNormY = rawNorm.normY;
                rawX = Math.max(0, Math.min(vp.width, rawNormX * vp.width));
                rawY = Math.max(0, Math.min(vp.height, rawNormY * vp.height));

                const clean = outlierFilterRef.current.filter(rawNormX, rawNormY);
                wasOutlier = clean.wasOutlier;

                const smoothedNorm = filterRef.current.filter(clean.normX, clean.normY, now);
                filteredNormX = Math.max(0, Math.min(1, smoothedNorm.x));
                filteredNormY = Math.max(0, Math.min(1, smoothedNorm.y));
                lastSmoothNormX = filteredNormX;
                lastSmoothNormY = filteredNormY;

                filteredX = filteredNormX * vp.width;
                filteredY = filteredNormY * vp.height;

                cursorStateRef.current.x = filteredX;
                cursorStateRef.current.y = filteredY;
                cursorStateRef.current.visible = curSettings.eyeTracking.cursorVisible;
                lastGoodTimestamp = now;
              } else {
                // Hold last valid cursor position without feeding blink/low-confidence noise into filters
                filteredX = cursorStateRef.current.x;
                filteredY = cursorStateRef.current.y;

                const lostMs = lastGoodTimestamp > 0 ? now - lastGoodTimestamp : Infinity;
                const holdLimit = isBlinking ? Math.max(1500, lossTimeout) : lossTimeout;
                if (!isBlinking && lostMs > holdLimit) {
                  cursorStateRef.current.visible = false;
                  outlierFilterRef.current.reset();
                  filterRef.current.reset();
                } else {
                  cursorStateRef.current.visible =
                    curSettings.eyeTracking.cursorVisible && lastGoodTimestamp > 0;
                }
              }

              cursorStateRef.current.confidence = features.confidence;
              cursorStateRef.current.isBlinking = isBlinking;

              if (curSettings.interface.interactionMode === 'gaze') {
                const els = document.querySelectorAll<HTMLElement>('[data-gaze-target]');
                const rects: TargetRect[] = [];
                els.forEach((el) => {
                  if (el.hasAttribute('disabled')) return;
                  const r = el.getBoundingClientRect();
                  if (r.width > 0 && r.height > 0) {
                    const id = el.getAttribute('data-gaze-target');
                    if (id) {
                      rects.push({
                        id,
                        left: r.left,
                        top: r.top,
                        right: r.right,
                        bottom: r.bottom,
                      });
                    }
                  }
                });

                const dwell = dwellRef.current.update(
                  cursorStateRef.current.x,
                  cursorStateRef.current.y,
                  rects,
                  now,
                  { isBlinking, confident }
                );

                cursorStateRef.current.activeTargetId = dwell.activeTargetId;
                cursorStateRef.current.dwellProgress = dwell.progress;

                if (dwell.triggeredTargetId) {
                  triggerTargetElement(dwell.triggeredTargetId);
                } else if (blinkState.longBlinkTriggered && dwell.activeTargetId) {
                  triggerTargetElement(dwell.activeTargetId);
                  dwellRef.current.reset();
                }
              } else {
                cursorStateRef.current.activeTargetId = null;
                cursorStateRef.current.dwellProgress = 0;
              }
            } else {
              cursorStateRef.current.visible = false;
              cursorStateRef.current.activeTargetId = null;
              cursorStateRef.current.dwellProgress = 0;
            }
          }

          if (telemetryListenersRef.current.size > 0) {
            const telemetryFrame: GazeFrameTelemetry = {
              timestamp: now,
              status: nextStatus,
              features,
              rawX,
              rawY,
              rawNormX,
              rawNormY,
              filteredX,
              filteredY,
              filteredNormX,
              filteredNormY,
              wasOutlier,
              activeTargetId: cursorStateRef.current.activeTargetId,
              dwellProgress: cursorStateRef.current.dwellProgress,
              fps: measuredFps,
              confident,
              isBlinking,
              headMovementWarning,
              blink: blinkState,
            };
            for (const cb of telemetryListenersRef.current) {
              cb(telemetryFrame);
            }
          }

          if (cursorStateRef.current.activeTargetId !== lastFocusedTargetId) {
            lastFocusedTargetId = cursorStateRef.current.activeTargetId;
            if (lastFocusedTargetId) {
              const focusedEl = document.querySelector<HTMLElement>(
                `[data-gaze-target="${CSS.escape(lastFocusedTargetId)}"]`
              );
              lastFocusedTargetLabel =
                focusedEl?.getAttribute('data-gaze-label') ||
                focusedEl?.getAttribute('aria-label') ||
                focusedEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 32) ||
                lastFocusedTargetId;
            } else {
              lastFocusedTargetLabel = null;
            }
          }

          if (now - lastDiagEmit >= 120) {
            lastDiagEmit = now;
            setStatus(nextStatus);
            const selectedSubjectLabel = resolution.ambiguous
              ? null
              : resolution.activeFace
                ? faceCount > 1 && selectedAnchorRef.current
                  ? `Subject ${selectedAnchorRef.current.displayNumber} (Locked)`
                  : resolution.activeFace.label
                : null;

            setDiagnostics({
              status: nextStatus,
              fps: measuredFps,
              confidence: features?.confidence ?? 0,
              rawX,
              rawY,
              filteredX,
              filteredY,
              earAvg: features?.earAvg ?? 0,
              isBlinking,
              faceCount,
              detectedFaces,
              requiresSubjectSelection: resolution.ambiguous,
              selectedSubjectLabel,
              focusedTargetId: lastFocusedTargetId,
              focusedTargetLabel: lastFocusedTargetLabel,
              yaw: features?.headPose.yaw ?? 0,
              pitch: features?.headPose.pitch ?? 0,
              roll: features?.headPose.roll ?? 0,
              headMovementWarning,
              landmarks: primaryLandmarks,
              allFaceLandmarks,
              blink: blinkState,
            });
          }
        }

        rafIdRef.current = requestAnimationFrame(loop);
      };

      rafIdRef.current = requestAnimationFrame(loop);
      return true;
    } catch (err) {
      startingRef.current = false;
      stopTracking();
      setStatus('camera-error');
      setErrorCode('unknown');
      setErrorMessage(
        err instanceof Error
          ? `Eye-tracking model failed to initialize: ${err.message}`
          : 'Eye-tracking initialization error.'
      );
      return false;
    }
  }, [isRunning, stopTracking, triggerTargetElement]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return (
    <EyeTrackingContext.Provider
      value={{
        status,
        errorCode,
        errorMessage,
        isRunning,
        isPaused,
        setIsPaused,
        setIsCalibrating,
        calibrationStale,
        startTracking,
        stopTracking,
        resetBlinkStats,
        selectTrackingSubject,
        clearSelectedSubject,
        diagnostics,
        cursorStateRef,
        subscribeFrameFeatures,
        subscribeGazeFrame,
        attachPreviewVideo,
      }}
    >
      {children}
    </EyeTrackingContext.Provider>
  );
};

export function useEyeTracking(): EyeTrackingContextValue {
  const ctx = useContext(EyeTrackingContext);
  if (!ctx) {
    throw new Error('useEyeTracking must be used within EyeTrackingProvider');
  }
  return ctx;
}
