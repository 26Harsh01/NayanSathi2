import React, { useState } from 'react';
import { CheckCircle2, HelpCircle, SkipForward, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { speakText } from '../../features/communication/text-to-speech';
import { QUIZ_QUESTIONS } from '../../features/entertainment/content-library';
import { GazeButton } from '../gaze/GazeButton';

export const QuizSection: React.FC = () => {
  const { settings } = useAppState();
  const [idx, setIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const q = QUIZ_QUESTIONS[idx % QUIZ_QUESTIONS.length];

  const handleSelect = (optIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optIdx);
    if (optIdx === q.correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    setIdx((i) => (i + 1) % QUIZ_QUESTIONS.length);
    setSelectedOption(null);
  };

  const isCorrect = selectedOption === q.correctIndex;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase text-teal-700 dark:text-teal-400">
            <HelpCircle className="w-4 h-4" />
            <span>{q.kind === 'riddle' ? 'Brain Riddle' : 'Fun Trivia Quiz'}</span>
          </span>
          <span className="font-mono text-slate-500">
            Question {(idx % QUIZ_QUESTIONS.length) + 1}/{QUIZ_QUESTIONS.length} · Score: {score}
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
          {q.question}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {q.options.map((opt, optIdx) => {
            const isChosen = selectedOption === optIdx;
            const isRight = optIdx === q.correctIndex;
            return (
              <GazeButton
                key={opt}
                gazeId={`quiz_opt_${optIdx}`}
                sizeOverride="large"
                disabled={selectedOption !== null}
                variant={
                  selectedOption === null
                    ? 'default'
                    : isRight
                      ? 'primary'
                      : isChosen
                        ? 'danger'
                        : 'subtle'
                }
                onClick={() => handleSelect(optIdx)}
                className="justify-start text-left"
              >
                <span className="font-mono opacity-75">{optIdx + 1}.</span>
                <span>{opt}</span>
              </GazeButton>
            );
          })}
        </div>

        {selectedOption !== null && (
          <div
            className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isCorrect
                ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>
                {isCorrect ? 'Correct! ' : 'Good attempt! '}
                {q.explanation}
              </span>
            </div>
            <GazeButton
              gazeId="quiz_next"
              variant="primary"
              sizeOverride="standard"
              onClick={handleNext}
            >
              <SkipForward className="w-4 h-4" />
              <span>Next Question</span>
            </GazeButton>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <GazeButton
            gazeId="quiz_speak"
            variant="subtle"
            sizeOverride="standard"
            onClick={() =>
              speakText(`${q.question}. Options: ${q.options.join(', ')}`, {
                language: 'en',
                rate: settings.communication.speechRate,
              })
            }
          >
            <Volume2 className="w-4 h-4" />
            <span>Read Question</span>
          </GazeButton>

          {selectedOption === null && (
            <GazeButton
              gazeId="quiz_skip"
              variant="default"
              sizeOverride="standard"
              onClick={handleNext}
            >
              <SkipForward className="w-4 h-4" />
              <span>Skip Question</span>
            </GazeButton>
          )}
        </div>
      </div>
    </div>
  );
};
