import React, { Suspense, useMemo, useState } from 'react';
import {
  Brain,
  CircleDot,
  Crown,
  Grid3X3,
  Hash,
  Puzzle,
  Sparkles,
  SpellCheck,
} from 'lucide-react';
import { useGames } from '../../context/GamesContext';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import type { GameCategoryId, GameId } from '../../types';
import type { AppRoute } from '../layout/AppShell';
import { GazeButton } from '../gaze/GazeButton';

const TicTacToeGame = React.lazy(() =>
  import('./TicTacToeGame').then((m) => ({ default: m.TicTacToeGame }))
);
const MemoryMatchGame = React.lazy(() =>
  import('./MemoryMatchGame').then((m) => ({ default: m.MemoryMatchGame }))
);
const PicturePuzzleGame = React.lazy(() =>
  import('./PicturePuzzleGame').then((m) => ({ default: m.PicturePuzzleGame }))
);
const WordGuessGame = React.lazy(() =>
  import('./WordGuessGame').then((m) => ({ default: m.WordGuessGame }))
);
const NumberPatternGame = React.lazy(() =>
  import('./NumberPatternGame').then((m) => ({ default: m.NumberPatternGame }))
);
const ConnectFourGame = React.lazy(() =>
  import('./ConnectFourGame').then((m) => ({ default: m.ConnectFourGame }))
);
const ChessGame = React.lazy(() =>
  import('./ChessGame').then((m) => ({ default: m.ChessGame }))
);

interface GameCatalogItem {
  id: GameId;
  category: GameCategoryId;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
}

const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'tic-tac-toe',
    category: 'board',
    title: 'Tic-Tac-Toe',
    subtitle: '3×3 classic board against Computer (Easy/Hard) or Two Players.',
    badge: 'Board · 2P / Computer',
    icon: <Grid3X3 className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'memory-match',
    category: 'memory',
    title: 'Memory Match',
    subtitle: 'Flip and match Animals, Fruits, Everyday Objects, or personal photos.',
    badge: 'Memory · Multi-Level',
    icon: <Brain className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'picture-puzzle',
    category: 'puzzle',
    title: 'Picture Puzzle',
    subtitle: '3×3 and 4×4 sliding puzzles with preview, shuffle, and custom photos.',
    badge: 'Puzzle · 3×3 / 4×4',
    icon: <Puzzle className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'word-guess',
    category: 'word',
    title: 'Word Guess',
    subtitle: 'Guess simple everyday words using picture clues in English or Hindi.',
    badge: 'Words · EN / हिंदी',
    icon: <SpellCheck className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'pattern-sequence',
    category: 'logic',
    title: 'Number & Pattern Game',
    subtitle: 'Complete number sequences, missing numbers, shapes, and visual patterns.',
    badge: 'Logic · Sequences',
    icon: <Hash className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'connect-four',
    category: 'board',
    title: 'Connect Four',
    subtitle: 'Drop discs into columns to line up four in a row vs Computer or a friend.',
    badge: 'Strategy · 2P / AI',
    icon: <CircleDot className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
  {
    id: 'chess',
    category: 'board',
    title: 'Chess & Puzzles',
    subtitle: 'Full FIDE chess with select-then-destination moves and beginner checkmate puzzles.',
    badge: 'Classic Board',
    icon: <Crown className="w-6 h-6 text-teal-700 dark:text-teal-400" />,
  },
];

interface GamesDashboardProps {
  onNavigate: (route: AppRoute) => void;
}

export const GamesDashboard: React.FC<GamesDashboardProps> = ({ onNavigate }) => {
  const { gamesState, setPreferredDifficulty } = useGames();
  const { hubPrefs } = useHubPreferences();
  const [activeGameId, setActiveGameId] = useState<GameId | null>(null);

  const visibleGames = useMemo(() => {
    const enabled = GAME_CATALOG.filter((g) => !hubPrefs.disabledGameIds.includes(g.id));
    // Sort patient favourite categories first cleanly
    return [...enabled].sort((a, b) => {
      const aFav = hubPrefs.favoriteGameCategories.includes(a.category) ? 0 : 1;
      const bFav = hubPrefs.favoriteGameCategories.includes(b.category) ? 0 : 1;
      return aFav - bFav;
    });
  }, [hubPrefs.disabledGameIds, hubPrefs.favoriteGameCategories]);

  if (activeGameId) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <Suspense
          fallback={
            <div className="py-16 text-center text-sm font-medium text-slate-500">
              Loading game board...
            </div>
          }
        >
          {activeGameId === 'tic-tac-toe' && (
            <TicTacToeGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'memory-match' && (
            <MemoryMatchGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'picture-puzzle' && (
            <PicturePuzzleGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'word-guess' && (
            <WordGuessGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'pattern-sequence' && (
            <NumberPatternGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'connect-four' && (
            <ConnectFourGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
          {activeGameId === 'chess' && (
            <ChessGame onBackToLibrary={() => setActiveGameId(null)} />
          )}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default Difficulty + Personalization Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Default Difficulty:
          </span>
          {(['easy', 'medium', 'hard'] as const).map((lvl) => (
            <GazeButton
              key={lvl}
              gazeId={`games_pref_diff_${lvl}`}
              sizeOverride="standard"
              variant={gamesState.preferredDifficulty === lvl ? 'primary' : 'default'}
              onClick={() => setPreferredDifficulty(lvl)}
            >
              <span className="capitalize">{lvl}</span>
            </GazeButton>
          ))}
        </div>

        <GazeButton
          gazeId="games_open_profile_prefs"
          variant="subtle"
          sizeOverride="standard"
          onClick={() => onNavigate('profile')}
        >
          <Sparkles className="w-4 h-4" />
          <span>Personalize Categories</span>
        </GazeButton>
      </div>

      {/* Games Cards Grid (Zero colored hover highlights on gaze targets) */}
      {visibleGames.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
          <p className="text-sm font-semibold">All games are currently hidden in your profile preferences.</p>
          <GazeButton
            gazeId="games_restore_profile"
            variant="primary"
            onClick={() => onNavigate('profile')}
          >
            <span>Enable Games in My Profile</span>
          </GazeButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleGames.map((game) => {
            const score = gamesState.scores[game.id];
            const isFav = hubPrefs.favoriteGameCategories.includes(game.category);
            return (
              <div
                key={game.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
                      {game.icon}
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {isFav && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold">
                          Recommended
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        {game.badge}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {game.subtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Played: {score?.gamesPlayed ?? 0} · Wins: {score?.wins ?? 0} · Solved:{' '}
                    {score?.puzzlesSolved ?? 0}
                  </p>
                  <GazeButton
                    gazeId={`games_launch_${game.id}`}
                    gazeLabel={`Play ${game.title}`}
                    variant="primary"
                    sizeOverride="large"
                    onClick={() => setActiveGameId(game.id)}
                    className="w-full"
                  >
                    <span>Play {game.title}</span>
                  </GazeButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
