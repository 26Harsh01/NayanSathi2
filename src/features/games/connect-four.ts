import type { GameDifficulty } from '../../types';

export const C4_ROWS = 6;
export const C4_COLS = 7;

export type ConnectFourDisc = 'R' | 'Y' | null;

export function createEmptyConnectFourBoard(): ConnectFourDisc[][] {
  return Array.from({ length: C4_ROWS }, () => Array<ConnectFourDisc>(C4_COLS).fill(null));
}

export function getAvailableRow(board: ConnectFourDisc[][], col: number): number {
  if (col < 0 || col >= C4_COLS) return -1;
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r;
  }
  return -1;
}

export interface ConnectFourEval {
  winner: 'R' | 'Y' | null;
  winningCells: [number, number][];
  isDraw: boolean;
}

export function evaluateConnectFour(board: ConnectFourDisc[][]): ConnectFourEval {
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= C4_ROWS || nc < 0 || nc >= C4_COLS) break;
          if (board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) {
          return { winner: player, winningCells: cells, isDraw: false };
        }
      }
    }
  }

  const isFull = board[0].every((cell) => cell !== null);
  return { winner: null, winningCells: [], isDraw: isFull };
}

function scoreWindow(window: ConnectFourDisc[], ai: 'R' | 'Y', human: 'R' | 'Y'): number {
  let aiCount = 0;
  let humanCount = 0;
  let emptyCount = 0;
  for (const cell of window) {
    if (cell === ai) aiCount++;
    else if (cell === human) humanCount++;
    else emptyCount++;
  }
  if (aiCount === 4) return 10000;
  if (humanCount === 4) return -10000;
  let score = 0;
  if (aiCount === 3 && emptyCount === 1) score += 25;
  else if (aiCount === 2 && emptyCount === 2) score += 5;
  if (humanCount === 3 && emptyCount === 1) score -= 35;
  return score;
}

function evaluateHeuristic(board: ConnectFourDisc[][], ai: 'R' | 'Y'): number {
  const human: 'R' | 'Y' = ai === 'R' ? 'Y' : 'R';
  let score = 0;
  const centerCol = Math.floor(C4_COLS / 2);
  for (let r = 0; r < C4_ROWS; r++) {
    if (board[r][centerCol] === ai) score += 4;
  }

  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], ai, human);
    }
  }
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r <= C4_ROWS - 4; r++) {
      score += scoreWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], ai, human);
    }
  }
  for (let r = 0; r <= C4_ROWS - 4; r++) {
    for (let c = 0; c <= C4_COLS - 4; c++) {
      score += scoreWindow(
        [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]],
        ai,
        human
      );
      score += scoreWindow(
        [board[r + 3][c], board[r + 2][c + 1], board[r + 1][c + 2], board[r][c + 3]],
        ai,
        human
      );
    }
  }
  return score;
}

function c4Minimax(
  board: ConnectFourDisc[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ai: 'R' | 'Y',
  human: 'R' | 'Y'
): number {
  const ev = evaluateConnectFour(board);
  if (ev.winner === ai) return 100000 + depth;
  if (ev.winner === human) return -100000 - depth;
  if (ev.isDraw || depth === 0) return evaluateHeuristic(board, ai);

  const validCols = [3, 2, 4, 1, 5, 0, 6].filter((c) => getAvailableRow(board, c) !== -1);

  if (maximizing) {
    let val = -Infinity;
    for (const c of validCols) {
      const r = getAvailableRow(board, c);
      board[r][c] = ai;
      val = Math.max(val, c4Minimax(board, depth - 1, alpha, beta, false, ai, human));
      board[r][c] = null;
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return val;
  } else {
    let val = Infinity;
    for (const c of validCols) {
      const r = getAvailableRow(board, c);
      board[r][c] = human;
      val = Math.min(val, c4Minimax(board, depth - 1, alpha, beta, true, ai, human));
      board[r][c] = null;
      beta = Math.min(beta, val);
      if (alpha >= beta) break;
    }
    return val;
  }
}

export function chooseConnectFourAIMove(
  board: ConnectFourDisc[][],
  ai: 'R' | 'Y',
  difficulty: GameDifficulty
): number | null {
  const validCols = [3, 2, 4, 1, 5, 0, 6].filter((c) => getAvailableRow(board, c) !== -1);
  if (validCols.length === 0) return null;

  if (difficulty === 'easy' && Math.random() < 0.5) {
    return validCols[Math.floor(Math.random() * validCols.length)];
  }

  const copy = board.map((row) => [...row]);
  const human: 'R' | 'Y' = ai === 'R' ? 'Y' : 'R';
  const depth = difficulty === 'hard' ? 5 : difficulty === 'medium' ? 3 : 2;

  let bestScore = -Infinity;
  let bestCol = validCols[0];

  for (const col of validCols) {
    const row = getAvailableRow(copy, col);
    copy[row][col] = ai;
    const score = c4Minimax(copy, depth - 1, -Infinity, Infinity, false, ai, human);
    copy[row][col] = null;
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  return bestCol;
}
