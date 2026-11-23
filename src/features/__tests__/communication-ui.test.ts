import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_CONTEXTS,
  deduplicatePhrases,
  paginateItems,
} from '../communication/context-modes';
import {
  resolveTrackedFace,
  summarizeDetectedFaces,
} from '../eye-tracking/face-subject';
import type { PhraseItem } from '../../types';

function makeSimpleFaceLandmarks(noseX: number, noseY = 0.5, scale = 0.16) {
  const lms = Array.from({ length: 478 }, () => ({ x: noseX, y: noseY, z: 0 }));
  lms[1] = { x: noseX, y: noseY, z: 0 };
  lms[33] = { x: noseX - scale / 2, y: noseY - 0.05, z: 0 };
  lms[263] = { x: noseX + scale / 2, y: noseY - 0.05, z: 0 };
  return lms;
}

describe('Communication Contexts, Phrase Deduplication/Pagination & Multi-Face Subject Lock', () => {
  it('deduplicates duplicate phrases and paginates safely within bounds', () => {
    const raw: PhraseItem[] = [
      { id: '1', categoryId: 'basic', textEn: 'I need water.', textHi: 'मुझे पानी चाहिए।' },
      { id: '2', categoryId: 'basic', textEn: ' i need water. ', textHi: 'मुझे पानी चाहिए।' },
      { id: '3', categoryId: 'basic', textEn: 'I am hungry.', textHi: 'मुझे भूख लगी है।' },
      { id: '4', categoryId: 'basic', textEn: 'I need rest.', textHi: 'मुझे आराम चाहिए।' },
      { id: '5', categoryId: 'basic', textEn: 'I am thirsty.', textHi: 'मुझे प्यास लगी है।' },
      { id: '6', categoryId: 'basic', textEn: 'I am tired.', textHi: 'मैं थक गया हूँ।' },
      { id: '7', categoryId: 'basic', textEn: 'Please help me.', textHi: 'कृपया मदद करें।' },
      { id: '8', categoryId: 'basic', textEn: 'Thank you.', textHi: 'धन्यवाद।' },
    ];

    const deduped = deduplicatePhrases(raw);
    expect(deduped.length).toBe(7);

    const page1 = paginateItems(deduped, 0, 6);
    expect(page1.page).toBe(0);
    expect(page1.totalPages).toBe(2);
    expect(page1.items.length).toBe(6);

    const page2 = paginateItems(deduped, 1, 6);
    expect(page2.page).toBe(1);
    expect(page2.items.length).toBe(1);

    const clamped = paginateItems(deduped, 99, 6);
    expect(clamped.page).toBe(1);
  });

  it('provides all 6 required communication context modes with bilingual shortcuts', () => {
    const ids = COMMUNICATION_CONTEXTS.map((c) => c.id);
    expect(ids).toEqual(['home', 'hospital', 'school', 'family', 'outside', 'custom']);
    for (const ctx of COMMUNICATION_CONTEXTS) {
      if (ctx.id !== 'custom') {
        expect(ctx.shortcuts.length).toBeGreaterThanOrEqual(4);
        for (const s of ctx.shortcuts) {
          expect(s.textEn.length).toBeGreaterThan(0);
          expect(s.textHi.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('pauses ambiguous multi-face control until a subject is selected, then tracks only the locked subject', () => {
    const faceLeftRaw = makeSimpleFaceLandmarks(0.72, 0.48, 0.16);
    const faceRightRaw = makeSimpleFaceLandmarks(0.28, 0.5, 0.15);

    const faces = summarizeDetectedFaces([faceRightRaw, faceLeftRaw]);
    expect(faces.length).toBe(2);
    // In mirrored view, larger raw x (0.72) is viewer-left => Subject 1
    expect(faces[0].displayNumber).toBe(1);
    expect(faces[0].index).toBe(1);
    expect(faces[1].displayNumber).toBe(2);
    expect(faces[1].index).toBe(0);

    // Without anchor, multi-face resolution pauses (ambiguous = true) instead of switching silently
    const paused = resolveTrackedFace(faces, null);
    expect(paused.ambiguous).toBe(true);
    expect(paused.activeFace).toBeNull();

    // Selecting Subject 1 locks anchor and tracks Subject 1 even if face array order flips in next frame
    const lockedAnchor = {
      centerX: faces[0].centerX,
      centerY: faces[0].centerY,
      scale: faces[0].scale,
      displayNumber: faces[0].displayNumber,
    };

    const nextFrameFaces = summarizeDetectedFaces([
      makeSimpleFaceLandmarks(0.7, 0.49, 0.16), // Subject 1 moved slightly
      makeSimpleFaceLandmarks(0.29, 0.51, 0.15), // Subject 2 moved slightly
    ]);
    const tracked = resolveTrackedFace(nextFrameFaces, lockedAnchor);
    expect(tracked.ambiguous).toBe(false);
    expect(tracked.activeFace?.centerX).toBeCloseTo(0.7, 3);
    expect(tracked.nextAnchor?.displayNumber).toBe(1);
  });
});
