import { describe, expect, it } from 'vitest';
import { OneEuroFilter, OneEuroFilter2D } from '../eye-tracking/one-euro-filter';
import { GazeOutlierFilter } from '../eye-tracking/outlier-filter';
import {
  predictGazeNormalized,
  predictGazeScreen,
  standardizeVector,
  trainRidgeRegression,
} from '../eye-tracking/gaze-regression';
import {
  buildCalibrationProfile,
  filterPointOutliers,
  isCalibrationStaleForViewport,
  NINE_POINT_TARGETS,
} from '../eye-tracking/calibration';
import { computeEyeAspectRatio } from '../eye-tracking/iris-extractor';
import {
  AdaptiveEarBaseline,
  buildGazeFeatureVector,
  compensateGazeWithHeadPose,
  extractGazeFeatures,
} from '../eye-tracking/gaze-features';
import { estimateHeadPose } from '../eye-tracking/head-pose';
import { DwellManager } from '../eye-tracking/dwell-manager';
import {
  BlinkDetector,
  computePersonalizedBlinkThresholds,
} from '../eye-tracking/blink-detector';
import {
  appendCharacterToSentence,
  appendPhraseToSentence,
  backspaceCharacter,
  clearSentence,
  createInitialSentenceState,
  deleteLastWord,
  undoSentence,
} from '../communication/sentence-builder';
import { generateOfflineSuggestions } from '../ai/offline-fallback';
import {
  appendCommunicationHistory,
  clearAllLocalData,
  DEFAULT_SETTINGS,
  loadCalibration,
  loadCommunicationHistory,
  loadSettings,
  saveSettings,
} from '../storage/local-storage';
import type { CalibrationSample } from '../../types';

function makeMockLandmarks(irisShiftX = 0, irisShiftY = 0, earOpen = 0.28) {
  const lms = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Face references
  lms[1] = { x: 0.5, y: 0.52, z: 0 }; // noseTip
  lms[168] = { x: 0.5, y: 0.42, z: 0 }; // noseBridge
  lms[10] = { x: 0.5, y: 0.25, z: 0 }; // forehead
  lms[152] = { x: 0.5, y: 0.8, z: 0 }; // chin

  const halfLid = earOpen * 0.06;

  // Subject's right eye (viewer-left [33, 160, 158, 133, 153, 144])
  lms[33] = { x: 0.35, y: 0.42, z: 0 };
  lms[133] = { x: 0.43, y: 0.42, z: 0 };
  lms[159] = { x: 0.39, y: 0.42 - halfLid, z: 0 };
  lms[160] = { x: 0.37, y: 0.42 - halfLid, z: 0 };
  lms[158] = { x: 0.41, y: 0.42 - halfLid, z: 0 };
  lms[145] = { x: 0.39, y: 0.42 + halfLid, z: 0 };
  lms[144] = { x: 0.37, y: 0.42 + halfLid, z: 0 };
  lms[153] = { x: 0.41, y: 0.42 + halfLid, z: 0 };
  lms[468] = { x: 0.39 + irisShiftX, y: 0.42 + irisShiftY, z: 0 };
  [469, 470, 471, 472].forEach((idx) => {
    lms[idx] = { x: 0.39 + irisShiftX, y: 0.42 + irisShiftY, z: 0 };
  });

  // Subject's left eye (viewer-right [362, 385, 387, 263, 373, 380])
  lms[362] = { x: 0.57, y: 0.42, z: 0 };
  lms[263] = { x: 0.65, y: 0.42, z: 0 };
  lms[386] = { x: 0.61, y: 0.42 - halfLid, z: 0 };
  lms[385] = { x: 0.59, y: 0.42 - halfLid, z: 0 };
  lms[387] = { x: 0.63, y: 0.42 - halfLid, z: 0 };
  lms[374] = { x: 0.61, y: 0.42 + halfLid, z: 0 };
  lms[380] = { x: 0.59, y: 0.42 + halfLid, z: 0 };
  lms[373] = { x: 0.63, y: 0.42 + halfLid, z: 0 };
  lms[473] = { x: 0.61 + irisShiftX, y: 0.42 + irisShiftY, z: 0 };
  [474, 475, 476, 477].forEach((idx) => {
    lms[idx] = { x: 0.61 + irisShiftX, y: 0.42 + irisShiftY, z: 0 };
  });

  return lms;
}

describe('NayanSathi Core Eye-Tracking, Blink State Machine & AAC Logic', () => {
  it('Normalized 1-Euro Filter attenuates high-frequency jitter and resets safely after long gaps', () => {
    const filter = new OneEuroFilter({ minCutoff: 1.15, beta: 0.9, dCutoff: 1.0 });
    const rawInputs = [0.5, 0.514, 0.488, 0.51, 0.492, 0.505, 0.496];
    const filtered = rawInputs.map((v, idx) => filter.filter(v, idx * 33));

    const rawSpread = Math.max(...rawInputs) - Math.min(...rawInputs);
    const filteredSpread = Math.max(...filtered.slice(1)) - Math.min(...filtered.slice(1));
    expect(filteredSpread).toBeLessThan(rawSpread);

    const reAnchored = filter.filter(0.85, 1000);
    expect(reAnchored).toBeCloseTo(0.85, 5);

    const filter2d = new OneEuroFilter2D();
    const pt = filter2d.filter(0.75, 0.25, 100);
    expect(pt.x).toBe(0.75);
    expect(pt.y).toBe(0.25);
  });

  it('GazeOutlierFilter rejects isolated single-frame spikes while confirming real 2-frame saccades', () => {
    const outlierFilter = new GazeOutlierFilter({
      windowSize: 6,
      sigmaThreshold: 3.0,
      minScaleNorm: 0.012,
      maxSingleFrameJumpNorm: 0.22,
    });

    outlierFilter.filter(0.12, 0.45);
    outlierFilter.filter(0.122, 0.451);
    outlierFilter.filter(0.119, 0.449);

    const spike = outlierFilter.filter(0.82, 0.88);
    expect(spike.wasOutlier).toBe(true);
    expect(spike.normX).toBeLessThan(0.15);

    const normal = outlierFilter.filter(0.121, 0.45);
    expect(normal.wasOutlier).toBe(false);

    const sac1 = outlierFilter.filter(0.85, 0.46);
    expect(sac1.wasOutlier).toBe(true);
    const sac2 = outlierFilter.filter(0.855, 0.462);
    expect(sac2.wasOutlier).toBe(false);
    expect(sac2.normX).toBeCloseTo(0.855, 3);
  });

  it('computes 6-point EAR, Adaptive EAR baseline, head pose, and geometric pose compensation', () => {
    const openEar = computeEyeAspectRatio(
      { x: 0, y: 0 },
      { x: 0.25, y: -0.15 },
      { x: 0.75, y: -0.15 },
      { x: 1, y: 0 },
      { x: 0.75, y: 0.15 },
      { x: 0.25, y: 0.15 }
    );
    expect(openEar).toBeCloseTo(0.3, 2);

    const earBaseline = new AdaptiveEarBaseline();
    let baseline = 0.28;
    for (let i = 0; i < 10; i++) {
      baseline = earBaseline.update(0.32);
    }
    expect(baseline).toBeCloseTo(0.32, 2);

    const openLandmarks = makeMockLandmarks(0.012, -0.006, 0.3);
    const pose = estimateHeadPose(openLandmarks);
    expect(pose.excessiveMovement).toBe(false);

    const features = extractGazeFeatures(openLandmarks, 1, 100, null, { baselineEar: baseline });
    expect(features).not.toBeNull();
    expect(features!.isBlinking).toBe(false);
    expect(features!.irisX).toBeGreaterThan(0.5);
    expect(features!.irisY).toBeLessThan(0.5);
    expect(features!.confidence).toBeGreaterThan(0.7);
    expect(buildGazeFeatureVector(features!).length).toBe(9);

    // Turning head right (dYaw = +0.20) causes eyes to counter-rotate left (irisX drops ~0.036)
    // Geometric compensation preserves steady gaze feature value (~0.50)
    const comp = compensateGazeWithHeadPose(
      [0.464, 0.5, 0, 0.2, 0, 0, 0.5, 0.5, 0.2],
      { yaw: 0, pitch: 0, roll: 0, faceCenterX: 0.5, faceCenterY: 0.5, faceScale: 0.2 }
    );
    expect(comp[0]).toBeCloseTo(0.5, 2);
  });

  it('BlinkDetector implements OPEN->CLOSING->CLOSED->REOPENING->OPEN with hysteresis and edge-triggered intentional long blinks', () => {
    const { closeThreshold, openThreshold } = computePersonalizedBlinkThresholds(0.3, 0.1);
    expect(openThreshold).toBeGreaterThan(closeThreshold);

    const detector = new BlinkDetector({
      openBaselineEar: 0.3,
      closedBaselineEar: 0.1,
      longBlinkDurationMs: 700,
      blinkSelectionEnabled: true,
      allowSingleEyeFallback: true,
      smoothingAlpha: 1.0, // deterministic frame response in unit test
      minClosedConfirmFrames: 2,
      minReopenConfirmFrames: 2,
    });

    // Normal open state
    const sOpen = detector.process({
      earLeft: 0.3,
      earRight: 0.3,
      leftReliable: true,
      rightReliable: true,
      faceValid: true,
      timestampMs: 100,
    });
    expect(sOpen.state).toBe('OPEN');
    expect(sOpen.isBlinking).toBe(false);

    // Single-frame noise dip should enter CLOSING and recover cleanly to OPEN without counting a blink
    const noise1 = detector.process({
      earLeft: 0.12,
      earRight: 0.12,
      leftReliable: true,
      rightReliable: true,
      faceValid: true,
      timestampMs: 120,
    });
    expect(noise1.state).toBe('CLOSING');
    const recover = detector.process({
      earLeft: 0.28,
      earRight: 0.28,
      leftReliable: true,
      rightReliable: true,
      faceValid: true,
      timestampMs: 135,
    });
    expect(recover.state).toBe('OPEN');
    expect(recover.blinkCount).toBe(0);

    // Natural brief blink (~160 ms) -> does NOT trigger selection, increments blinkCount once reopened
    detector.process({ earLeft: 0.11, earRight: 0.11, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 200 });
    const c2 = detector.process({ earLeft: 0.11, earRight: 0.11, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 233 });
    expect(c2.state).toBe('CLOSED');
    const c3 = detector.process({ earLeft: 0.11, earRight: 0.11, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 320 });
    expect(c3.longBlinkTriggered).toBe(false);
    detector.process({ earLeft: 0.28, earRight: 0.28, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 360 });
    const natDone = detector.process({ earLeft: 0.29, earRight: 0.29, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 390 });
    expect(natDone.state).toBe('OPEN');
    expect(natDone.blinkCount).toBe(1);
    expect(natDone.lastBlinkEvent?.type).toBe('natural');

    // Intentional long blink (>= 700 ms) triggers EXACTLY ONCE per closure and does NOT repeat while closed
    detector.process({ earLeft: 0.1, earRight: 0.1, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 1000 });
    detector.process({ earLeft: 0.1, earRight: 0.1, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 1033 });
    detector.process({ earLeft: 0.1, earRight: 0.1, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 1350 });
    const longHit = detector.process({ earLeft: 0.1, earRight: 0.1, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 1750 });
    expect(longHit.state).toBe('CLOSED');
    expect(longHit.longBlinkTriggered).toBe(true);

    // Holding closed longer must NOT re-trigger
    const heldStill = detector.process({ earLeft: 0.1, earRight: 0.1, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 2100 });
    expect(heldStill.longBlinkTriggered).toBe(false);

    // Reopen completes and logs intentional event
    detector.process({ earLeft: 0.29, earRight: 0.29, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 2150 });
    const intDone = detector.process({ earLeft: 0.29, earRight: 0.29, leftReliable: true, rightReliable: true, faceValid: true, timestampMs: 2180 });
    expect(intDone.state).toBe('OPEN');
    expect(intDone.blinkCount).toBe(2);
    expect(intDone.lastBlinkEvent?.type).toBe('intentional');

    // Suppressed during calibration or invalid face
    const suppressed = detector.process({
      earLeft: 0.1,
      earRight: 0.1,
      leftReliable: true,
      rightReliable: true,
      faceValid: true,
      timestampMs: 3000,
      suppressForCalibration: true,
    });
    expect(suppressed.state).toBe('OPEN');
    expect(suppressed.longBlinkTriggered).toBe(false);
  });

  it('Polynomial Ridge Regression resists steady-head jitter and maps screen coordinates', () => {
    const width = 1280;
    const height = 720;
    const samples: CalibrationSample[] = [];

    for (const target of NINE_POINT_TARGETS) {
      const tx = target.normX * width;
      const ty = target.normY * height;
      const ix = 0.32 + target.normX * 0.36;
      const iy = 0.28 + target.normY * 0.44;
      for (let k = 0; k < 22; k++) {
        const headMicroJitter = ((k % 5) - 2) * 0.0004;
        samples.push({
          targetId: target.id,
          targetX: tx,
          targetY: ty,
          featureVector: [ix, iy, 0, 0, 0, 0, 0.5 + headMicroJitter, 0.5 + headMicroJitter, 0.2],
          confidence: 0.9,
          timestamp: k * 33,
        });
      }
    }

    const model = trainRidgeRegression(samples, width, height);
    expect(model.weightsX.length).toBe(15);
    expect(model.featureScales[6]).toBeGreaterThanOrEqual(0.09);

    const predA = predictGazeNormalized(model, [0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5, 0.2]);
    const predB = predictGazeNormalized(model, [0.5, 0.5, 0, 0, 0, 0, 0.502, 0.502, 0.2]);
    expect(Math.abs(predA.normX - predB.normX)).toBeLessThan(0.015);

    const centerPx = predictGazeScreen(model, [0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5, 0.2], width, height);
    expect(Math.abs(centerPx.x - width * 0.5)).toBeLessThan(55);
    expect(Math.abs(centerPx.y - height * 0.5)).toBeLessThan(55);

    const std = standardizeVector([10, 0], [5, 0], [2.5, 1]);
    expect(std[0]).toBeCloseTo(2, 5);
  });

  it('Calibration filters MAD outliers, separates training vs held-out X/Y validation errors, and checks staleness', () => {
    const width = 1440;
    const height = 900;
    const samplesByPoint: Record<string, CalibrationSample[]> = {};

    for (const target of NINE_POINT_TARGETS) {
      const list: CalibrationSample[] = [];
      const ix = 0.32 + target.normX * 0.36;
      const iy = 0.28 + target.normY * 0.44;
      for (let i = 0; i < 24; i++) {
        list.push({
          targetId: target.id,
          targetX: target.normX * width,
          targetY: target.normY * height,
          featureVector: [ix, iy, 0, 0, 0, 0, 0.5, 0.5, 0.2],
          confidence: 0.92,
          timestamp: i * 33,
        });
      }
      list.push({
        targetId: target.id,
        targetX: target.normX * width,
        targetY: target.normY * height,
        featureVector: [0.99, 0.99, 0.49, 0, 0, 0, 0.5, 0.5, 0.2],
        confidence: 0.9,
        timestamp: 999,
      });
      samplesByPoint[target.id] = list;
    }

    const cleaned = filterPointOutliers(samplesByPoint['mc']);
    expect(cleaned.length).toBe(24);

    const profile = buildCalibrationProfile(samplesByPoint, width, height);
    expect(profile.qualityTier).toBe('strong');
    expect(profile.pointResults.length).toBe(9);
    expect(profile.trainingErrorNorm).toBeGreaterThanOrEqual(0);
    expect(profile.validationHorizErrorNorm).toBeGreaterThanOrEqual(0);
    expect(profile.validationVertErrorNorm).toBeGreaterThanOrEqual(0);
    expect(profile.featureVariance.irisX).toBeGreaterThan(0.01);
    expect(isCalibrationStaleForViewport(profile, 1440, 900)).toBe(false);
    expect(isCalibrationStaleForViewport(profile, 640, 480)).toBe(true);

    const staticByPoint: Record<string, CalibrationSample[]> = {};
    for (const target of NINE_POINT_TARGETS) {
      staticByPoint[target.id] = Array.from({ length: 24 }, (_, i) => ({
        targetId: target.id,
        targetX: target.normX * width,
        targetY: target.normY * height,
        featureVector: [0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5, 0.2],
        confidence: 0.9,
        timestamp: i * 33,
      }));
    }
    expect(() => buildCalibrationProfile(staticByPoint, width, height)).toThrow();
  });

  it('DwellManager locks stably onto Q against border jitter, switches intentionally to W, and pauses during blinks', () => {
    const dwell = new DwellManager({
      dwellDurationMs: 1000,
      dwellTolerancePx: 14,
      targetHysteresisPx: 14,
      selectionCooldownMs: 800,
      hysteresisGraceMs: 180,
    });

    const targets = [
      { id: 'en_Q', left: 100, top: 100, right: 180, bottom: 160 },
      { id: 'en_W', left: 190, top: 100, right: 270, bottom: 160 },
    ];

    const f1 = dwell.update(140, 130, targets, 1000, { isBlinking: false, confident: true });
    expect(f1.activeTargetId).toBeNull();
    const f2 = dwell.update(140, 130, targets, 1033, { isBlinking: false, confident: true });
    expect(f2.activeTargetId).toBe('en_Q');

    const jitterEdge = dwell.update(186, 130, targets, 1350, { isBlinking: false, confident: true });
    expect(jitterEdge.activeTargetId).toBe('en_Q');

    const blinkState = dwell.update(140, 130, targets, 1550, { isBlinking: true, confident: true });
    expect(blinkState.activeTargetId).toBe('en_Q');
    expect(blinkState.triggeredTargetId).toBeNull();

    const w1 = dwell.update(235, 130, targets, 1600, { isBlinking: false, confident: true });
    expect(w1.activeTargetId).toBe('en_Q');
    const w2 = dwell.update(235, 130, targets, 1633, { isBlinking: false, confident: true });
    expect(w2.activeTargetId).toBe('en_W');

    const complete = dwell.update(235, 130, targets, 2700, { isBlinking: false, confident: true });
    expect(complete.triggeredTargetId).toBe('en_W');
  });

  it('Sentence builder supports appending, word deletion, character backspace, undo, and clear', () => {
    let s = createInitialSentenceState();
    s = appendPhraseToSentence(s, 'I need');
    s = appendPhraseToSentence(s, 'water');
    expect(s.text).toBe('I need water');

    s = deleteLastWord(s);
    expect(s.text).toBe('I need ');

    s = undoSentence(s);
    expect(s.text).toBe('I need water');

    s = appendCharacterToSentence(s, '.');
    expect(s.text).toBe('I need water.');

    s = backspaceCharacter(s);
    expect(s.text).toBe('I need water');

    s = clearSentence(s);
    expect(s.text).toBe('');
  });

  it('Offline AI fallback generates bilingual suggestions without external network', () => {
    const en = generateOfflineSuggestions(['water', 'thirsty'], '', 'en');
    expect(en.length).toBe(3);
    expect(en[0].source).toBe('offline');
    expect(en[0].text.toLowerCase()).toContain('water');

    const hi = generateOfflineSuggestions(['पानी', 'प्यास'], '', 'hi');
    expect(hi.length).toBe(3);
    expect(hi[0].text).toContain('पानी');
  });

  it('Local storage migrates legacy beta, discards incompatible calibration shapes, and preserves history privacy', () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
        },
      },
      configurable: true,
    });

    clearAllLocalData();
    const initial = loadSettings();
    expect(initial.privacy.historyConsentEnabled).toBe(false);
    expect(initial.eyeTracking.beta).toBe(0.9);
    expect(initial.eyeTracking.longBlinkDurationMs).toBe(700);

    store.set(
      'nayansathi_settings_v1',
      JSON.stringify({ eyeTracking: { beta: 0.015, dwellDurationMs: 1200 } })
    );
    const migrated = loadSettings();
    expect(migrated.eyeTracking.beta).toBe(0.9);
    expect(migrated.eyeTracking.dwellDurationMs).toBe(1200);

    store.set(
      'nayansathi_calibration_v1',
      JSON.stringify({
        model: { weightsX: new Array(55).fill(0), weightsY: new Array(55).fill(0) },
      })
    );
    expect(loadCalibration()).toBeNull();

    appendCommunicationHistory(
      { id: '1', text: 'Hello', language: 'en', timestamp: new Date().toISOString(), spoken: true },
      false
    );
    expect(loadCommunicationHistory().length).toBe(0);

    saveSettings({
      ...DEFAULT_SETTINGS,
      eyeTracking: { ...DEFAULT_SETTINGS.eyeTracking, dwellDurationMs: 1400 },
    });
    expect(loadSettings().eyeTracking.dwellDurationMs).toBe(1400);

    clearAllLocalData();
    expect(loadSettings().eyeTracking.dwellDurationMs).toBe(1000);
  });
});
