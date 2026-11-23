import React, { useEffect, useState } from 'react';
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { Lightbulb, Pause, Play, RotateCcw, Undo2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  BEGINNER_CHESS_PUZZLES,
  requestComputerChessMove,
} from '../../features/games/chess-engine';
import { GazeButton } from '../gaze/GazeButton';
import type { GameDifficulty } from '../../types';

const UNICODE_PIECES: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessGame: React.FC<{ onBackToLibrary: () => void }> = ({ onBackToLibrary }) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult } = useGames();

  const [playMode, setPlayMode] = useState<'pvc' | 'pvp' | 'puzzle'>('pvp');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(gamesState.preferredDifficulty);
  const [chess, setChess] = useState<Chess>(() => new Chess());
  const [fenHistory, setFenHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const [paused, setPaused] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [engineLabel, setEngineLabel] = useState<'built-in' | 'stockfish'>('built-in');
  const [statusMessage, setStatusMessage] = useState(
    'White to move. Select a piece to view legal destinations.'
  );
  const [recordedOutcome, setRecordedOutcome] = useState(false);

  const currentPuzzle = BEGINNER_CHESS_PUZZLES[puzzleIdx];
  const boardMatrix = chess.board();
  const legalMovesForSelected: Move[] = selectedSquare
    ? chess.moves({ square: selectedSquare, verbose: true })
    : [];
  const legalTargetsSet = new Set(legalMovesForSelected.map((m) => m.to));

  const readInstructions = () => {
    speakText(
      'Chess. All FIDE rules including castling, en passant, pawn promotion, check, and checkmate are enforced. First select one of your pieces, then select a marked legal destination square.',
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  const applyNewChessInstance = (next: Chess, pushFen?: string) => {
    if (pushFen) setFenHistory((prev) => [...prev, pushFen]);
    setChess(next);
    setSelectedSquare(null);
  };

  // Detect game end & record scores once
  useEffect(() => {
    if (!chess.isGameOver()) return;

    let msg = 'Game over.';
    let outcome: 'win' | 'loss' | 'draw' | 'completed' = 'draw';
    let puzzleSolved = false;

    if (chess.isCheckmate()) {
      const winnerColor = chess.turn() === 'w' ? 'Black' : 'White';
      msg = `Checkmate! ${winnerColor} wins.`;
      if (playMode === 'puzzle') {
        outcome = 'completed';
        puzzleSolved = true;
        msg = `Puzzle solved! ${winnerColor} delivered checkmate.`;
      } else if (playMode === 'pvc') {
        outcome = winnerColor === 'White' ? 'win' : 'loss';
      } else {
        outcome = 'win';
      }
    } else if (chess.isStalemate()) {
      msg = 'Stalemate — game drawn.';
      outcome = 'draw';
    } else if (chess.isDraw()) {
      msg = 'Draw (insufficient material or repetition).';
      outcome = 'draw';
    }

    setStatusMessage(msg);
    if (!recordedOutcome) {
      setRecordedOutcome(true);
      recordGameResult({
        gameId: 'chess',
        outcome,
        difficulty,
        moves: chess.history().length,
        puzzleSolved,
        summary: msg,
      });
    }
  }, [chess, difficulty, playMode, recordGameResult, recordedOutcome]);

  // Computer move in PvC when Black's turn
  useEffect(() => {
    if (playMode !== 'pvc' || chess.turn() !== 'b' || chess.isGameOver() || paused || pendingPromotion) {
      return;
    }

    let cancelled = false;
    setAiThinking(true);
    const timer = window.setTimeout(async () => {
      const { move, engineUsed } = await requestComputerChessMove(chess.fen(), difficulty);
      if (cancelled) return;
      setAiThinking(false);
      setEngineLabel(engineUsed);
      if (!move) return;

      const next = new Chess();
      next.loadPgn(chess.pgn() || '');
      const prevFen = chess.fen();
      try {
        next.move(move);
      } catch {
        const fallback = new Chess(chess.fen());
        fallback.move(move);
        applyNewChessInstance(fallback, prevFen);
        setStatusMessage(`Computer played ${move.san} (${engineUsed}). White to move.`);
        return;
      }
      applyNewChessInstance(next, prevFen);
      setStatusMessage(
        `Computer played ${move.san} (${engineUsed}). ${next.inCheck() ? 'Check! ' : ''}White to move.`
      );
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setAiThinking(false);
    };
  }, [chess, difficulty, paused, pendingPromotion, playMode]);

  const startStandardGame = (nextMode: 'pvc' | 'pvp') => {
    setPlayMode(nextMode);
    setChess(new Chess());
    setFenHistory([]);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setRecordedOutcome(false);
    setPaused(false);
    setStatusMessage(
      nextMode === 'pvc'
        ? 'New game vs Computer (You play White). Select a piece.'
        : 'New Two-Player game. White to move.'
    );
  };

  const loadPuzzle = (index: number) => {
    const puz = BEGINNER_CHESS_PUZZLES[index];
    setPlayMode('puzzle');
    setPuzzleIdx(index);
    setShowPuzzleHint(false);
    setChess(new Chess(puz.fen));
    setFenHistory([]);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setRecordedOutcome(false);
    setPaused(false);
    setStatusMessage(`${puz.title} — ${puz.description}`);
  };

  const executeMove = (from: Square, to: Square, promotion?: PieceSymbol) => {
    const prevFen = chess.fen();
    const next = new Chess();
    try {
      const pgn = chess.pgn();
      if (pgn) next.loadPgn(pgn);
      else next.load(prevFen);
    } catch {
      next.load(prevFen);
    }

    let moved: Move | null = null;
    try {
      moved = next.move({ from, to, promotion });
    } catch {
      moved = null;
    }

    if (!moved) {
      setStatusMessage('Illegal chess move rejected. Choose a highlighted legal square.');
      return;
    }

    if (playMode === 'puzzle') {
      const expected = currentPuzzle.solutionSan;
      if (!expected.includes(moved.san) && !next.isCheckmate()) {
        setStatusMessage(
          `${moved.san} is legal, but not the puzzle checkmate solution. Try again or view the hint.`
        );
        return;
      }
    }

    applyNewChessInstance(next, prevFen);
    if (!next.isGameOver()) {
      const nextTurn = next.turn() === 'w' ? 'White' : 'Black';
      setStatusMessage(
        `Played ${moved.san}. ${next.inCheck() ? 'Check! ' : ''}${nextTurn} to move.`
      );
    }
  };

  const handleSquareClick = (sq: Square) => {
    if (paused || aiThinking || chess.isGameOver() || pendingPromotion) return;
    if (playMode === 'pvc' && chess.turn() !== 'w') return;

    const pieceOnSq = chess.get(sq);

    if (!selectedSquare) {
      if (!pieceOnSq || pieceOnSq.color !== chess.turn()) {
        setStatusMessage(
          `Select a ${chess.turn() === 'w' ? 'White' : 'Black'} piece first.`
        );
        return;
      }
      const legal = chess.moves({ square: sq, verbose: true });
      if (legal.length === 0) {
        setStatusMessage(`No legal moves for piece on ${sq}.`);
        return;
      }
      setSelectedSquare(sq);
      setStatusMessage(
        `Selected ${pieceOnSq.type.toUpperCase()} on ${sq} (${legal.length} legal destination${legal.length > 1 ? 's' : ''}).`
      );
      return;
    }

    if (selectedSquare === sq) {
      setSelectedSquare(null);
      setStatusMessage('Piece selection cleared.');
      return;
    }

    // Re-select another friendly piece directly
    if (pieceOnSq && pieceOnSq.color === chess.turn() && !legalTargetsSet.has(sq)) {
      const legal = chess.moves({ square: sq, verbose: true });
      setSelectedSquare(sq);
      setStatusMessage(`Selected piece on ${sq} (${legal.length} legal moves).`);
      return;
    }

    const matchingMoves = legalMovesForSelected.filter((m) => m.to === sq);
    if (matchingMoves.length === 0) {
      setStatusMessage(`Move ${selectedSquare} → ${sq} is not legal.`);
      return;
    }

    // Pawn promotion check
    if (matchingMoves.some((m) => m.isPromotion())) {
      setPendingPromotion({ from: selectedSquare, to: sq });
      setStatusMessage('Choose a piece for pawn promotion.');
      return;
    }

    executeMove(selectedSquare, sq);
  };

  const handleUndo = () => {
    if (fenHistory.length === 0 || paused || aiThinking) return;
    const stepsBack = playMode === 'pvc' && chess.turn() === 'w' && fenHistory.length >= 2 ? 2 : 1;
    const idx = Math.max(0, fenHistory.length - stepsBack);
    const restored = new Chess(fenHistory[idx]);
    setChess(restored);
    setFenHistory(fenHistory.slice(0, idx));
    setSelectedSquare(null);
    setPendingPromotion(null);
    setRecordedOutcome(false);
    setStatusMessage('Last chess move undone.');
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Chess {playMode === 'puzzle' ? '— Beginner Puzzles' : ''}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Complete legal rules (castling, en passant, pawn promotion, checkmate & stalemate). Computer engine: {engineLabel === 'stockfish' ? 'Stockfish' : 'Built-in Legal Search'}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="chess_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton
            gazeId="chess_pause"
            sizeOverride="standard"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="chess_undo"
            sizeOverride="standard"
            disabled={fenHistory.length === 0 || paused || aiThinking}
            onClick={handleUndo}
          >
            <Undo2 className="w-4 h-4" />
            <span>Undo</span>
          </GazeButton>
          <GazeButton
            gazeId="chess_restart"
            sizeOverride="standard"
            onClick={() =>
              playMode === 'puzzle' ? loadPuzzle(puzzleIdx) : startStandardGame(playMode)
            }
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton gazeId="chess_back" variant="subtle" sizeOverride="standard" onClick={onBackToLibrary}>
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="flex flex-wrap items-center gap-2.5">
        <GazeButton
          gazeId="chess_mode_pvp"
          variant={playMode === 'pvp' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => startStandardGame('pvp')}
        >
          <span>Two Players</span>
        </GazeButton>
        <GazeButton
          gazeId="chess_mode_pvc"
          variant={playMode === 'pvc' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => startStandardGame('pvc')}
        >
          <span>vs Computer</span>
        </GazeButton>
        <GazeButton
          gazeId="chess_mode_puzzle"
          variant={playMode === 'puzzle' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => loadPuzzle(puzzleIdx)}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Beginner Puzzles</span>
        </GazeButton>

        {playMode === 'pvc' && (
          <div className="flex gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((lvl) => (
              <GazeButton
                key={lvl}
                gazeId={`chess_diff_${lvl}`}
                variant={difficulty === lvl ? 'primary' : 'default'}
                sizeOverride="standard"
                onClick={() => setDifficulty(lvl)}
              >
                <span className="capitalize">{lvl}</span>
              </GazeButton>
            ))}
          </div>
        )}
      </div>

      {playMode === 'puzzle' && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {BEGINNER_CHESS_PUZZLES.map((p, idx) => (
                <GazeButton
                  key={p.id}
                  gazeId={`chess_puz_${idx}`}
                  variant={puzzleIdx === idx ? 'primary' : 'default'}
                  sizeOverride="standard"
                  onClick={() => loadPuzzle(idx)}
                >
                  <span>Puzzle {idx + 1}</span>
                </GazeButton>
              ))}
            </div>
            <GazeButton
              gazeId="chess_puz_hint"
              variant="subtle"
              sizeOverride="standard"
              onClick={() => setShowPuzzleHint((h) => !h)}
            >
              <Lightbulb className="w-4 h-4" />
              <span>{showPuzzleHint ? 'Hide Hint' : 'Show Hint'}</span>
            </GazeButton>
          </div>
          {showPuzzleHint && (
            <p className="text-xs text-teal-800 dark:text-teal-300 font-medium">
              Hint: {currentPuzzle.hint}
            </p>
          )}
        </div>
      )}

      {/* Confirmation Status Banner */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">
          {aiThinking ? 'Computer is calculating legal move...' : statusMessage}
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          Turn: {chess.turn() === 'w' ? 'White' : 'Black'} · Moves: {chess.history().length}
        </span>
      </div>

      {/* Promotion Picker Modal Overlay */}
      {pendingPromotion && (
        <div className="p-4 rounded-2xl border-2 border-teal-600 bg-white dark:bg-slate-900 space-y-3">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Select Promotion Piece:
          </p>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['q', 'Queen ♕'],
                ['r', 'Rook ♖'],
                ['b', 'Bishop ♗'],
                ['n', 'Knight ♘'],
              ] as [PieceSymbol, string][]
            ).map(([sym, label]) => (
              <GazeButton
                key={sym}
                gazeId={`chess_promo_${sym}`}
                variant="primary"
                onClick={() => {
                  const { from, to } = pendingPromotion;
                  setPendingPromotion(null);
                  executeMove(from, to, sym);
                }}
              >
                <span>{label}</span>
              </GazeButton>
            ))}
          </div>
        </div>
      )}

      {/* Main Board + Move History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          {paused ? (
            <div className="p-12 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
              <p className="text-lg font-bold">Chess Paused</p>
              <GazeButton gazeId="chess_resume_center" variant="primary" onClick={() => setPaused(false)}>
                <Play className="w-4 h-4" />
                <span>Resume Game</span>
              </GazeButton>
            </div>
          ) : (
            <div
              className="grid grid-cols-8 border-2 border-slate-400 dark:border-slate-600 rounded-xl overflow-hidden max-w-[560px] mx-auto select-none"
              role="grid"
              aria-label="Chessboard"
            >
              {RANKS.map((rank, rIdx) =>
                FILES.map((file, cIdx) => {
                  const sq = `${file}${rank}` as Square;
                  const piece = boardMatrix[rIdx][cIdx];
                  const isDark = (rIdx + cIdx) % 2 === 1;
                  const isSelected = selectedSquare === sq;
                  const isLegalDest = legalTargetsSet.has(sq);
                  const glyph = piece ? UNICODE_PIECES[`${piece.color}${piece.type}`] : '';

                  return (
                    <button
                      key={sq}
                      type="button"
                      data-gaze-target={`chess_sq_${sq}`}
                      data-gaze-label={`Square ${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ''}`}
                      onClick={() => handleSquareClick(sq)}
                      aria-label={`Square ${sq}${piece ? `, ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ', empty'}`}
                      className={`aspect-square relative flex items-center justify-center text-2xl sm:text-3xl cursor-pointer border ${
                        isSelected
                          ? 'bg-teal-100 dark:bg-teal-900/70 border-teal-700'
                          : isDark
                            ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span className="leading-none text-slate-900 dark:text-slate-100">
                        {glyph}
                      </span>
                      {isLegalDest && (
                        <span
                          aria-hidden="true"
                          className={`absolute rounded-full pointer-events-none ${
                            piece
                              ? 'inset-1 border-2 border-teal-700 dark:border-teal-400'
                              : 'w-3 h-3 bg-teal-700/70 dark:bg-teal-400/80'
                          }`}
                        />
                      )}
                      {cIdx === 0 && (
                        <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-500">
                          {rank}
                        </span>
                      )}
                      {rIdx === 7 && (
                        <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-slate-500">
                          {file}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Move List ({chess.history().length})
          </h3>
          {chess.history().length === 0 ? (
            <p className="text-xs text-slate-500">No moves played yet.</p>
          ) : (
            <ol className="text-xs font-mono grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
              {chess.history().map((san, idx) => (
                <li
                  key={`${idx}_${san}`}
                  className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800/60"
                >
                  {idx + 1}. {san}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
};
