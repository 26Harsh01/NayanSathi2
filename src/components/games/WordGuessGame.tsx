import React, { useEffect, useState } from 'react';
import { Lightbulb, Pause, Play, RotateCcw, SkipForward, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  buildChoiceTilesForPrompt,
  ENGLISH_WORD_PROMPTS,
  evaluateWordGuess,
  HINDI_WORD_PROMPTS,
  type WordGuessPrompt,
} from '../../features/games/word-guess';
import type { Language } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

export const WordGuessGame: React.FC<{ onBackToLibrary: () => void }> = ({ onBackToLibrary }) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult } = useGames();

  const [wordLang, setWordLang] = useState<Language>(settings.communication.language);
  const [promptIdx, setPromptIdx] = useState(0);
  const [guessedTokens, setGuessedTokens] = useState<string[]>([]);
  const [showExtraHint, setShowExtraHint] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recorded, setRecorded] = useState(false);

  const prompts: WordGuessPrompt[] = wordLang === 'hi' ? HINDI_WORD_PROMPTS : ENGLISH_WORD_PROMPTS;
  const currentPrompt = prompts[promptIdx % prompts.length];
  const choiceTiles = buildChoiceTilesForPrompt(currentPrompt);
  const evalState = evaluateWordGuess(currentPrompt, guessedTokens, 6);

  const scores = gamesState.scores['word-guess'];

  useEffect(() => {
    if ((!evalState.isWon && !evalState.isLost) || recorded) return;
    setRecorded(true);
    const fullWord = currentPrompt.tokens.join('');
    recordGameResult({
      gameId: 'word-guess',
      outcome: evalState.isWon ? 'win' : 'loss',
      difficulty: currentPrompt.tokens.length >= 5 ? 'medium' : 'easy',
      moves: guessedTokens.length,
      puzzleSolved: evalState.isWon,
      summary: evalState.isWon
        ? `Guessed "${fullWord}" (${wordLang.toUpperCase()}) in ${guessedTokens.length} tries`
        : `Missed "${fullWord}" (${wordLang.toUpperCase()})`,
    });
  }, [currentPrompt, evalState.isLost, evalState.isWon, guessedTokens.length, recordGameResult, recorded, wordLang]);

  const startRound = (nextIdx: number, nextLang: Language = wordLang) => {
    setWordLang(nextLang);
    setPromptIdx(nextIdx);
    setGuessedTokens([]);
    setShowExtraHint(false);
    setPaused(false);
    setRecorded(false);
  };

  const handleSelectToken = (tok: string) => {
    if (paused || evalState.isWon || evalState.isLost || guessedTokens.includes(tok)) return;
    setGuessedTokens((prev) => [...prev, tok]);
  };

  const speakClue = () => {
    speakText(
      wordLang === 'hi'
        ? `शब्द पहचानें। संकेत: ${currentPrompt.clue}`
        : `Word Guess. Clue: ${currentPrompt.clue}`,
      {
        language: wordLang,
        rate: settings.communication.speechRate,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Word Guess</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Select letters or syllables below to uncover the everyday word in English or Hindi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="wg_audio_clue" sizeOverride="standard" onClick={speakClue}>
            <Volume2 className="w-4 h-4" />
            <span>Speak Clue</span>
          </GazeButton>
          <GazeButton
            gazeId="wg_pause"
            sizeOverride="standard"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="wg_restart"
            sizeOverride="standard"
            onClick={() => startRound(promptIdx, wordLang)}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Word</span>
          </GazeButton>
          <GazeButton
            gazeId="wg_next_word"
            variant="primary"
            sizeOverride="standard"
            onClick={() => startRound((promptIdx + 1) % prompts.length, wordLang)}
          >
            <SkipForward className="w-4 h-4" />
            <span>Next Word</span>
          </GazeButton>
          <GazeButton
            gazeId="wg_back"
            variant="subtle"
            sizeOverride="standard"
            onClick={onBackToLibrary}
          >
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Language Selector */}
      <div className="flex flex-wrap items-center gap-2.5">
        <GazeButton
          gazeId="wg_lang_en"
          variant={wordLang === 'en' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => startRound(0, 'en')}
        >
          <span>English Words</span>
        </GazeButton>
        <GazeButton
          gazeId="wg_lang_hi"
          variant={wordLang === 'hi' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => startRound(0, 'hi')}
        >
          <span>हिंदी शब्द (Hindi)</span>
        </GazeButton>
        <GazeButton
          gazeId="wg_hint"
          variant="subtle"
          sizeOverride="standard"
          onClick={() => setShowExtraHint((v) => !v)}
        >
          <Lightbulb className="w-4 h-4" />
          <span>{showExtraHint ? 'Hide Letter Hint' : 'Reveal 1st Letter'}</span>
        </GazeButton>
      </div>

      {/* Status Bar */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">
          {evalState.isWon
            ? `Well done! You guessed "${currentPrompt.tokens.join('')}"!`
            : evalState.isLost
              ? `The word was "${currentPrompt.tokens.join('')}". Try the next word anytime!`
              : `Category: ${currentPrompt.category} · ${evalState.remainingLetters} letter(s) left`}
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Tries Used: {evalState.mistakes}/{evalState.maxMistakes} · Words Won: {scores.wins}
        </span>
      </div>

      {paused ? (
        <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
          <p className="text-lg font-bold">Word Guess Paused</p>
          <GazeButton gazeId="wg_resume_center" variant="primary" onClick={() => setPaused(false)}>
            <Play className="w-4 h-4" />
            <span>Resume Game</span>
          </GazeButton>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Clue + Word Slots Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-5">
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl leading-none" aria-hidden="true">
                {currentPrompt.emoji}
              </span>
              <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                Clue: {currentPrompt.clue}
              </p>
              {showExtraHint && (
                <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                  First letter hint: {currentPrompt.tokens[0]}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {evalState.maskedWord.map((revealedTok, idx) => {
                const display =
                  revealedTok ?? (evalState.isLost ? currentPrompt.tokens[idx] : '_');
                const missedReveal = !revealedTok && evalState.isLost;
                return (
                  <div
                    key={idx}
                    className={`min-w-[54px] h-14 px-3 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${
                      missedReveal
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                        : revealedTok
                          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    {display}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Alphabet Selection Grid (No colored hover highlighting) */}
          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-9 gap-2.5">
            {choiceTiles.map((tok, idx) => {
              const chosen = guessedTokens.includes(tok);
              const inWord = currentPrompt.tokens.includes(tok);
              return (
                <GazeButton
                  key={`${tok}_${idx}`}
                  gazeId={`wg_key_${idx}`}
                  gazeLabel={`Letter ${tok}`}
                  sizeOverride="large"
                  disabled={chosen || evalState.isWon || evalState.isLost}
                  variant={
                    chosen ? (inWord ? 'primary' : 'subtle') : 'default'
                  }
                  onClick={() => handleSelectToken(tok)}
                  className="text-lg font-bold"
                >
                  <span>{tok}</span>
                </GazeButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
