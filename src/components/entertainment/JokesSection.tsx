import React, { useState } from 'react';
import { ChevronRight, Eye, Laugh, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { speakText } from '../../features/communication/text-to-speech';
import { DAILY_JOKES } from '../../features/entertainment/content-library';
import type { Language } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

export const JokesSection: React.FC = () => {
  const { settings } = useAppState();
  const [jokeLang, setJokeLang] = useState<Language>(settings.communication.language);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);

  const pool = DAILY_JOKES.filter((j) => j.language === jokeLang);
  const current = pool[idx % pool.length] || DAILY_JOKES[0];

  const handleSpeakJoke = () => {
    const text = current.punchline ? `${current.setup} ... ${current.punchline}` : current.setup;
    speakText(text, {
      language: jokeLang,
      rate: settings.communication.speechRate,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <GazeButton
          gazeId="joke_lang_en"
          variant={jokeLang === 'en' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setJokeLang('en');
            setIdx(0);
          }}
        >
          <span>English Jokes</span>
        </GazeButton>
        <GazeButton
          gazeId="joke_lang_hi"
          variant={jokeLang === 'hi' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setJokeLang('hi');
            setIdx(0);
          }}
        >
          <span>हिंदी चुटकुले (Hindi)</span>
        </GazeButton>
      </div>

      <div className="rounded-2xl border-2 border-teal-600/70 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase text-teal-700 dark:text-teal-400">
            <Laugh className="w-4 h-4" />
            <span>{current.type === 'qa' ? 'Q & A Joke' : 'Short Smile'}</span>
          </span>
          <span className="font-mono text-slate-500">
            {(idx % pool.length) + 1} / {pool.length}
          </span>
        </div>

        <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
          {current.setup}
        </p>

        {current.punchline && (
          <div>
            {showAnswer ? (
              <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800">
                <p className="text-lg font-semibold text-teal-900 dark:text-teal-200">
                  {current.punchline}
                </p>
              </div>
            ) : (
              <GazeButton
                gazeId="joke_reveal"
                variant="subtle"
                sizeOverride="large"
                onClick={() => setShowAnswer(true)}
              >
                <Eye className="w-4 h-4" />
                <span>Show Punchline</span>
              </GazeButton>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <GazeButton
            gazeId="joke_speak"
            variant="default"
            sizeOverride="large"
            onClick={handleSpeakJoke}
          >
            <Volume2 className="w-5 h-5" />
            <span>Speak Joke</span>
          </GazeButton>

          <GazeButton
            gazeId="joke_next"
            variant="primary"
            sizeOverride="large"
            onClick={() => setIdx((i) => (i + 1) % pool.length)}
          >
            <span>Next Joke</span>
            <ChevronRight className="w-5 h-5" />
          </GazeButton>
        </div>
      </div>
    </div>
  );
};
