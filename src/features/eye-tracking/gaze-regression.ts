import type { BaselineHeadPose, CalibrationSample, RidgeModelWeights } from '../../types';
import { compensateGazeWithHeadPose, computeMeanBaselinePose } from './gaze-features';

/**
 * Physical minimum scale floors prevent tiny landmark micro-jitter in steady-head
 * calibration sessions from exploding during z-score normalization.
 * Feature order matches buildGazeFeatureVector / compensateGazeWithHeadPose:
 * [irisX, irisY, irisDiffX, dYaw, dPitch, dRoll, dFaceCenterX, dFaceCenterY, dFaceScale]
 */
const MIN_FEATURE_SCALES = [
  0.025, // irisX
  0.025, // irisY
  0.035, // irisDiffX
  0.14,  // dYaw
  0.14,  // dPitch
  0.14,  // dRoll
  0.09,  // dFaceCenterX
  0.09,  // dFaceCenterY
  0.04,  // dFaceScale
];

export function computeFeatureStats(vectors: number[][]): {
  means: number[];
  scales: number[];
} {
  if (vectors.length === 0) {
    return { means: [], scales: [] };
  }
  const dim = vectors[0].length;
  const means = new Array<number>(dim).fill(0);
  const scales = new Array<number>(dim).fill(1);

  for (const v of vectors) {
    for (let j = 0; j < dim; j++) {
      means[j] += v[j];
    }
  }
  for (let j = 0; j < dim; j++) {
    means[j] /= vectors.length;
  }

  const vars = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let j = 0; j < dim; j++) {
      const diff = v[j] - means[j];
      vars[j] += diff * diff;
    }
  }
  for (let j = 0; j < dim; j++) {
    const empStd = Math.sqrt(vars[j] / Math.max(1, vectors.length));
    const floor = MIN_FEATURE_SCALES[j] ?? 0.05;
    scales[j] = Math.max(floor, empStd);
  }

  return { means, scales };
}

export function standardizeVector(
  vec: number[],
  means: number[],
  scales: number[]
): number[] {
  return vec.map((val, idx) => {
    const m = means[idx] ?? 0;
    const s = scales[idx] ?? 1;
    const z = (val - m) / (s > 1e-6 ? s : 1);
    return Math.max(-5, Math.min(5, Number.isFinite(z) ? z : 0));
  });
}

/**
 * Structured polynomial expansion:
 *   Index 0:       1 (bias, unpenalized)
 *   Indices 1..6:  irisX, irisY, irisX^2, irisX*irisY, irisY^2, irisDiffX (gaze terms)
 *   Indices 7..14: yaw, pitch, roll, faceCenterX, faceCenterY, faceScale, irisX*yaw, irisY*pitch (pose compensation)
 */
export function expandStructuredGazeFeatures(stdVec: number[], degree = 2): number[] {
  const ix = stdVec[0] ?? 0;
  const iy = stdVec[1] ?? 0;
  const idiff = stdVec[2] ?? 0;
  const yaw = stdVec[3] ?? 0;
  const pitch = stdVec[4] ?? 0;
  const roll = stdVec[5] ?? 0;
  const cx = stdVec[6] ?? 0;
  const cy = stdVec[7] ?? 0;
  const scale = stdVec[8] ?? 0;

  if (degree <= 1) {
    return [1, ix, iy, idiff, yaw, pitch, roll, cx, cy, scale];
  }

  return [
    1,
    ix,
    iy,
    ix * ix,
    ix * iy,
    iy * iy,
    idiff,
    yaw,
    pitch,
    roll,
    cx,
    cy,
    scale,
    ix * yaw,
    iy * pitch,
  ];
}

export function solveLinearSystem(matrixA: number[][], vectorB: number[]): number[] {
  const n = vectorB.length;
  const A = matrixA.map((row) => [...row]);
  const b = [...vectorB];

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxRow !== col) {
      const tmpRow = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tmpRow;
      const tmpB = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmpB;
    }

    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-10) {
      A[col][col] = pivot >= 0 ? 1e-8 : -1e-8;
    }

    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      if (factor === 0) continue;
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) {
      sum -= A[row][k] * x[k];
    }
    x[row] = Number.isFinite(sum / A[row][row]) ? sum / A[row][row] : 0;
  }

  return x;
}

/**
 * Trains independent regularized Polynomial Ridge Regression models for X and Y
 * in normalized viewport space [0, 1] using identical geometric head-pose compensation
 * during both training and inference.
 */
export function trainRidgeRegression(
  samples: CalibrationSample[],
  viewportWidth: number,
  viewportHeight: number,
  options: {
    degree?: number;
    lambdaGaze?: number;
    lambdaPose?: number;
    baselinePose?: BaselineHeadPose;
  } = {}
): RidgeModelWeights {
  if (samples.length < 9) {
    throw new Error('At least 9 valid calibration samples are required to train the gaze model.');
  }

  const degree = options.degree ?? 2;
  const lambdaGaze = options.lambdaGaze ?? 0.6;
  const lambdaPose = options.lambdaPose ?? 12.0;

  const rawVectors = samples.map((s) => s.featureVector);
  const baselinePose = options.baselinePose ?? computeMeanBaselinePose(rawVectors);
  const compensatedVectors = rawVectors.map((v) => compensateGazeWithHeadPose(v, baselinePose));
  const { means, scales } = computeFeatureStats(compensatedVectors);

  const designRows = compensatedVectors.map((v) =>
    expandStructuredGazeFeatures(standardizeVector(v, means, scales), degree)
  );
  const numFeatures = designRows[0].length;

  const XtX: number[][] = Array.from({ length: numFeatures }, () =>
    new Array<number>(numFeatures).fill(0)
  );
  const XtYx = new Array<number>(numFeatures).fill(0);
  const XtYy = new Array<number>(numFeatures).fill(0);

  const safeW = Math.max(1, viewportWidth);
  const safeH = Math.max(1, viewportHeight);

  for (let i = 0; i < samples.length; i++) {
    const row = designRows[i];
    const sample = samples[i];
    const weight = Math.max(0.25, Math.min(1, sample.confidence));
    const normTargetX = sample.targetX / safeW;
    const normTargetY = sample.targetY / safeH;

    for (let a = 0; a < numFeatures; a++) {
      const wa = row[a] * weight;
      XtYx[a] += wa * normTargetX;
      XtYy[a] += wa * normTargetY;
      for (let b = a; b < numFeatures; b++) {
        XtX[a][b] += wa * row[b];
      }
    }
  }

  const sampleScale = Math.max(1, samples.length / 9);
  for (let a = 0; a < numFeatures; a++) {
    for (let b = 0; b < a; b++) {
      XtX[a][b] = XtX[b][a];
    }
    if (a === 0) {
      XtX[a][a] += 1e-6;
    } else if (a <= 6) {
      XtX[a][a] += lambdaGaze * sampleScale * 0.15;
    } else {
      XtX[a][a] += lambdaPose * sampleScale * 0.25;
    }
  }

  const weightsX = solveLinearSystem(XtX, XtYx);
  const weightsY = solveLinearSystem(XtX, XtYy);

  return {
    weightsX,
    weightsY,
    featureMeans: means,
    featureScales: scales,
    baselinePose,
    degree,
    lambdaGaze,
    lambdaPose,
    viewportWidth: safeW,
    viewportHeight: safeH,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  };
}

export function predictGazeNormalized(
  model: RidgeModelWeights,
  featureVector: number[]
): { normX: number; normY: number } {
  const compensated = compensateGazeWithHeadPose(featureVector, model.baselinePose);
  const scales = model.featureScales ?? MIN_FEATURE_SCALES;
  const stdVec = standardizeVector(compensated, model.featureMeans, scales);
  const expanded = expandStructuredGazeFeatures(stdVec, model.degree);

  let predX = 0;
  let predY = 0;
  for (let i = 0; i < expanded.length; i++) {
    predX += expanded[i] * (model.weightsX[i] ?? 0);
    predY += expanded[i] * (model.weightsY[i] ?? 0);
  }

  return {
    normX: Math.max(-0.02, Math.min(1.02, Number.isFinite(predX) ? predX : 0.5)),
    normY: Math.max(-0.02, Math.min(1.02, Number.isFinite(predY) ? predY : 0.5)),
  };
}

export function predictGazeScreen(
  model: RidgeModelWeights,
  featureVector: number[],
  currentViewportWidth: number,
  currentViewportHeight: number
): { x: number; y: number } {
  const { normX, normY } = predictGazeNormalized(model, featureVector);
  const clampedX = Math.max(0, Math.min(currentViewportWidth, normX * currentViewportWidth));
  const clampedY = Math.max(0, Math.min(currentViewportHeight, normY * currentViewportHeight));
  return { x: clampedX, y: clampedY };
}

export function evaluateRegressionErrors(
  model: RidgeModelWeights,
  samples: CalibrationSample[],
  viewportWidth: number,
  viewportHeight: number
): { euclideanMeanNorm: number; horizMeanNorm: number; vertMeanNorm: number } {
  if (samples.length === 0) {
    return { euclideanMeanNorm: 0, horizMeanNorm: 0, vertMeanNorm: 0 };
  }
  const safeW = Math.max(1, viewportWidth);
  const safeH = Math.max(1, viewportHeight);
  let sumEuc = 0;
  let sumX = 0;
  let sumY = 0;

  for (const s of samples) {
    const pred = predictGazeNormalized(model, s.featureVector);
    const dx = Math.abs(pred.normX - s.targetX / safeW);
    const dy = Math.abs(pred.normY - s.targetY / safeH);
    sumX += dx;
    sumY += dy;
    sumEuc += Math.hypot(dx, dy);
  }

  return {
    euclideanMeanNorm: sumEuc / samples.length,
    horizMeanNorm: sumX / samples.length,
    vertMeanNorm: sumY / samples.length,
  };
}
