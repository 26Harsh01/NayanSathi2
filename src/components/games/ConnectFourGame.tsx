import React, { useEffect, useState } from 'react';
import { ArrowDown, Pause, Play, RotateCcw, Undo2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  C4_COLS,
  C4_ROWS,
  chooseConnectFourAIMove,
  createEmptyConnectFourBoard,
  evaluateConnectFour,
  getAvailableRow,
  type ConnectFourDisc,
} from '../../features/games/connect-four';
import type { GameDifficulty } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

export const ConnectFourGame: React.FC<{ onBackToLibrary: () => void }> = ({
  onBackToLibrary,
}) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult } = useGames();

  const [mode, setMode] = useState<'pvc' | 'pvp'>('pvc');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(gamesState.preferredDifficulty);
  const [board, setBoard] = useState<ConnectFourDisc[][]>(() => createEmptyConnectFourBoard());
  const [history, setHistory] = useState<ConnectFourDisc[][][]>([]);
  const [turn, setTurn] = useState<'R' | 'Y'>('R');
  const [paused, setPaused] = useState(false);
  const [statusNote, setStatusNote] = useState(
    'Select any column button (1–7) or board square in a column to drop your disc.'
  );
  const [recorded, setRecorded] = useState(false);

  const evalResult = evaluateConnectFour(board);
  const gameOver = Boolean(evalResult.winner || evalResult.isDraw);
  const scores = gamesState.scores['connect-four'];

  useEffect(() => {
    if (!gameOver || recorded) return;
    setRecorded(true);
    const totalDiscs = board.flat().filter(Boolean).length;
    if (evalResult.winner === 'R') {
      setStatusNote(mode === 'pvc' ? 'You won! Four Red discs connected!' : 'Player 1 (Red) wins!');
      recordGameResult({
        gameId: 'connect-four',
        outcome: 'win',
        difficulty,
        moves: totalDiscs,
        summary: mode === 'pvc' ? `Won vs Computer (${difficulty})` : 'Player 1 (Red) won (2P)',
      });
    } else if (evalResult.winner === 'Y') {
      setStatusNote(mode === 'pvc' ? 'Computer (Yellow) connected four.' : 'Player 2 (Yellow) wins!');
      recordGameResult({
        gameId: 'connect-four',
        outcome: mode === 'pvc' ? 'loss' : 'win',
        difficulty,
        moves: totalDiscs,
        summary: mode === 'pvc' ? `Computer won (${difficulty})` : 'Player 2 (Yellow) won (2P)',
      });
    } else if (evalResult.isDraw) {
      setStatusNote('Board full — game ended in a draw.');
      recordGameResult({
        gameId: 'connect-four',
        outcome: 'draw',
        difficulty,
        moves: totalDiscs,
        summary: 'Connect Four Draw',
      });
    }
  }, [board, difficulty, evalResult.isDraw, evalResult.winner, gameOver, mode, recordGameResult, recorded]);

  useEffect(() => {
    if (mode !== 'pvc' || turn !== 'Y' || gameOver || paused) return;
    const timer = window.setTimeout(() => {
      const col = chooseConnectFourAIMove(board, 'Y', difficulty);
      if (col === null) return;
      const row = getAvailableRow(board, col);
      if (row === -1) return;
      setHistory((prev) => [...prev, board.map((r) => [...r])]);
      setBoard((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = 'Y';
        return next;
      });
      setTurn('R');
      setStatusNote(`Computer dropped Yellow in Column ${col + 1}. Your turn (Red).`);
    }, 340);
    return () => window.clearTimeout(timer);
  }, [board, difficulty, gameOver, mode, paused, turn]);

  const handleDropInCol = (col: number) => {
    if (paused || gameOver) return;
    if (mode === 'pvc' && turn !== 'R') return;
    const row = getAvailableRow(board, col);
    if (row === -1) {
      setStatusNote(`Column ${col + 1} is already full. Choose another column.`);
      return;
    }

    const activePlayer = turn;
    setHistory((prev) => [...prev, board.map((r) => [...r])]);
    setBoard((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = activePlayer;
      return next;
    });
    setTurn(activePlayer === 'R' ? 'Y' : 'R');
    setStatusNote(
      `Dropped ${activePlayer === 'R' ? 'Red' : 'Yellow'} disc into Column ${col + 1}.`
    );
  };

  const handleUndo = () => {
    if (history.length === 0 || paused) return;
    const stepsBack = mode === 'pvc' && turn === 'R' && history.length >= 2 ? 2 : 1;
    const targetIdx = Math.max(0, history.length - stepsBack);
    setBoard(history[targetIdx].map((r) => [...r]));
    setHistory(history.slice(0, targetIdx));
    setTurn(mode === 'pvc' ? 'R' : targetIdx % 2 === 0 ? 'R' : 'Y');
    setRecorded(false);
    setStatusNote('Last move undone.');
  };

  const handleRestart = (nextMode: 'pvc' | 'pvp' = mode, nextDiff: GameDifficulty = difficulty) => {
    setMode(nextMode);
    setDifficulty(nextDiff);
    setBoard(createEmptyConnectFourBoard());
    setHistory([]);
    setTurn('R');
    setPaused(false);
    setRecorded(false);
    setStatusNote('New Connect Four board ready. Red moves first.');
  };

  const readInstructions = () => {
    speakText(
      'Connect Four. Choose vs Computer or Two Players. Select any column numbered 1 through 7 to drop your coloured disc. Connect four discs horizontally, vertically, or diagonally to win.',
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  const winningKeySet = new Set(evalResult.winningCells.map(([r, c]) => `${r}_${c}`));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connect Four</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Select a column header or any slot inside that column to drop a disc.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="c4_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton gazeId="c4_pause" sizeOverride="standard" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="c4_undo"
            sizeOverride="standard"
            disabled={history.length === 0 || paused}
            onClick={handleUndo}
          >
            <Undo2 className="w-4 h-4" />
            <span>Undo</span>
          </GazeButton>
          <GazeButton
            gazeId="c4_restart"
            sizeOverride="standard"
            onClick={() => handleRestart(mode, difficulty)}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton
            gazeId="c4_back"
            variant="subtle"
            sizeOverride="standard"
            onClick={onBackToLibrary}
          >
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Mode & Difficulty */}
      <div className="flex flex-wrap items-center gap-2.5">
        <GazeButton
          gazeId="c4_mode_pvc"
          variant={mode === 'pvc' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => handleRestart('pvc', difficulty)}
        >
          <span>vs Computer</span>
        </GazeButton>
        <GazeButton
          gazeId="c4_mode_pvp"
          variant={mode === 'pvp' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => handleRestart('pvp', difficulty)}
        >
          <span>Two Players</span>
        </GazeButton>

        {mode === 'pvc' && (
          <div className="flex gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((lvl) => (
              <GazeButton
                key={lvl}
                gazeId={`c4_diff_${lvl}`}
                variant={difficulty === lvl ? 'primary' : 'default'}
                sizeOverride="standard"
                onClick={() => handleRestart('pvc', lvl)}
              >
                <span className="capitalize">{lvl}</span>
              </GazeButton>
            ))}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{statusNote}</span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Turn: {gameOver ? 'Finished' : turn === 'R' ? 'Red' : 'Yellow'} · Record: {scores.wins}W / {scores.losses}L / {scores.draws}D
        </span>
      </div>

      {paused ? (
        <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
          <p className="text-lg font-bold">Connect Four Paused</p>
          <GazeButton gazeId="c4_resume_center" variant="primary" onClick={() => setPaused(false)}>
            <Play className="w-4 h-4" />
            <span>Resume Game</span>
          </GazeButton>
        </div>
      ) : (
        <div className="max-w-xl mx-auto space-y-3">
          {/* Column Drop Buttons (Large Gaze Targets, Zero Colored Hover Highlight) */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: C4_COLS }, (_, c) => {
              const colFull = getAvailableRow(board, c) === -1;
              return (
                <GazeButton
                  key={c}
                  gazeId={`c4_drop_${c}`}
                  gazeLabel={`Drop in Column ${c + 1}`}
                  sizeOverride="standard"
                  disabled={colFull || gameOver}
                  onClick={() => handleDropInCol(c)}
                  className="px-1 py-2 min-h-[52px]"
                >
                  <ArrowDown className="w-4 h-4" />
                  <span className="font-mono">{c + 1}</span>
                </GazeButton>
              );
            })}
          </div>

          {/* 6x7 Board */}
          <div
            className="p-3 rounded-2xl bg-slate-800 dark:bg-slate-900 border-2 border-slate-700 grid grid-cols-7 gap-2"
            role="grid"
            aria-label="Connect Four Board"
          >
            {Array.from({ length: C4_ROWS }, (_, r) =>
              Array.from({ length: C4_COLS }, (_, c) => {
                const cell = board[r][c];
                const isWin = winningKeySet.has(`${r}_${c}`);
                const colFull = getAvailableRow(board, c) === -1;
                return (
                  <button
                    key={`${r}_${c}`}
                    type="button"
                    data-gaze-target={`c4_cell_${r}_${c}`}
                    data-gaze-label={`Column ${c + 1}`}
                    disabled={colFull || gameOver}
                    onClick={() => handleDropInCol(c)}
                    aria-label={`Row ${r + 1} Column ${c + 1}, ${
                      cell === 'R' ? 'Red disc' : cell === 'Y' ? 'Yellow disc' : 'empty'
                    }`}
                    className={`aspect-square rounded-full border-2 flex items-center justify-center cursor-pointer disabled:cursor-default ${
                      isWin
                        ? 'border-white ring-2 ring-white'
                        : 'border-slate-600'
                    } ${
                      cell === 'R'
                        ? 'bg-rose-600'
                        : cell === 'Y'
                          ? 'bg-amber-400'
                          : 'bg-slate-50 dark:bg-slate-950'
                    }`}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
