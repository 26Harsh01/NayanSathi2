import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Undo2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  chooseTicTacToeAIMove,
  evaluateTicTacToe,
  type TicTacToeCell,
  type TicTacToeMark,
} from '../../features/games/tic-tac-toe';
import { GazeButton } from '../gaze/GazeButton';
import type { GameDifficulty } from '../../types';

export const TicTacToeGame: React.FC<{ onBackToLibrary: () => void }> = ({ onBackToLibrary }) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult } = useGames();

  const [mode, setMode] = useState<'pvc' | 'pvp'>('pvc');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(gamesState.preferredDifficulty);
  const [board, setBoard] = useState<TicTacToeCell[]>(Array(9).fill(null));
  const [history, setHistory] = useState<TicTacToeCell[][]>([]);
  const [turn, setTurn] = useState<TicTacToeMark>('X');
  const [paused, setPaused] = useState(false);
  const [confirmedNote, setConfirmedNote] = useState<string>(
    'Select any empty square by gaze dwell, click, or keyboard.'
  );
  const [resultRecorded, setResultRecorded] = useState(false);

  const evalResult = evaluateTicTacToe(board);
  const gameOver = Boolean(evalResult.winner || evalResult.isDraw);
  const scores = gamesState.scores['tic-tac-toe'];

  const readInstructions = () => {
    speakText(
      'Tic Tac Toe. Choose Player versus Computer or Two Players. Look at or select any empty square to place your mark. First to get three in a row wins.',
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  useEffect(() => {
    if (!gameOver || resultRecorded) return;
    setResultRecorded(true);
    const moves = board.filter(Boolean).length;
    if (evalResult.winner === 'X') {
      setConfirmedNote(mode === 'pvc' ? 'You won! (X wins)' : 'Player X wins!');
      recordGameResult({
        gameId: 'tic-tac-toe',
        outcome: 'win',
        difficulty,
        moves,
        summary: mode === 'pvc' ? `Won vs Computer (${difficulty})` : 'Player X won (2P)',
      });
    } else if (evalResult.winner === 'O') {
      setConfirmedNote(mode === 'pvc' ? 'Computer (O) won.' : 'Player O wins!');
      recordGameResult({
        gameId: 'tic-tac-toe',
        outcome: mode === 'pvc' ? 'loss' : 'win',
        difficulty,
        moves,
        summary: mode === 'pvc' ? `Computer won (${difficulty})` : 'Player O won (2P)',
      });
    } else if (evalResult.isDraw) {
      setConfirmedNote('Game ended in a draw.');
      recordGameResult({
        gameId: 'tic-tac-toe',
        outcome: 'draw',
        difficulty,
        moves,
        summary: 'Draw',
      });
    }
  }, [board, difficulty, evalResult.isDraw, evalResult.winner, gameOver, mode, recordGameResult, resultRecorded]);

  useEffect(() => {
    if (mode !== 'pvc' || turn !== 'O' || gameOver || paused) return;
    const timer = window.setTimeout(() => {
      const aiIdx = chooseTicTacToeAIMove(board, 'O', difficulty);
      if (aiIdx === null) return;
      setHistory((prev) => [...prev, board]);
      setBoard((prev) => {
        const next = [...prev];
        next[aiIdx] = 'O';
        return next;
      });
      setTurn('X');
      setConfirmedNote(`Computer placed O on square ${aiIdx + 1}. Your turn (X).`);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [board, difficulty, gameOver, mode, paused, turn]);

  const handleCellSelect = (idx: number) => {
    if (paused || gameOver || board[idx] !== null) return;
    if (mode === 'pvc' && turn !== 'X') return;

    const currentMark = turn;
    setHistory((prev) => [...prev, board]);
    const next = [...board];
    next[idx] = currentMark;
    setBoard(next);
    setConfirmedNote(`Selected square ${idx + 1} (${currentMark}).`);

    if (mode === 'pvp') {
      setTurn(currentMark === 'X' ? 'O' : 'X');
    } else {
      setTurn('O');
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || paused) return;
    // In PvC, undo back to player's last turn (2 plies if computer already replied)
    const stepsBack = mode === 'pvc' && turn === 'X' && history.length >= 2 ? 2 : 1;
    const targetIdx = Math.max(0, history.length - stepsBack);
    setBoard(history[targetIdx]);
    setHistory(history.slice(0, targetIdx));
    setTurn(mode === 'pvc' ? 'X' : targetIdx % 2 === 0 ? 'X' : 'O');
    setResultRecorded(false);
    setConfirmedNote('Last move undone.');
  };

  const handleRestart = () => {
    setBoard(Array(9).fill(null));
    setHistory([]);
    setTurn('X');
    setPaused(false);
    setResultRecorded(false);
    setConfirmedNote('New Tic-Tac-Toe game ready. Player X starts.');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tic-Tac-Toe</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Select any empty cell via gaze dwell, keyboard, switch, or mouse.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="ttt_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton
            gazeId="ttt_pause"
            sizeOverride="standard"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="ttt_undo"
            sizeOverride="standard"
            disabled={history.length === 0 || paused}
            onClick={handleUndo}
          >
            <Undo2 className="w-4 h-4" />
            <span>Undo</span>
          </GazeButton>
          <GazeButton gazeId="ttt_restart" sizeOverride="standard" onClick={handleRestart}>
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton gazeId="ttt_back" variant="subtle" sizeOverride="standard" onClick={onBackToLibrary}>
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Mode & Difficulty selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <GazeButton
          gazeId="ttt_mode_pvc"
          variant={mode === 'pvc' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setMode('pvc');
            handleRestart();
          }}
        >
          <span>vs Computer</span>
        </GazeButton>
        <GazeButton
          gazeId="ttt_mode_pvp"
          variant={mode === 'pvp' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setMode('pvp');
            handleRestart();
          }}
        >
          <span>Two Players</span>
        </GazeButton>

        {mode === 'pvc' && (
          <div className="flex flex-wrap gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((lvl) => (
              <GazeButton
                key={lvl}
                gazeId={`ttt_diff_${lvl}`}
                variant={difficulty === lvl ? 'primary' : 'default'}
                sizeOverride="standard"
                onClick={() => {
                  setDifficulty(lvl);
                  handleRestart();
                }}
              >
                <span className="capitalize">{lvl === 'hard' ? 'Hard (Minimax)' : lvl}</span>
              </GazeButton>
            ))}
          </div>
        )}
      </div>

      {/* Separate Selection Confirmation & Status Banner */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{confirmedNote}</span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Turn: {gameOver ? 'Finished' : turn} · Record: {scores.wins}W / {scores.losses}L / {scores.draws}D
        </span>
      </div>

      {/* 3x3 Board — Static white cell backgrounds with zero colored hover highlights */}
      <div className="max-w-md mx-auto">
        {paused ? (
          <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
            <p className="text-lg font-bold">Game Paused</p>
            <GazeButton gazeId="ttt_resume_center" variant="primary" onClick={() => setPaused(false)}>
              <Play className="w-4 h-4" />
              <span>Resume Game</span>
            </GazeButton>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3" role="grid" aria-label="Tic Tac Toe Board">
            {board.map((cell, idx) => {
              const isWinCell = evalResult.line?.includes(idx) ?? false;
              return (
                <button
                  key={idx}
                  type="button"
                  data-gaze-target={`ttt_cell_${idx}`}
                  data-gaze-label={`Square ${idx + 1}${cell ? ` ${cell}` : ''}`}
                  disabled={cell !== null || gameOver}
                  onClick={() => handleCellSelect(idx)}
                  aria-label={`Square ${idx + 1}, ${cell || 'empty'}`}
                  className={`min-h-[96px] sm:min-h-[112px] rounded-2xl border-2 text-3xl sm:text-4xl font-bold flex items-center justify-center cursor-pointer disabled:cursor-default ${
                    isWinCell
                      ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-700 text-teal-800 dark:text-teal-300'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                  }`}
                >
                  {cell ?? <span className="text-xs font-normal text-slate-400">{idx + 1}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
