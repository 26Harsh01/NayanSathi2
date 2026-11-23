export type TicTacToeMark = 'X' | 'O';
export type TicTacToeCell = TicTacToeMark | null;

const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface TicTacToeEvaluation {
  winner: TicTacToeMark | null;
  line: number[] | null;
  isDraw: boolean;
}

export function evaluateTicTacToe(board: TicTacToeCell[]): TicTacToeEvaluation {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line, isDraw: false };
    }
  }
  const isFull = board.every((cell) => cell !== null);
  return { winner: null, line: null, isDraw: isFull };
}

function minimax(
  board: TicTacToeCell[],
  depth: number,
  isMaximizing: boolean,
  aiMark: TicTacToeMark,
  humanMark: TicTacToeMark
): number {
  const res = evaluateTicTacToe(board);
  if (res.winner === aiMark) return 10 - depth;
  if (res.winner === humanMark) return depth - 10;
  if (res.isDraw) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiMark;
        best = Math.max(best, minimax(board, depth + 1, false, aiMark, humanMark));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanMark;
        best = Math.min(best, minimax(board, depth + 1, true, aiMark, humanMark));
        board[i] = null;
      }
    }
    return best;
  }
}

export function chooseTicTacToeAIMove(
  board: TicTacToeCell[],
  aiMark: TicTacToeMark,
  difficulty: 'easy' | 'medium' | 'hard'
): number | null {
  const openIndices: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) openIndices.push(i);
  }
  if (openIndices.length === 0) return null;

  if (difficulty === 'easy') {
    return openIndices[Math.floor(Math.random() * openIndices.length)];
  }

  if (difficulty === 'medium' && Math.random() < 0.35) {
    return openIndices[Math.floor(Math.random() * openIndices.length)];
  }

  const humanMark: TicTacToeMark = aiMark === 'X' ? 'O' : 'X';
  const copy = [...board];
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const idx of openIndices) {
    copy[idx] = aiMark;
    const score = minimax(copy, 0, false, aiMark, humanMark);
    copy[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }

  // Prefer center/corners deterministically on ties if desired, or pick among optimal moves
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? openIndices[0];
}
