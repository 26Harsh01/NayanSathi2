import React, { useState } from 'react';
import { ExternalLink, Sparkles, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { speakText } from '../../features/communication/text-to-speech';
import { GazeButton } from '../gaze/GazeButton';

export interface NewsArticleItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: string;
  category: string;
}

export function getSafeArticleHref(rawUrl: string): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function formatNewsDate(raw: string): string {
  if (!raw || raw === 'Sample Overview' || raw === 'Recent') return raw || 'Recent';
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const NewsCard: React.FC<{ article: NewsArticleItem }> = ({ article }) => {
  const { settings } = useAppState();
  const [simplified, setSimplified] = useState<string | null>(null);
  const [simplifySource, setSimplifySource] = useState<'gemini' | 'offline_excerpt' | null>(null);
  const [simplifyError, setSimplifyError] = useState<string | null>(null);
  const [simplifying, setSimplifying] = useState(false);

  const safeHref = getSafeArticleHref(article.url);
  const safeImgHref = article.imageUrl ? getSafeArticleHref(article.imageUrl) : null;

  const handleSimplify = async () => {
    if (simplifying) return;
    setSimplifying(true);
    setSimplifyError(null);
    try {
      const resp = await fetch('/api/gemini/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary,
          language: settings.communication.language,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        simplifiedText?: string;
        source?: 'gemini' | 'offline_excerpt';
        error?: string;
      };
      if (!resp.ok || !data.simplifiedText) {
        setSimplifyError(data.error || 'Unable to simplify this news summary right now.');
      } else {
        setSimplified(data.simplifiedText);
        setSimplifySource(data.source || 'offline_excerpt');
      }
    } catch {
      setSimplifyError('Could not reach simplification service.');
    } finally {
      setSimplifying(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between">
      <div>
        {safeImgHref && (
          <img
            src={safeImgHref}
            alt={article.title}
            loading="lazy"
            className="w-full h-44 object-cover border-b border-slate-100 dark:border-slate-800"
          />
        )}

        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              {article.source}
            </span>
            <time className="tabular-nums">{formatNewsDate(article.publishedAt)}</time>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
            {article.title}
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {article.summary}
          </p>

          {simplified && (
            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                {simplifySource === 'gemini' ? 'Simplified News (AI)' : 'Short Plain Summary (Offline)'}
              </p>
              <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                {simplified}
              </p>
            </div>
          )}

          {simplifyError && (
            <p className="text-xs text-red-600 dark:text-red-400">{simplifyError}</p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 flex flex-wrap gap-2">
        <GazeButton
          gazeId={`news_simplify_${article.id}`}
          variant="default"
          sizeOverride="standard"
          disabled={simplifying}
          onClick={() => void handleSimplify()}
        >
          <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <span>{simplifying ? 'Simplifying...' : 'Simplify News'}</span>
        </GazeButton>

        <GazeButton
          gazeId={`news_speak_${article.id}`}
          variant="subtle"
          sizeOverride="standard"
          onClick={() =>
            speakText(`${article.title}. ${simplified || article.summary}`, {
              language: settings.communication.language,
              rate: settings.communication.speechRate,
            })
          }
        >
          <Volume2 className="w-4 h-4" />
          <span>Listen</span>
        </GazeButton>

        {safeHref && (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            data-gaze-target={`news_readmore_${article.id}`}
            className="min-h-[48px] px-4 py-2.5 rounded-xl border border-teal-800 bg-teal-700 text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Read More</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </article>
  );
};
