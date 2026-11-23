import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  DAILY_FACTS,
  FACT_CATEGORIES,
  type FactCategory,
} from '../../features/entertainment/content-library';
import { GazeButton } from '../gaze/GazeButton';

export const FactsSection: React.FC = () => {
  const { settings } = useAppState();
  const [category, setCategory] = useState<FactCategory | 'All'>('All');
  const [idx, setIdx] = useState(0);

  const pool =
    category === 'All'
      ? DAILY_FACTS
      : DAILY_FACTS.filter((f) => f.category === category);

  const currentFact = pool[idx % Math.max(1, pool.length)] || DAILY_FACTS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <GazeButton
          gazeId="fact_cat_all"
          variant={category === 'All' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setCategory('All');
            setIdx(0);
          }}
        >
          <span>All Categories</span>
        </GazeButton>
        {FACT_CATEGORIES.map((cat) => (
          <GazeButton
            key={cat}
            gazeId={`fact_cat_${cat.replace(/\s+/g, '_')}`}
            variant={category === cat ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => {
              setCategory(cat);
              setIdx(0);
            }}
          >
            <span>{cat}</span>
          </GazeButton>
        ))}
      </div>

      {/* Single Fact Per Card */}
      <div className="rounded-2xl border-2 border-teal-600/70 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
            <Lightbulb className="w-4 h-4" />
            <span>{currentFact.category} Fact</span>
          </span>
          <span className="font-mono text-slate-500">
            {(idx % pool.length) + 1} of {pool.length}
          </span>
        </div>

        <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed">
          {currentFact.fact}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-2.5">
            <GazeButton
              gazeId="fact_prev"
              variant="subtle"
              sizeOverride="large"
              onClick={() => setIdx((i) => (i - 1 + pool.length) % pool.length)}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous</span>
            </GazeButton>
            <GazeButton
              gazeId="fact_next"
              variant="primary"
              sizeOverride="large"
              onClick={() => setIdx((i) => (i + 1) % pool.length)}
            >
              <span>Next Fact</span>
              <ChevronRight className="w-5 h-5" />
            </GazeButton>
          </div>

          <GazeButton
            gazeId="fact_speak"
            variant="default"
            sizeOverride="large"
            onClick={() =>
              speakText(currentFact.fact, {
                language: 'en',
                rate: settings.communication.speechRate,
              })
            }
          >
            <Volume2 className="w-5 h-5" />
            <span>Read Aloud</span>
          </GazeButton>
        </div>
      </div>
    </div>
  );
};
