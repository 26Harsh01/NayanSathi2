import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Sparkles } from 'lucide-react';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import type { NewsCategoryId } from '../../types';
import type { AppRoute } from '../layout/AppShell';
import { GazeButton } from '../gaze/GazeButton';
import { NewsCard, type NewsArticleItem } from './NewsCard';

const NEWS_CATEGORIES: { id: NewsCategoryId; label: string }[] = [
  { id: 'top', label: 'Top Headlines' },
  { id: 'india', label: 'India' },
  { id: 'world', label: 'World' },
  { id: 'technology', label: 'Technology' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
  { id: 'health', label: 'Health & Wellness' },
  { id: 'education', label: 'Education' },
];

interface NewsApiResponse {
  ok?: boolean;
  mode?: 'live' | 'rss' | 'demo';
  isLive?: boolean;
  notice?: string;
  cachedAt?: string;
  articles?: NewsArticleItem[];
}

export const NewsDashboard: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { hubPrefs } = useHubPreferences();

  const visibleCategories = useMemo(() => {
    const enabled = NEWS_CATEGORIES.filter(
      (c) => !hubPrefs.disabledNewsCategories.includes(c.id)
    );
    return [...enabled].sort((a, b) => {
      const aFav = hubPrefs.favoriteNewsCategories.includes(a.id) ? 0 : 1;
      const bFav = hubPrefs.favoriteNewsCategories.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [hubPrefs.disabledNewsCategories, hubPrefs.favoriteNewsCategories]);

  const [category, setCategory] = useState<NewsCategoryId>(
    () => visibleCategories[0]?.id || 'top'
  );
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [articles, setArticles] = useState<NewsArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'live' | 'rss' | 'demo'>('rss');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchNews = useCallback(
    async (cat: NewsCategoryId, q: string, forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category: cat });
        if (q.trim()) params.set('q', q.trim());
        if (forceRefresh) params.set('refresh', '1');

        const resp = await fetch(`/api/news?${params.toString()}`);
        if (!resp.ok) {
          throw new Error(`News service returned HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as NewsApiResponse;
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setSourceMode(data.mode || 'demo');
        setNotice(data.notice || null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load news headlines right now.'
        );
        setArticles([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchNews(category, activeSearch, false);
  }, [activeSearch, category, fetchNews]);

  return (
    <div className="space-y-6">
      {/* Search, Refresh & Profile Personalization */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveSearch(searchInput.trim());
          }}
          className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]"
        >
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search news headlines..."
              aria-label="Search news"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <GazeButton
            gazeId="news_search_btn"
            variant="primary"
            sizeOverride="standard"
            onClick={() => setActiveSearch(searchInput.trim())}
          >
            <span>Search</span>
          </GazeButton>
          {activeSearch && (
            <GazeButton
              gazeId="news_clear_search"
              variant="subtle"
              sizeOverride="standard"
              onClick={() => {
                setSearchInput('');
                setActiveSearch('');
              }}
            >
              <span>Clear</span>
            </GazeButton>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <GazeButton
            gazeId="news_refresh"
            variant="default"
            sizeOverride="standard"
            disabled={loading}
            onClick={() => void fetchNews(category, activeSearch, true)}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </GazeButton>
          <GazeButton
            gazeId="news_prefs"
            variant="subtle"
            sizeOverride="standard"
            onClick={() => onNavigate('profile')}
          >
            <Sparkles className="w-4 h-4" />
            <span>Categories</span>
          </GazeButton>
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {visibleCategories.map((cat) => (
          <GazeButton
            key={cat.id}
            gazeId={`news_cat_${cat.id}`}
            variant={category === cat.id ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => setCategory(cat.id)}
          >
            <span>{cat.label}</span>
          </GazeButton>
        ))}
      </div>

      {/* Source Disclosure Banner */}
      {notice && !error && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            sourceMode === 'demo'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              : 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
          }`}
        >
          {notice}
        </div>
      )}

      {/* States: Loading / Error / Empty / Articles */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm font-medium text-slate-500">
          Loading headlines...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">{error}</p>
          <GazeButton
            gazeId="news_retry"
            variant="primary"
            sizeOverride="standard"
            onClick={() => void fetchNews(category, activeSearch, true)}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </GazeButton>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No news articles matched this filter.
          </p>
          <GazeButton
            gazeId="news_reset_filters"
            variant="subtle"
            sizeOverride="standard"
            onClick={() => {
              setSearchInput('');
              setActiveSearch('');
              void fetchNews('top', '', true);
            }}
          >
            <span>Reset Search</span>
          </GazeButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((art) => (
            <NewsCard key={art.id} article={art} />
          ))}
        </div>
      )}
    </div>
  );
};
