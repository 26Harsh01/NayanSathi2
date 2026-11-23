import type { BaselineHeadPose, GazeFeatures } from '../../types';
import { extractBothEyes, type NormalizedLandmark } from './iris-extractor';
import { estimateHeadPose } from './head-pose';

const DEFAULT_BLINK_EAR_THRESHOLD = 0.175;

/**
 * Tracks rolling open-eye baseline EAR so natural pre-blink eyelid closure
 * is detected early before eyelids drag vertical iris measurements.
 */
export class AdaptiveEarBaseline {
  private openSamples: number[] = [];

  update(earAvg: number): number {
    if (earAvg >= 0.19 && earAvg <= 0.48) {
      this.openSamples.push(earAvg);
      if (this.openSamples.length > 45) {
        this.openSamples.shift();
      }
    }
    if (this.openSamples.length < 5) {
      return 0.28;
    }
    const sorted = [...this.openSamples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.75)] ?? 0.28;
  }

  reset(): void {
    this.openSamples = [];
  }
}

export function extractGazeFeatures(
  landmarks: NormalizedLandmark[] | null,
  faceCount: number,
  timestamp: number,
  transformationMatrix?: number[] | Float32Array | null,
  options?: {
    blinkEarThreshold?: number;
    baselineEar?: number;
  }
): GazeFeatures | null {
  if (!landmarks || landmarks.length < 478 || faceCount === 0) {
    return null;
  }

  const { leftEye, rightEye } = extractBothEyes(landmarks);
  const headPose = estimateHeadPose(landmarks, transformationMatrix);

  const earLeft = leftEye?.ear ?? 0;
  const earRight = rightEye?.ear ?? 0;
  const earCount = (leftEye ? 1 : 0) + (rightEye ? 1 : 0);
  const earAvg = earCount > 0 ? (earLeft + earRight) / earCount : 0;

  const baselineEar = options?.baselineEar ?? 0.28;
  const staticThresh = options?.blinkEarThreshold ?? DEFAULT_BLINK_EAR_THRESHOLD;
  const adaptiveThresh = Math.max(staticThresh, baselineEar * 0.68);
  const isBlinking = earAvg > 0 && earAvg < adaptiveThresh;

  const leftValid = leftEye !== null && leftEye.reliable;
  const rightValid = rightEye !== null && rightEye.reliable;

  let irisX = 0.5;
  let irisY = 0.5;
  let irisDiffX = 0;
  let irisDiffY = 0;

  if (leftValid && rightValid && leftEye && rightEye) {
    const diffX = Math.abs(leftEye.normalizedIrisX - rightEye.normalizedIrisX);
    const diffY = Math.abs(leftEye.normalizedIrisY - rightEye.normalizedIrisY);

    // If one eye diverges sharply (e.g. glasses glare or partial wink), favor the wider-open eye
    if (diffX > 0.22 || diffY > 0.28) {
      const preferred = leftEye.ear >= rightEye.ear ? leftEye : rightEye;
      irisX = preferred.normalizedIrisX;
      irisY = preferred.normalizedIrisY;
    } else {
      const wL = Math.max(0.1, leftEye.ear);
      const wR = Math.max(0.1, rightEye.ear);
      const wSum = wL + wR;
      irisX = (leftEye.normalizedIrisX * wL + rightEye.normalizedIrisX * wR) / wSum;
      irisY = (leftEye.normalizedIrisY * wL + rightEye.normalizedIrisY * wR) / wSum;
      irisDiffX = leftEye.normalizedIrisX - rightEye.normalizedIrisX;
      irisDiffY = leftEye.normalizedIrisY - rightEye.normalizedIrisY;
    }
  } else if (leftValid && leftEye) {
    irisX = leftEye.normalizedIrisX;
    irisY = leftEye.normalizedIrisY;
  } else if (rightValid && rightEye) {
    irisX = rightEye.normalizedIrisX;
    irisY = rightEye.normalizedIrisY;
  } else if (leftEye || rightEye) {
    const fallback = leftEye ?? rightEye!;
    irisX = fallback.normalizedIrisX;
    irisY = fallback.normalizedIrisY;
  }

  const relDispX = irisX - 0.5;
  const relDispY = irisY - 0.5;

  // Compute measurable tracking confidence
  let confidence = 0;
  if (faceCount === 1) {
    confidence += 0.35;
  } else if (faceCount > 1) {
    confidence += 0.1;
  }

  if (leftValid && rightValid) {
    confidence += 0.35;
  } else if (leftValid || rightValid) {
    confidence += 0.18;
  }

  if (headPose.faceScale >= 0.06 && headPose.faceScale <= 0.45) {
    confidence += 0.15;
  }

  const poseMagnitude = Math.hypot(headPose.yaw, headPose.pitch);
  if (poseMagnitude < 0.52) {
    confidence += 0.15;
  } else if (poseMagnitude < 0.85) {
    confidence += 0.07;
  }

  if (isBlinking) {
    confidence *= 0.25;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    timestamp,
    leftEye,
    rightEye,
    irisX,
    irisY,
    irisDiffX,
    irisDiffY,
    relDispX,
    relDispY,
    earLeft,
    earRight,
    earAvg,
    baselineEar,
    isBlinking,
    headPose,
    confidence,
    faceCount,
  };
}

/**
 * Non-collinear 9-element feature vector for Polynomial Ridge Regression:
 *   [0] irisX       (primary horizontal gaze)
 *   [1] irisY       (primary vertical gaze)
 *   [2] irisDiffX   (binocular vergence / asymmetry signal)
 *   [3] yaw         (head yaw)
 *   [4] pitch       (head pitch)
 *   [5] roll        (head roll)
 *   [6] faceCenterX (head horizontal translation)
 *   [7] faceCenterY (head vertical translation)
 *   [8] faceScale   (head depth / inter-ocular distance)
 */
export function buildGazeFeatureVector(features: GazeFeatures): number[] {
  return [
    features.irisX,
    features.irisY,
    features.irisDiffX,
    features.headPose.yaw,
    features.headPose.pitch,
    features.headPose.roll,
    features.headPose.faceCenterX,
    features.headPose.faceCenterY,
    features.headPose.faceScale,
  ];
}

export function computeMeanBaselinePose(vectors: number[][]): BaselineHeadPose {
  if (vectors.length === 0) {
    return { yaw: 0, pitch: 0, roll: 0, faceCenterX: 0.5, faceCenterY: 0.5, faceScale: 0.15 };
  }
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let cx = 0;
  let cy = 0;
  let scale = 0;
  for (const v of vectors) {
    yaw += v[3] ?? 0;
    pitch += v[4] ?? 0;
    roll += v[5] ?? 0;
    cx += v[6] ?? 0.5;
    cy += v[7] ?? 0.5;
    scale += v[8] ?? 0.15;
  }
  const n = vectors.length;
  return {
    yaw: yaw / n,
    pitch: pitch / n,
    roll: roll / n,
    faceCenterX: cx / n,
    faceCenterY: cy / n,
    faceScale: scale / n,
  };
}

/**
 * Geometric head-pose compensation applied identically during training and inference:
 * When the head turns (Δyaw, Δpitch) or translates (ΔfaceCenterX, ΔfaceCenterY) relative
 * to calibration center while keeping fixation on the same screen location, the eyeball
 * counter-rotates in its socket. Compensating the eye features preserves fixation stability
 * under natural small head movements without subtracting face coordinates from screen pixels.
 */
export function compensateGazeWithHeadPose(
  vec: number[],
  baselinePose?: BaselineHeadPose
): number[] {
  if (!baselinePose) return [...vec];

  const irisX = vec[0] ?? 0.5;
  const irisY = vec[1] ?? 0.5;
  const irisDiffX = vec[2] ?? 0;
  const yaw = vec[3] ?? 0;
  const pitch = vec[4] ?? 0;
  const roll = vec[5] ?? 0;
  const cx = vec[6] ?? 0.5;
  const cy = vec[7] ?? 0.5;
  const scale = vec[8] ?? 0.15;

  const dYaw = yaw - baselinePose.yaw;
  const dPitch = pitch - baselinePose.pitch;
  const dCx = cx - baselinePose.faceCenterX;
  const dCy = cy - baselinePose.faceCenterY;

  // Empirically balanced anatomical eyeball-to-camera couplings in normalized eye-aperture units
  const K_YAW = 0.18;
  const K_TRANS_X = 0.12;
  const K_PITCH = 0.14;
  const K_TRANS_Y = 0.10;

  const compensatedIrisX = irisX + K_YAW * dYaw + K_TRANS_X * dCx;
  const compensatedIrisY = irisY + K_PITCH * dPitch + K_TRANS_Y * dCy;

  return [
    compensatedIrisX,
    compensatedIrisY,
    irisDiffX,
    dYaw,
    dPitch,
    roll - baselinePose.roll,
    dCx,
    dCy,
    scale - baselinePose.faceScale,
  ];
}
