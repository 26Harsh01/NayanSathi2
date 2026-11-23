import React, { useState } from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, SkipForward, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  generatePatternChallenge,
  type PatternChallenge,
  type PatternGameMode,
  type PatternToken,
} from '../../features/games/pattern-sequence';
import type { GameDifficulty } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

const MODE_LABELS: { id: PatternGameMode; label: string }[] = [
  { id: 'numbers', label: 'Number Sequences' },
  { id: 'missing_object', label: 'Find Missing Item' },
  { id: 'shapes', label: 'Next Shape' },
  { id: 'colours', label: 'Colour Patterns' },
  { id: 'picture_match', label: 'Picture Match' },
];

const OBJECT_EMOJI: Record<string, string> = {
  sun: '☀️',
  moon: '🌙',
  leaf: '🌿',
  cup: '☕',
  book: '📖',
  key: '🔑',
};

const TokenVisual: React.FC<{ token: PatternToken }> = ({ token }) => {
  if (token.kind === 'shape') {
    const color = token.colorHex || '#0f766e';
    return (
      <div className="flex flex-col items-center gap-1">
        <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true">
          {token.shapeName === 'circle' && <circle cx="20" cy="20" r="14" fill={color} />}
          {token.shapeName === 'square' && <rect x="6" y="6" width="28" height="28" rx="4" fill={color} />}
          {token.shapeName === 'triangle' && <polygon points="20,5 35,34 5,34" fill={color} />}
          {token.shapeName === 'diamond' && <polygon points="20,4 36,20 20,36 4,20" fill={color} />}
          {token.shapeName === 'star' && (
            <polygon
              points="20,4 24.8,14.2 36,15.6 27.8,23.3 29.9,34.4 20,29 10.1,34.4 12.2,23.3 4,15.6 15.2,14.2"
              fill={color}
            />
          )}
        </svg>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{token.label}</span>
      </div>
    );
  }

  if (token.kind === 'colour') {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-600 inline-block"
          style={{ backgroundColor: token.colorHex || '#0d9488' }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{token.label}</span>
      </div>
    );
  }

  if (token.kind === 'object') {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl leading-none" aria-hidden="true">
          {OBJECT_EMOJI[token.objectKey || 'sun'] || '⭐'}
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{token.label}</span>
      </div>
    );
  }

  return (
    <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
      {token.label}
    </span>
  );
};

export const NumberPatternGame: React.FC<{ onBackToLibrary: () => void }> = ({
  onBackToLibrary,
}) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult } = useGames();

  const [mode, setMode] = useState<PatternGameMode>('numbers');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(gamesState.preferredDifficulty);
  const [challenge, setChallenge] = useState<PatternChallenge>(() =>
    generatePatternChallenge('numbers', gamesState.preferredDifficulty)
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [sessionSolved, setSessionSolved] = useState(0);

  const loadNewChallenge = (nextMode: PatternGameMode = mode, nextDiff: GameDifficulty = difficulty) => {
    setMode(nextMode);
    setDifficulty(nextDiff);
    setChallenge(generatePatternChallenge(nextMode, nextDiff));
    setSelectedOptionId(null);
    setPaused(false);
  };

  const handleChooseOption = (opt: PatternToken) => {
    if (paused || selectedOptionId !== null) return;
    setSelectedOptionId(opt.id);
    const isCorrect = opt.id === challenge.correctOptionId;
    if (isCorrect) {
      setSessionSolved((s) => s + 1);
      recordGameResult({
        gameId: 'pattern-sequence',
        outcome: 'completed',
        difficulty,
        moves: 1,
        puzzleSolved: true,
        summary: `Solved ${mode} pattern (${difficulty})`,
      });
    } else {
      recordGameResult({
        gameId: 'pattern-sequence',
        outcome: 'loss',
        difficulty,
        moves: 1,
        summary: `Practised ${mode} pattern (${difficulty})`,
      });
    }
  };

  const readInstructions = () => {
    speakText(
      `Number and Pattern Game. ${challenge.prompt} Select the matching answer tile below.`,
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  const answeredCorrectly =
    selectedOptionId !== null && selectedOptionId === challenge.correctOptionId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Number & Pattern Game
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Explore number sequences, missing values, next shapes, and visual patterns at your pace.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="pat_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton gazeId="pat_pause" sizeOverride="standard" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="pat_restart"
            sizeOverride="standard"
            onClick={() => {
              setSessionSolved(0);
              loadNewChallenge(mode, difficulty);
            }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton
            gazeId="pat_next"
            variant="primary"
            sizeOverride="standard"
            onClick={() => loadNewChallenge(mode, difficulty)}
          >
            <SkipForward className="w-4 h-4" />
            <span>Next Puzzle</span>
          </GazeButton>
          <GazeButton
            gazeId="pat_back"
            variant="subtle"
            sizeOverride="standard"
            onClick={onBackToLibrary}
          >
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Mode & Difficulty Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {MODE_LABELS.map((m) => (
          <GazeButton
            key={m.id}
            gazeId={`pat_mode_${m.id}`}
            variant={mode === m.id ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => loadNewChallenge(m.id, difficulty)}
          >
            <span>{m.label}</span>
          </GazeButton>
        ))}

        <div className="flex gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((lvl) => (
            <GazeButton
              key={lvl}
              gazeId={`pat_diff_${lvl}`}
              variant={difficulty === lvl ? 'primary' : 'default'}
              sizeOverride="standard"
              onClick={() => loadNewChallenge(mode, lvl)}
            >
              <span className="capitalize">{lvl}</span>
            </GazeButton>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{challenge.prompt}</span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Session Solved: {sessionSolved} · Total Solved:{' '}
          {gamesState.scores['pattern-sequence'].puzzlesSolved}
        </span>
      </div>

      {paused ? (
        <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
          <p className="text-lg font-bold">Pattern Game Paused</p>
          <GazeButton gazeId="pat_resume_center" variant="primary" onClick={() => setPaused(false)}>
            <Play className="w-4 h-4" />
            <span>Resume Game</span>
          </GazeButton>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sequence Display */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            {challenge.target ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Picture
                </p>
                <div className="p-5 rounded-2xl border-2 border-teal-700 bg-teal-50/40 dark:bg-teal-950/40">
                  <TokenVisual token={challenge.target} />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {challenge.sequence.map((tok, idx) => {
                  const isQuestion = tok.id === 'missing_slot';
                  return (
                    <div
                      key={`${tok.id}_${idx}`}
                      className={`min-w-[72px] min-h-[72px] px-4 py-3 rounded-2xl border-2 flex items-center justify-center ${
                        isQuestion
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/40'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
                      }`}
                    >
                      <TokenVisual token={tok} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-2xl mx-auto">
            {challenge.options.map((opt, idx) => {
              const isChosen = selectedOptionId === opt.id;
              const isRightOption = opt.id === challenge.correctOptionId;
              return (
                <GazeButton
                  key={opt.id}
                  gazeId={`pat_opt_${idx}`}
                  gazeLabel={opt.label}
                  sizeOverride="xlarge"
                  disabled={selectedOptionId !== null}
                  variant={
                    selectedOptionId === null
                      ? 'default'
                      : isRightOption
                        ? 'primary'
                        : isChosen
                          ? 'danger'
                          : 'subtle'
                  }
                  onClick={() => handleChooseOption(opt)}
                  className="min-h-[96px]"
                >
                  <TokenVisual token={opt} />
                </GazeButton>
              );
            })}
          </div>

          {/* Feedback + Explanation */}
          {selectedOptionId !== null && (
            <div
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                answeredCorrectly
                  ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  {answeredCorrectly ? 'Great job! ' : 'Nice try! '}
                  {challenge.explanation}
                </span>
              </div>
              <GazeButton
                gazeId="pat_feedback_next"
                variant="primary"
                sizeOverride="standard"
                onClick={() => loadNewChallenge(mode, difficulty)}
              >
                <SkipForward className="w-4 h-4" />
                <span>Try Next Pattern</span>
              </GazeButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
