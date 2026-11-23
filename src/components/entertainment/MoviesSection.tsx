import React, { useCallback, useEffect, useState } from 'react';
import { Film, RefreshCw, Search } from 'lucide-react';
import { GazeButton } from '../gaze/GazeButton';
import { getSafeArticleHref } from '../news/NewsCard';

interface MovieInfoItem {
  id: string;
  title: string;
  posterUrl?: string;
  genres: string[];
  releaseYear: string;
  language: string;
  description: string;
  isLiveCatalog: boolean;
}

export const MoviesSection: React.FC = () => {
  const [queryInput, setQueryInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [movies, setMovies] = useState<MovieInfoItem[]>([]);
  const [mode, setMode] = useState<'tmdb' | 'reference'>('reference');
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMovies = useCallback(async (q: string, lang: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (lang) params.set('language', lang);
      const resp = await fetch(`/api/entertainment/movies?${params.toString()}`);
      if (!resp.ok) throw new Error(`Movies API returned HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        mode?: 'tmdb' | 'reference';
        notice?: string;
        movies?: MovieInfoItem[];
      };
      setMovies(Array.isArray(data.movies) ? data.movies : []);
      setMode(data.mode || 'reference');
      setNotice(data.notice || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load movie information.');
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMovies(activeQuery, langFilter);
  }, [activeQuery, langFilter, loadMovies]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveQuery(queryInput.trim());
          }}
          className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]"
        >
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search movies by title or theme..."
              aria-label="Search movies"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>
          <GazeButton
            gazeId="mov_search_btn"
            variant="primary"
            sizeOverride="standard"
            onClick={() => setActiveQuery(queryInput.trim())}
          >
            <span>Search</span>
          </GazeButton>
        </form>

        <div className="flex flex-wrap gap-2">
          {(['', 'Hindi', 'English', 'Bengali'] as const).map((lf) => (
            <GazeButton
              key={lf || 'all'}
              gazeId={`mov_lang_${lf || 'all'}`}
              variant={langFilter === lf ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={() => setLangFilter(lf)}
            >
              <span>{lf || 'All Languages'}</span>
            </GazeButton>
          ))}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            mode === 'reference'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
              : 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
          }`}
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          Loading movie information...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          <GazeButton
            gazeId="mov_retry"
            variant="primary"
            sizeOverride="standard"
            onClick={() => void loadMovies(activeQuery, langFilter)}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </GazeButton>
        </div>
      ) : movies.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          No movies matched your search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {movies.map((mov) => {
            const safePoster = mov.posterUrl ? getSafeArticleHref(mov.posterUrl) : null;
            return (
              <div
                key={mov.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
              >
                {safePoster ? (
                  <img
                    src={safePoster}
                    alt={mov.title}
                    loading="lazy"
                    className="w-full h-52 object-cover border-b border-slate-100 dark:border-slate-800"
                  />
                ) : (
                  <div className="w-full h-28 bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center border-b border-slate-200 dark:border-slate-800">
                    <Film className="w-8 h-8 text-teal-700 dark:text-teal-400" />
                  </div>
                )}

                <div className="p-5 space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-teal-700 dark:text-teal-400">
                      {mov.genres.join(' · ')}
                    </span>
                    <span className="font-mono tabular-nums">
                      {mov.releaseYear} · {mov.language}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {mov.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {mov.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
