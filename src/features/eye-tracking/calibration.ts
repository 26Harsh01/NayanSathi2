import type {
  CalibrationPointTarget,
  CalibrationProfile,
  CalibrationQualityTier,
  CalibrationSample,
  PointValidationResult,
} from '../../types';
import {
  evaluateRegressionErrors,
  predictGazeNormalized,
  trainRidgeRegression,
} from './gaze-regression';

export const NINE_POINT_TARGETS: CalibrationPointTarget[] = [
  { id: 'tl', labelEn: 'Top Left', labelHi: 'ऊपर बाएँ', normX: 0.1, normY: 0.12, region: 'top-left' },
  { id: 'tc', labelEn: 'Top Center', labelHi: 'ऊपर मध्य', normX: 0.5, normY: 0.12, region: 'top-center' },
  { id: 'tr', labelEn: 'Top Right', labelHi: 'ऊपर दाएँ', normX: 0.9, normY: 0.12, region: 'top-right' },
  { id: 'ml', labelEn: 'Middle Left', labelHi: 'मध्य बाएँ', normX: 0.1, normY: 0.5, region: 'middle-left' },
  { id: 'mc', labelEn: 'Center', labelHi: 'केंद्र', normX: 0.5, normY: 0.5, region: 'center' },
  { id: 'mr', labelEn: 'Middle Right', labelHi: 'मध्य दाएँ', normX: 0.9, normY: 0.5, region: 'middle-right' },
  { id: 'bl', labelEn: 'Bottom Left', labelHi: 'नीचे बाएँ', normX: 0.1, normY: 0.88, region: 'bottom-left' },
  { id: 'bc', labelEn: 'Bottom Center', labelHi: 'नीचे मध्य', normX: 0.5, normY: 0.88, region: 'bottom-center' },
  { id: 'br', labelEn: 'Bottom Right', labelHi: 'नीचे दाएँ', normX: 0.9, normY: 0.88, region: 'bottom-right' },
];

export const TARGET_SAMPLES_PER_POINT = 38;
export const MIN_VALID_SAMPLES_PER_POINT = 20;
export const CALIBRATION_SETTLE_MS = 750;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) * 0.5
    : sorted[mid];
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
}

/**
 * Filters outliers from a single calibration point using MAD on iris X and iris Y
 * to discard transition saccades and noisy frames.
 */
export function filterPointOutliers(samples: CalibrationSample[]): CalibrationSample[] {
  if (samples.length <= 6) return samples;

  const irisXs = samples.map((s) => s.featureVector[0] ?? 0);
  const irisYs = samples.map((s) => s.featureVector[1] ?? 0);

  const medX = median(irisXs);
  const medY = median(irisYs);

  const madX = Math.max(0.0035, median(irisXs.map((x) => Math.abs(x - medX))));
  const madY = Math.max(0.0035, median(irisYs.map((y) => Math.abs(y - medY))));

  const filtered = samples.filter((s) => {
    const dx = Math.abs((s.featureVector[0] ?? 0) - medX) / (1.4826 * madX);
    const dy = Math.abs((s.featureVector[1] ?? 0) - medY) / (1.4826 * madY);
    return dx <= 2.5 && dy <= 2.5;
  });

  return filtered.length >= Math.min(10, samples.length) ? filtered : samples;
}

export function computeRepresentativeFeatureVector(samples: CalibrationSample[]): number[] {
  const dim = samples[0]?.featureVector.length ?? 9;
  const centroid = new Array<number>(dim).fill(0);
  for (let d = 0; d < dim; d++) {
    centroid[d] = median(samples.map((s) => s.featureVector[d] ?? 0));
  }
  return centroid;
}

export function isCalibrationStaleForViewport(
  profile: CalibrationProfile | null,
  currentWidth: number,
  currentHeight: number
): boolean {
  if (!profile) return false;
  const wRatio = Math.abs(currentWidth - profile.viewportWidth) / Math.max(1, profile.viewportWidth);
  const hRatio = Math.abs(currentHeight - profile.viewportHeight) / Math.max(1, profile.viewportHeight);
  const oldAspect = profile.viewportWidth / Math.max(1, profile.viewportHeight);
  const newAspect = currentWidth / Math.max(1, currentHeight);
  const aspectDelta = Math.abs(oldAspect - newAspect) / Math.max(0.1, oldAspect);

  return wRatio > 0.35 || hRatio > 0.35 || aspectDelta > 0.25;
}

/**
 * Validates gaze span and sample quality across the 9 targets, trains robust regression on
 * cleaned samples + representative centroids, and reports both training fit and separate
 * chronologically held-out validation errors (X, Y, Euclidean).
 */
export function buildCalibrationProfile(
  samplesByPoint: Record<string, CalibrationSample[]>,
  viewportWidth: number,
  viewportHeight: number
): CalibrationProfile {
  const trainSamples: CalibrationSample[] = [];
  const valSamplesByPoint: Record<string, CalibrationSample[]> = {};
  const allCleanSamples: CalibrationSample[] = [];
  const centroids: CalibrationSample[] = [];

  for (const target of NINE_POINT_TARGETS) {
    const raw = samplesByPoint[target.id] ?? [];
    const clean = filterPointOutliers(raw);
    if (clean.length < MIN_VALID_SAMPLES_PER_POINT) {
      throw new Error(
        `Insufficient valid samples for ${target.labelEn} (${clean.length}/${MIN_VALID_SAMPLES_PER_POINT}). Hold gaze steadily on each target.`
      );
    }

    const repVec = computeRepresentativeFeatureVector(clean);
    const meanConf =
      clean.reduce((acc, s) => acc + s.confidence, 0) / Math.max(1, clean.length);

    centroids.push({
      targetId: target.id,
      targetX: clean[0].targetX,
      targetY: clean[0].targetY,
      featureVector: repVec,
      confidence: meanConf,
      timestamp: clean[clean.length - 1].timestamp,
    });

    allCleanSamples.push(...clean);
    valSamplesByPoint[target.id] = [];

    // Chronological 70/30 split per point prevents leakage between correlated adjacent frames
    const splitIdx = Math.max(1, Math.floor(clean.length * 0.7));
    clean.forEach((sample, idx) => {
      if (idx >= splitIdx) {
        valSamplesByPoint[target.id].push(sample);
      } else {
        trainSamples.push(sample);
      }
    });
  }

  const centroidIrisX = centroids.map((c) => c.featureVector[0]);
  const centroidIrisY = centroids.map((c) => c.featureVector[1]);
  const spanX = Math.max(...centroidIrisX) - Math.min(...centroidIrisX);
  const spanY = Math.max(...centroidIrisY) - Math.min(...centroidIrisY);

  if (spanX < 0.025 || spanY < 0.015) {
    throw new Error(
      'Eye movement range across calibration points was too small to build a reliable gaze model. Keep your head steady and look directly at each corner target.'
    );
  }

  const featureVariance = {
    irisX: variance(allCleanSamples.map((s) => s.featureVector[0] ?? 0)),
    irisY: variance(allCleanSamples.map((s) => s.featureVector[1] ?? 0)),
  };

  const validationModel = trainRidgeRegression(trainSamples, viewportWidth, viewportHeight);
  const trainingErrors = evaluateRegressionErrors(
    validationModel,
    trainSamples,
    viewportWidth,
    viewportHeight
  );

  const safeW = Math.max(1, viewportWidth);
  const safeH = Math.max(1, viewportHeight);

  const pointResults: PointValidationResult[] = [];
  let sumResidual = 0;
  let sumHoriz = 0;
  let sumVert = 0;
  let totalValCount = 0;

  for (const target of NINE_POINT_TARGETS) {
    const valList = valSamplesByPoint[target.id] ?? [];
    let ptResidualSum = 0;
    let ptXSum = 0;
    let ptYSum = 0;

    for (const s of valList) {
      const pred = predictGazeNormalized(validationModel, s.featureVector);
      const dx = Math.abs(pred.normX - s.targetX / safeW);
      const dy = Math.abs(pred.normY - s.targetY / safeH);
      ptXSum += dx;
      ptYSum += dy;
      ptResidualSum += Math.hypot(dx, dy);
    }

    const n = valList.length;
    const meanPtResidual = n > 0 ? ptResidualSum / n : 0.2;
    const meanPtX = n > 0 ? ptXSum / n : 0.15;
    const meanPtY = n > 0 ? ptYSum / n : 0.15;

    sumResidual += ptResidualSum;
    sumHoriz += ptXSum;
    sumVert += ptYSum;
    totalValCount += n;

    pointResults.push({
      targetId: target.id,
      region: target.region,
      sampleCount: (samplesByPoint[target.id] ?? []).length,
      meanResidualNorm: meanPtResidual,
      meanErrorXNorm: meanPtX,
      meanErrorYNorm: meanPtY,
      needsRecalibration: meanPtResidual > 0.12,
    });
  }

  const meanValidationNormError =
    totalValCount > 0 ? sumResidual / totalValCount : 0.25;
  const validationHorizErrorNorm =
    totalValCount > 0 ? sumHoriz / totalValCount : 0.2;
  const validationVertErrorNorm =
    totalValCount > 0 ? sumVert / totalValCount : 0.2;

  if (meanValidationNormError > 0.24) {
    throw new Error(
      `Calibration validation error was too high (~${Math.round(meanValidationNormError * 100)}% of screen). Improve front lighting, keep head steady, and try again.`
    );
  }

  let qualityTier: CalibrationQualityTier = 'moderate';
  if (meanValidationNormError <= 0.075) {
    qualityTier = 'strong';
  } else if (meanValidationNormError <= 0.13) {
    qualityTier = 'moderate';
  } else {
    qualityTier = 'needs-recalibration';
  }

  const finalTrainingSet = [...allCleanSamples, ...centroids, ...centroids];
  const finalModel = trainRidgeRegression(finalTrainingSet, viewportWidth, viewportHeight);

  const now = new Date().toISOString();
  return {
    id: `cal_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    model: finalModel,
    qualityTier,
    trainingErrorNorm: trainingErrors.euclideanMeanNorm,
    meanValidationNormError,
    validationHorizErrorNorm,
    validationVertErrorNorm,
    featureVariance,
    pointResults,
    totalSamplesCollected: allCleanSamples.length,
    viewportWidth: safeW,
    viewportHeight: safeH,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  };
}
