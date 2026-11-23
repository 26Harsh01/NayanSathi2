import type { DetectedFaceSummary } from '../../types';
import type { NormalizedLandmark } from './iris-extractor';

export interface FaceAnchor {
  centerX: number;
  centerY: number;
  scale: number;
  displayNumber: number;
}

export interface FaceSelectionResolution {
  ambiguous: boolean;
  activeFace: DetectedFaceSummary | null;
  activeIndex: number;
  nextAnchor: FaceAnchor | null;
}

export function summarizeDetectedFaces(
  faceLandmarksList: NormalizedLandmark[][] | undefined | null
): DetectedFaceSummary[] {
  if (!faceLandmarksList || faceLandmarksList.length === 0) return [];

  const rawSummaries = faceLandmarksList
    .map((lms, index) => {
      if (!lms || lms.length < 478) return null;
      const nose = lms[1];
      const rightOuter = lms[33];
      const leftOuter = lms[263];
      if (!nose || !rightOuter || !leftOuter) return null;
      const scale = Math.hypot(leftOuter.x - rightOuter.x, leftOuter.y - rightOuter.y);
      return {
        index,
        centerX: nose.x,
        centerY: nose.y,
        scale,
      };
    })
    .filter((item): item is { index: number; centerX: number; centerY: number; scale: number } =>
      item !== null
    );

  // Sort left-to-right in mirrored viewer space (larger raw x appears on viewer left)
  rawSummaries.sort((a, b) => b.centerX - a.centerX);

  return rawSummaries.map((item, idx) => ({
    index: item.index,
    displayNumber: idx + 1,
    centerX: item.centerX,
    centerY: item.centerY,
    scale: item.scale,
    label:
      rawSummaries.length > 1
        ? `Subject ${idx + 1} (${idx === 0 ? 'Left' : idx === rawSummaries.length - 1 ? 'Right' : 'Center'})`
        : 'Primary Subject',
  }));
}

export function resolveTrackedFace(
  faces: DetectedFaceSummary[],
  selectedAnchor: FaceAnchor | null
): FaceSelectionResolution {
  if (faces.length === 0) {
    return {
      ambiguous: false,
      activeFace: null,
      activeIndex: -1,
      nextAnchor: null,
    };
  }

  if (faces.length === 1) {
    const only = faces[0];
    return {
      ambiguous: false,
      activeFace: only,
      activeIndex: only.index,
      nextAnchor: selectedAnchor
        ? {
            centerX: only.centerX,
            centerY: only.centerY,
            scale: only.scale,
            displayNumber: only.displayNumber,
          }
        : null,
    };
  }

  // Multiple faces detected: NEVER silently choose a face without an active subject lock
  if (!selectedAnchor) {
    return {
      ambiguous: true,
      activeFace: null,
      activeIndex: -1,
      nextAnchor: null,
    };
  }

  let bestFace: DetectedFaceSummary | null = null;
  let bestDist = Infinity;

  for (const face of faces) {
    const dist = Math.hypot(
      face.centerX - selectedAnchor.centerX,
      face.centerY - selectedAnchor.centerY
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestFace = face;
    }
  }

  if (!bestFace || bestDist > 0.24) {
    // Previously selected subject left the frame — pause & ask for re-selection
    return {
      ambiguous: true,
      activeFace: null,
      activeIndex: -1,
      nextAnchor: null,
    };
  }

  return {
    ambiguous: false,
    activeFace: bestFace,
    activeIndex: bestFace.index,
    nextAnchor: {
      centerX: bestFace.centerX,
      centerY: bestFace.centerY,
      scale: bestFace.scale,
      displayNumber: selectedAnchor.displayNumber,
    },
  };
}
