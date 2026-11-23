import type { EyeLandmarks2D } from '../../types';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

/**
 * Verified MediaPipe FaceLandmarker 478-landmark indices:
 * Note on camera orientation:
 * - Raw webcam frames are unmirrored (camera perspective).
 * - Preview video renders mirrored (-scale-x-100), so anatomical Left Eye ([362..263])
 *   appears on the viewer-LEFT and anatomical Right Eye ([33..133]) appears on the viewer-RIGHT.
 *
 * Right eye (subject anatomical right, camera-left):
 *   EAR contour: [33, 160, 158, 133, 153, 144]
 *   Iris center: 468, Iris ring: 469, 470, 471, 472
 *
 * Left eye (subject anatomical left, camera-right):
 *   EAR contour: [362, 385, 387, 263, 373, 380]
 *   Iris center: 473, Iris ring: 474, 475, 476, 477
 */
export const EYE_LANDMARK_INDICES = {
  right: {
    outerCorner: 33,
    innerCorner: 133,
    upperOuter: 160,
    upperInner: 158,
    upperCenter: 159,
    lowerOuter: 144,
    lowerInner: 153,
    lowerCenter: 145,
    irisCenter: 468,
    irisRing: [469, 470, 471, 472],
    earContour: [33, 160, 158, 133, 153, 144] as const,
  },
  left: {
    innerCorner: 362,
    outerCorner: 263,
    upperInner: 385,
    upperOuter: 387,
    upperCenter: 386,
    lowerInner: 380,
    lowerOuter: 373,
    lowerCenter: 374,
    irisCenter: 473,
    irisRing: [474, 475, 476, 477],
    earContour: [362, 385, 387, 263, 373, 380] as const,
  },
} as const;

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Computes 6-point Eye Aspect Ratio:
 *   EAR = (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4))
 */
export function computeEyeAspectRatio(
  p1: NormalizedLandmark,
  p2: NormalizedLandmark,
  p3: NormalizedLandmark,
  p4: NormalizedLandmark,
  p5: NormalizedLandmark,
  p6: NormalizedLandmark
): number {
  const verticalA = dist2D(p2, p6);
  const verticalB = dist2D(p3, p5);
  const horizontal = dist2D(p1, p4);
  if (horizontal < 1e-5) return 0;
  return (verticalA + verticalB) / (2.0 * horizontal);
}

function isValidLandmark(pt: NormalizedLandmark | undefined): pt is NormalizedLandmark {
  return Boolean(
    pt &&
      Number.isFinite(pt.x) &&
      Number.isFinite(pt.y) &&
      pt.x >= -0.25 &&
      pt.x <= 1.25 &&
      pt.y >= -0.25 &&
      pt.y <= 1.25
  );
}

function extractSingleEye(
  landmarks: NormalizedLandmark[],
  side: 'left' | 'right'
): EyeLandmarks2D | null {
  if (landmarks.length < 478) return null;

  const idx = EYE_LANDMARK_INDICES[side];
  const outer = landmarks[idx.outerCorner];
  const inner = landmarks[idx.innerCorner];
  const upperC = landmarks[idx.upperCenter];
  const lowerC = landmarks[idx.lowerCenter];
  const iris = landmarks[idx.irisCenter];

  const [e1, e2, e3, e4, e5, e6] = idx.earContour.map((i) => landmarks[i]);

  if (
    !isValidLandmark(outer) ||
    !isValidLandmark(inner) ||
    !isValidLandmark(upperC) ||
    !isValidLandmark(lowerC) ||
    !isValidLandmark(iris) ||
    !isValidLandmark(e1) ||
    !isValidLandmark(e2) ||
    !isValidLandmark(e3) ||
    !isValidLandmark(e4) ||
    !isValidLandmark(e5) ||
    !isValidLandmark(e6)
  ) {
    return null;
  }

  // Weighted average of iris center (weight 2) + 4 ring landmarks (weight 1 each)
  // reduces single-landmark quantization jitter by ~2.2x
  let irisX = iris.x * 2;
  let irisY = iris.y * 2;
  let weightSum = 2;
  for (const rIdx of idx.irisRing) {
    const pt = landmarks[rIdx];
    if (isValidLandmark(pt)) {
      irisX += pt.x;
      irisY += pt.y;
      weightSum += 1;
    }
  }
  irisX /= weightSum;
  irisY /= weightSum;

  // Order eye corners consistently from viewer-left to viewer-right in video space
  // so both left and right eyes share identical horizontal direction polarity.
  const leftCorner = outer.x <= inner.x ? outer : inner;
  const rightCorner = outer.x <= inner.x ? inner : outer;

  const vx = rightCorner.x - leftCorner.x;
  const vy = rightCorner.y - leftCorner.y;
  const eyeWidth = Math.hypot(vx, vy);

  if (eyeWidth < 0.008) {
    return null;
  }

  // Rotate into eye-local orthonormal basis (compensates head roll!)
  const ux = vx / eyeWidth;
  const uy = vy / eyeWidth;
  const px = -uy; // perpendicular pointing downward in image Y
  const py = ux;

  const projPerp = (pt: NormalizedLandmark) =>
    (pt.x - leftCorner.x) * px + (pt.y - leftCorner.y) * py;

  const irisAlong = (irisX - leftCorner.x) * ux + (irisY - leftCorner.y) * uy;
  const irisPerp = (irisX - leftCorner.x) * px + (irisY - leftCorner.y) * py;

  // Normalized horizontal iris position: (Iris - LeftCorner) / EyeWidth along eye axis
  const normalizedIrisX = irisAlong / eyeWidth;

  // Multi-point upper & lower lid midpoints reduce single-landmark lid jitter
  const upperOuter = landmarks[idx.upperOuter];
  const upperInner = landmarks[idx.upperInner];
  const lowerOuter = landmarks[idx.lowerOuter];
  const lowerInner = landmarks[idx.lowerInner];

  const upperAvg: NormalizedLandmark = {
    x: (upperC.x + upperOuter.x + upperInner.x) / 3,
    y: (upperC.y + upperOuter.y + upperInner.y) / 3,
  };
  const lowerAvg: NormalizedLandmark = {
    x: (lowerC.x + lowerOuter.x + lowerInner.x) / 3,
    y: (lowerC.y + lowerOuter.y + lowerInner.y) / 3,
  };

  const upperPerp = projPerp(upperAvg);
  const lowerPerp = projPerp(lowerAvg);
  const lidHeight = Math.max(0.003, lowerPerp - upperPerp);

  // Anatomical vertical ratio inside eyelids: (IrisY - UpperY) / (LowerY - UpperY)
  const eyelidRatioY = Math.max(0, Math.min(1, (irisPerp - upperPerp) / lidHeight));

  // Corner-axis vertical offset (invariant to eyelid squint / partial closure)
  const cornerRatioY = 0.5 + irisPerp / (0.36 * eyeWidth);

  // Blend anatomical eyelid ratio with corner-stable vertical ratio
  const normalizedIrisY = 0.4 * eyelidRatioY + 0.6 * cornerRatioY;

  const ear = computeEyeAspectRatio(e1, e2, e3, e4, e5, e6);

  const reliable =
    ear > 0.11 &&
    lidHeight / eyeWidth > 0.08 &&
    normalizedIrisX >= 0.06 &&
    normalizedIrisX <= 0.94 &&
    normalizedIrisY >= -0.4 &&
    normalizedIrisY <= 1.4;

  return {
    irisCenter: { x: irisX, y: irisY },
    innerCorner: { x: inner.x, y: inner.y },
    outerCorner: { x: outer.x, y: outer.y },
    upperLid: upperAvg,
    lowerLid: lowerAvg,
    ear,
    normalizedIrisX,
    normalizedIrisY,
    width: eyeWidth,
    lidHeight,
    reliable,
  };
}

export function extractBothEyes(landmarks: NormalizedLandmark[]): {
  leftEye: EyeLandmarks2D | null;
  rightEye: EyeLandmarks2D | null;
} {
  return {
    leftEye: extractSingleEye(landmarks, 'left'),
    rightEye: extractSingleEye(landmarks, 'right'),
  };
}
