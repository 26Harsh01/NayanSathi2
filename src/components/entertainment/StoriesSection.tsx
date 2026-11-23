import React, { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Square, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { speakText, stopSpeech } from '../../features/communication/text-to-speech';
import {
  SHORT_STORIES,
  STORY_CATEGORIES,
  type StoryCategory,
} from '../../features/entertainment/content-library';
import type { Language } from '../../types';
import { GazeButton } from '../gaze/GazeButton';

export const StoriesSection: React.FC = () => {
  const { settings } = useAppState();
  const [storyLang, setStoryLang] = useState<Language>(settings.communication.language);
  const [category, setCategory] = useState<StoryCategory | 'All'>('All');
  const [idx, setIdx] = useState(0);
  const [isReading, setIsReading] = useState(false);

  const pool = SHORT_STORIES.filter(
    (s) => s.language === storyLang && (category === 'All' || s.category === category)
  );
  const fallbackPool = SHORT_STORIES.filter((s) => s.language === storyLang);
  const effectivePool = pool.length > 0 ? pool : fallbackPool;
  const story = effectivePool[idx % effectivePool.length] || SHORT_STORIES[0];

  const handleReadAloud = () => {
    setIsReading(true);
    speakText(`${story.title}. ${story.body}. ${story.takeaway}`, {
      language: story.language,
      rate: settings.communication.speechRate,
      onEnd: () => setIsReading(false),
      onError: () => setIsReading(false),
    });
  };

  const handleStopReading = () => {
    stopSpeech();
    setIsReading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <GazeButton
          gazeId="story_lang_en"
          variant={storyLang === 'en' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setStoryLang('en');
            setCategory('All');
            setIdx(0);
            handleStopReading();
          }}
        >
          <span>English Stories</span>
        </GazeButton>
        <GazeButton
          gazeId="story_lang_hi"
          variant={storyLang === 'hi' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setStoryLang('hi');
            setCategory('All');
            setIdx(0);
            handleStopReading();
          }}
        >
          <span>हिंदी कहानियाँ (Hindi)</span>
        </GazeButton>

        <div className="flex flex-wrap gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          <GazeButton
            gazeId="story_cat_all"
            variant={category === 'All' ? 'primary' : 'default'}
            sizeOverride="standard"
            onClick={() => {
              setCategory('All');
              setIdx(0);
            }}
          >
            <span>All</span>
          </GazeButton>
          {STORY_CATEGORIES.map((cat) => (
            <GazeButton
              key={cat}
              gazeId={`story_cat_${cat}`}
              variant={category === cat ? 'primary' : 'default'}
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
      </div>

      <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase text-teal-700 dark:text-teal-400">
            <BookOpen className="w-4 h-4" />
            <span>{story.category} Story</span>
          </span>
          <span className="font-mono text-slate-500">
            Story {(idx % effectivePool.length) + 1} of {effectivePool.length}
          </span>
        </div>

        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{story.title}</h3>

        <p className="text-lg sm:text-xl text-slate-700 dark:text-slate-200 leading-relaxed">
          {story.body}
        </p>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200">
          {story.takeaway}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-2.5">
            <GazeButton
              gazeId="story_prev"
              variant="subtle"
              sizeOverride="large"
              onClick={() => {
                handleStopReading();
                setIdx((i) => (i - 1 + effectivePool.length) % effectivePool.length);
              }}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous Story</span>
            </GazeButton>
            <GazeButton
              gazeId="story_next"
              variant="primary"
              sizeOverride="large"
              onClick={() => {
                handleStopReading();
                setIdx((i) => (i + 1) % effectivePool.length);
              }}
            >
              <span>Next Story</span>
              <ChevronRight className="w-5 h-5" />
            </GazeButton>
          </div>

          <div className="flex gap-2">
            <GazeButton
              gazeId="story_read_aloud"
              variant="default"
              sizeOverride="large"
              onClick={handleReadAloud}
            >
              <Volume2 className="w-5 h-5" />
              <span>Read Aloud</span>
            </GazeButton>
            {isReading && (
              <GazeButton
                gazeId="story_stop_read"
                variant="danger"
                sizeOverride="large"
                onClick={handleStopReading}
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </GazeButton>
            )}
          </div>
        </div>
      </article>
    </div>
  );
};
