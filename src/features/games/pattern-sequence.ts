import type { GameDifficulty } from '../../types';

export type PatternGameMode =
  | 'numbers'
  | 'shapes'
  | 'colours'
  | 'missing_object'
  | 'picture_match';

export interface PatternToken {
  id: string;
  label: string;
  kind: 'text' | 'shape' | 'colour' | 'object';
  colorHex?: string;
  shapeName?: 'circle' | 'square' | 'triangle' | 'star' | 'diamond';
  objectKey?: string;
}

export interface PatternChallenge {
  id: string;
  mode: PatternGameMode;
  prompt: string;
  sequence: PatternToken[]; // Contains a '?' placeholder token for missing slots
  target?: PatternToken; // Used for picture_match mode
  options: PatternToken[];
  correctOptionId: string;
  explanation: string;
}

const SHAPE_TOKENS: PatternToken[] = [
  { id: 'sh_circle', label: 'Circle', kind: 'shape', shapeName: 'circle', colorHex: '#0f766e' },
  { id: 'sh_square', label: 'Square', kind: 'shape', shapeName: 'square', colorHex: '#1e3a8a' },
  { id: 'sh_triangle', label: 'Triangle', kind: 'shape', shapeName: 'triangle', colorHex: '#b45309' },
  { id: 'sh_star', label: 'Star', kind: 'shape', shapeName: 'star', colorHex: '#7c3aed' },
  { id: 'sh_diamond', label: 'Diamond', kind: 'shape', shapeName: 'diamond', colorHex: '#be123c' },
];

const COLOUR_TOKENS: PatternToken[] = [
  { id: 'col_teal', label: 'Teal', kind: 'colour', colorHex: '#0d9488' },
  { id: 'col_navy', label: 'Navy Blue', kind: 'colour', colorHex: '#1e40af' },
  { id: 'col_amber', label: 'Warm Gold', kind: 'colour', colorHex: '#d97706' },
  { id: 'col_rose', label: 'Coral Red', kind: 'colour', colorHex: '#e11d48' },
  { id: 'col_emerald', label: 'Leaf Green', kind: 'colour', colorHex: '#16a34a' },
];

const OBJECT_TOKENS: PatternToken[] = [
  { id: 'obj_sun', label: 'Sun', kind: 'object', objectKey: 'sun' },
  { id: 'obj_moon', label: 'Moon', kind: 'object', objectKey: 'moon' },
  { id: 'obj_leaf', label: 'Leaf', kind: 'object', objectKey: 'leaf' },
  { id: 'obj_cup', label: 'Cup', kind: 'object', objectKey: 'cup' },
  { id: 'obj_book', label: 'Book', kind: 'object', objectKey: 'book' },
  { id: 'obj_key', label: 'Key', kind: 'object', objectKey: 'key' },
];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const QUESTION_TOKEN: PatternToken = {
  id: 'missing_slot',
  label: '?',
  kind: 'text',
};

export function generatePatternChallenge(
  mode: PatternGameMode,
  difficulty: GameDifficulty
): PatternChallenge {
  const id = `pat_${mode}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

  if (mode === 'numbers') {
    const start = Math.floor(Math.random() * 8) + 1;
    let nums: number[] = [];
    let nextVal = 0;
    let explanation = '';

    if (difficulty === 'easy') {
      const step = [1, 2, 5][Math.floor(Math.random() * 3)];
      nums = [0, 1, 2, 3].map((i) => start + i * step);
      nextVal = start + 4 * step;
      explanation = `Each number increases by ${step}.`;
    } else if (difficulty === 'medium') {
      const step = [3, 4, 6, 7][Math.floor(Math.random() * 4)];
      nums = [0, 1, 2, 3, 4].map((i) => start + i * step);
      nextVal = start + 5 * step;
      explanation = `Each step adds ${step}.`;
    } else {
      // Growing step: +1, +2, +3, +4 or double
      if (Math.random() < 0.5) {
        nums = [start];
        for (let i = 1; i <= 4; i++) nums.push(nums[i - 1] + i * 2);
        nextVal = nums[4] + 10;
        explanation = 'The difference grows by +2 each step (+2, +4, +6, +8, +10).';
      } else {
        const a = Math.floor(Math.random() * 3) + 1;
        const b = a + 2;
        nums = [a, b, a + b, b + (a + b)];
        nextVal = nums[2] + nums[3];
        explanation = 'Each number is the sum of the two previous numbers.';
      }
    }

    const distractors = new Set<number>([nextVal]);
    while (distractors.size < 4) {
      const offset = (Math.floor(Math.random() * 7) - 3) || 1;
      const cand = Math.max(1, nextVal + offset);
      distractors.add(cand);
    }

    const options: PatternToken[] = shuffleArray(Array.from(distractors)).map((n) => ({
      id: `num_${n}`,
      label: String(n),
      kind: 'text',
    }));

    return {
      id,
      mode,
      prompt: 'Which number completes the sequence?',
      sequence: [
        ...nums.map((n, idx) => ({ id: `seq_${idx}`, label: String(n), kind: 'text' as const })),
        QUESTION_TOKEN,
      ],
      options,
      correctOptionId: `num_${nextVal}`,
      explanation,
    };
  }

  if (mode === 'shapes') {
    const pool = shuffleArray(SHAPE_TOKENS);
    const period = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    const cycle = pool.slice(0, period);
    const length = difficulty === 'easy' ? 4 : 6;
    const seq = Array.from({ length }, (_, idx) => cycle[idx % period]);
    const answer = cycle[length % period];

    return {
      id,
      mode,
      prompt: 'Which shape comes next in the pattern?',
      sequence: [...seq, QUESTION_TOKEN],
      options: shuffleArray(pool.slice(0, 4).some((t) => t.id === answer.id) ? pool.slice(0, 4) : [answer, ...pool.slice(0, 3)]),
      correctOptionId: answer.id,
      explanation: `The shape pattern repeats every ${period} shapes.`,
    };
  }

  if (mode === 'colours') {
    const pool = shuffleArray(COLOUR_TOKENS);
    const period = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    const cycle = pool.slice(0, period);
    const length = difficulty === 'easy' ? 4 : 6;
    const seq = Array.from({ length }, (_, idx) => cycle[idx % period]);
    const answer = cycle[length % period];
    const baseOpts = pool.slice(0, 4);
    if (!baseOpts.some((c) => c.id === answer.id)) baseOpts[0] = answer;

    return {
      id,
      mode,
      prompt: 'Which colour comes next in the pattern?',
      sequence: [...seq, QUESTION_TOKEN],
      options: shuffleArray(baseOpts),
      correctOptionId: answer.id,
      explanation: `The colour sequence repeats every ${period} colours.`,
    };
  }

  if (mode === 'missing_object') {
    const pool = shuffleArray(OBJECT_TOKENS);
    const period = difficulty === 'easy' ? 2 : 3;
    const cycle = pool.slice(0, period);
    const full = Array.from({ length: 6 }, (_, i) => cycle[i % period]);
    const hideIdx = difficulty === 'easy' ? 3 : Math.floor(Math.random() * 4) + 1;
    const answer = full[hideIdx];
    const seq = full.map((tok, idx) => (idx === hideIdx ? QUESTION_TOKEN : tok));
    const opts = pool.slice(0, 4);
    if (!opts.some((o) => o.id === answer.id)) opts[0] = answer;

    return {
      id,
      mode,
      prompt: 'Find the missing object in the row:',
      sequence: seq,
      options: shuffleArray(opts),
      correctOptionId: answer.id,
      explanation: `${answer.label} belongs at position ${hideIdx + 1} to keep the repeating pattern.`,
    };
  }

  // picture_match
  const pool = shuffleArray(OBJECT_TOKENS);
  const target = pool[0];
  const opts = shuffleArray(pool.slice(0, difficulty === 'easy' ? 3 : 4));
  return {
    id,
    mode: 'picture_match',
    prompt: `Select the picture that matches "${target.label}":`,
    sequence: [],
    target,
    options: opts,
    correctOptionId: target.id,
    explanation: `Matched ${target.label}.`,
  };
}
