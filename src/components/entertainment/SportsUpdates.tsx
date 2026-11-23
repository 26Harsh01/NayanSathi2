import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Trophy } from 'lucide-react';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import type { SportCategoryId } from '../../types';
import { GazeButton } from '../gaze/GazeButton';
import { getSafeArticleHref } from '../news/NewsCard';

interface SportsUpdateItem {
  id: string;
  sport: SportCategoryId;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
}

const SPORT_TABS: { id: 'all' | SportCategoryId; label: string }[] = [
  { id: 'all', label: 'All Sports' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'football', label: 'Football' },
  { id: 'badminton', label: 'Badminton' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'other', label: 'Other Sports' },
];

export const SportsUpdates: React.FC = () => {
  const { hubPrefs } = useHubPreferences();
  const [selectedSport, setSelectedSport] = useState<'all' | SportCategoryId>(
    () => hubPrefs.favoriteSports[0] || 'all'
  );
  const [updates, setUpdates] = useState<SportsUpdateItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<'rss' | 'unavailable'>('rss');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSports = useCallback(async (sport: 'all' | SportCategoryId, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport });
      if (refresh) params.set('refresh', '1');
      const resp = await fetch(`/api/entertainment/sports?${params.toString()}`);
      if (!resp.ok) throw new Error(`Sports feed returned HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        mode?: 'rss' | 'unavailable';
        notice?: string;
        updates?: SportsUpdateItem[];
      };
      setUpdates(Array.isArray(data.updates) ? data.updates : []);
      setMode(data.mode || 'unavailable');
      setNotice(data.notice || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch sports updates.');
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSports(selectedSport, false);
  }, [loadSports, selectedSport]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SPORT_TABS.map((sp) => {
            const isFav =
              sp.id !== 'all' && hubPrefs.favoriteSports.includes(sp.id as SportCategoryId);
            return (
              <GazeButton
                key={sp.id}
                gazeId={`sport_tab_${sp.id}`}
                variant={selectedSport === sp.id ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => setSelectedSport(sp.id)}
              >
                <span>
                  {sp.label}
                  {isFav ? ' ★' : ''}
                </span>
              </GazeButton>
            );
          })}
        </div>

        <GazeButton
          gazeId="sport_refresh"
          variant="subtle"
          sizeOverride="standard"
          disabled={loading}
          onClick={() => void loadSports(selectedSport, true)}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </GazeButton>
      </div>

      {notice && !error && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            mode === 'unavailable'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              : 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
          }`}
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          Loading sports headlines...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          <GazeButton
            gazeId="sport_retry"
            variant="primary"
            sizeOverride="standard"
            onClick={() => void loadSports(selectedSport, true)}
          >
            <span>Try Again</span>
          </GazeButton>
        </div>
      ) : updates.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
          <Trophy className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No live sports updates available for this category right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {updates.map((u) => {
            const safeHref = getSafeArticleHref(u.url);
            return (
              <div
                key={u.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold uppercase text-teal-700 dark:text-teal-400">
                      {u.sport} · {u.source}
                    </span>
                    <span className="tabular-nums">
                      {Date.parse(u.publishedAt)
                        ? new Date(u.publishedAt).toLocaleDateString()
                        : u.publishedAt}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {u.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {u.summary}
                  </p>
                </div>

                {safeHref && (
                  <div className="pt-2">
                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-gaze-target={`sport_link_${u.id}`}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>Read Story</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
