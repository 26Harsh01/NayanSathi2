import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { GameDifficulty } from '../../types';

export interface ChessPuzzleItem {
  id: string;
  title: string;
  description: string;
  fen: string;
  solutionSan: string[];
  hint: string;
}

export const BEGINNER_CHESS_PUZZLES: ChessPuzzleItem[] = [
  {
    id: 'puz_backrank',
    title: 'Puzzle 1: Back-Rank Checkmate (White to Move)',
    description: 'White Rook can deliver checkmate on the back rank in 1 move.',
    fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    solutionSan: ['Rd8#'],
    hint: 'Move your Rook all the way to the 8th rank (d8).',
  },
  {
    id: 'puz_queen_mate',
    title: 'Puzzle 2: Supported Queen Mate (White to Move)',
    description: 'Use your Queen supported by your Bishop to checkmate Black in 1 move.',
    fen: '6k1/5ppp/8/8/2B5/8/5QPP/6K1 w - - 0 1',
    solutionSan: ['Qxf7#'],
    hint: 'The pawn on f7 is protected only by the King, while your Bishop guards f7!',
  },
  {
    id: 'puz_scholars_finish',
    title: 'Puzzle 3: Rook & King Mate (White to Move)',
    description: 'Deliver a clean side-rank checkmate with your Rook.',
    fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
    solutionSan: ['Qg7#', 'Qf8#'],
    hint: 'Your King on g6 protects g7 and blocks escape.',
  },
  {
    id: 'puz_arabian_mate',
    title: 'Puzzle 4: Knight & Rook Teamwork (White to Move)',
    description: 'The Knight guards the escape square while the Rook finishes the game.',
    fen: '7k/8/5N1K/8/8/8/8/6R1 w - - 0 1',
    solutionSan: ['Rg8#'],
    hint: 'Move the Rook to g8 — your Knight on f6 covers h7!',
  },
];

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluateBoardScore(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate()) return 0;

  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const base = PIECE_VALUES[piece.type] || 0;
      const centerBonus =
        r >= 2 && r <= 5 && c >= 2 && c <= 5 ? (piece.type === 'p' || piece.type === 'n' ? 18 : 8) : 0;
      const total = base + centerBonus;
      score += piece.color === 'w' ? total : -total;
    }
  }
  return score;
}

function alphabeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoardScore(chess);
  }

  const moves = chess.moves({ verbose: true });
  // Order captures and checks first for faster pruning
  moves.sort((a, b) => {
    const scoreA = (a.captured ? 10 : 0) + (a.promotion ? 8 : 0);
    const scoreB = (b.captured ? 10 : 0) + (b.promotion ? 8 : 0);
    return scoreB - scoreA;
  });

  if (maximizingWhite) {
    let value = -Infinity;
    for (const m of moves) {
      chess.move(m);
      value = Math.max(value, alphabeta(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const m of moves) {
      chess.move(m);
      value = Math.min(value, alphabeta(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
}

export function chooseLocalChessMove(fen: string, difficulty: GameDifficulty): Move | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const captures = moves.filter((m) => Boolean(m.captured));
    if (captures.length > 0 && Math.random() < 0.45) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const depth = difficulty === 'hard' ? 3 : 2;
  const maximizingWhite = chess.turn() === 'w';
  let bestScore = maximizingWhite ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of moves) {
    chess.move(move);
    const score = alphabeta(chess, depth - 1, -Infinity, Infinity, !maximizingWhite);
    chess.undo();

    if (maximizingWhite) {
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? moves[0];
}

export async function requestComputerChessMove(
  fen: string,
  difficulty: GameDifficulty
): Promise<{ move: Move | null; engineUsed: 'stockfish' | 'built-in' }> {
  try {
    const depth = difficulty === 'hard' ? 12 : difficulty === 'medium' ? 6 : 2;
    const res = await fetch('/api/chess/best-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth }),
    });
    if (res.ok) {
      const data = (await res.json()) as { source?: string; bestmove?: string };
      if (data.source === 'stockfish' && typeof data.bestmove === 'string' && data.bestmove.length >= 4) {
        const chess = new Chess(fen);
        const from = data.bestmove.slice(0, 2) as Square;
        const to = data.bestmove.slice(2, 4) as Square;
        const promotion = data.bestmove[4] as PieceSymbol | undefined;
        try {
          const parsedMove = chess.move({ from, to, promotion: promotion || 'q' });
          if (parsedMove) {
            return { move: parsedMove, engineUsed: 'stockfish' };
          }
        } catch {
          // Fall back cleanly to built-in legal move search
        }
      }
    }
  } catch {
    // Offline or Stockfish not configured; fall back cleanly
  }

  return {
    move: chooseLocalChessMove(fen, difficulty),
    engineUsed: 'built-in',
  };
}
