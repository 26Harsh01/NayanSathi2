export function createSolvedPuzzle(size: 3 | 4): number[] {
  const total = size * size;
  return Array.from({ length: total }, (_, idx) => (idx === total - 1 ? 0 : idx + 1));
}

export function isPuzzleSolved(board: number[]): boolean {
  const total = board.length;
  for (let i = 0; i < total - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[total - 1] === 0;
}

export function countInversions(board: number[]): number {
  const tiles = board.filter((v) => v !== 0);
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inv++;
    }
  }
  return inv;
}

export function isSolvablePuzzle(board: number[], size: 3 | 4): boolean {
  const inv = countInversions(board);
  if (size % 2 === 1) {
    return inv % 2 === 0;
  }
  const blankIdx = board.indexOf(0);
  const blankRowFromBottom = size - Math.floor(blankIdx / size);
  return blankRowFromBottom % 2 === 0 ? inv % 2 === 1 : inv % 2 === 0;
}

export function generateSolvablePuzzle(size: 3 | 4): number[] {
  const solved = createSolvedPuzzle(size);
  let candidate = [...solved];

  for (let attempt = 0; attempt < 200; attempt++) {
    candidate = [...solved];
    for (let i = candidate.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    }
    if (isSolvablePuzzle(candidate, size) && !isPuzzleSolved(candidate)) {
      return candidate;
    }
  }

  // Deterministic solvable fallback shuffle via valid random slides from solved state
  let blank = solved.length - 1;
  candidate = [...solved];
  for (let step = 0; step < 60; step++) {
    const r = Math.floor(blank / size);
    const c = blank % size;
    const neighbors: number[] = [];
    if (r > 0) neighbors.push((r - 1) * size + c);
    if (r < size - 1) neighbors.push((r + 1) * size + c);
    if (c > 0) neighbors.push(r * size + (c - 1));
    if (c < size - 1) neighbors.push(r * size + (c + 1));
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    [candidate[blank], candidate[pick]] = [candidate[pick], candidate[blank]];
    blank = pick;
  }
  return candidate;
}

export function canSlideTile(board: number[], size: 3 | 4, tileIndex: number): boolean {
  const blankIndex = board.indexOf(0);
  if (blankIndex === -1 || tileIndex === blankIndex) return false;
  const r1 = Math.floor(tileIndex / size);
  const c1 = tileIndex % size;
  const r2 = Math.floor(blankIndex / size);
  const c2 = blankIndex % size;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function slideTileIntoBlank(board: number[], size: 3 | 4, tileIndex: number): number[] | null {
  if (!canSlideTile(board, size, tileIndex)) return null;
  const blankIndex = board.indexOf(0);
  const next = [...board];
  [next[tileIndex], next[blankIndex]] = [next[blankIndex], next[tileIndex]];
  return next;
}
