import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export type NewsCategory =
  | 'top'
  | 'india'
  | 'world'
  | 'technology'
  | 'science'
  | 'sports'
  | 'health'
  | 'education';

export type SportCategory = 'all' | 'cricket' | 'football' | 'badminton' | 'tennis' | 'other';

export interface NormalizedNewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
}

export interface NormalizedMovieItem {
  id: string;
  title: string;
  posterUrl?: string;
  genres: string[];
  releaseYear: string;
  language: string;
  description: string;
  isLiveCatalog: boolean;
}

export interface NormalizedSportsItem {
  id: string;
  sport: Exclude<SportCategory, 'all'>;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
}

const VALID_NEWS_CATEGORIES = new Set<NewsCategory>([
  'top',
  'india',
  'world',
  'technology',
  'science',
  'sports',
  'health',
  'education',
]);

// Strictly allowlisted HTTPS RSS sources (zero arbitrary user URL fetching -> zero SSRF)
const NEWS_RSS_FEEDS: Record<NewsCategory, { source: string; url: string }[]> = {
  top: [
    { source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { source: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  ],
  india: [
    { source: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
    { source: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/india/rss.xml' },
  ],
  world: [{ source: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }],
  technology: [{ source: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }],
  science: [{ source: 'BBC Science & Environment', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' }],
  sports: [{ source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }],
  health: [{ source: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml' }],
  education: [{ source: 'BBC Education', url: 'https://feeds.bbci.co.uk/news/education/rss.xml' }],
};

const SPORTS_RSS_FEEDS: Record<Exclude<SportCategory, 'all'>, { source: string; url: string }[]> = {
  cricket: [{ source: 'BBC Sport Cricket', url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml' }],
  football: [{ source: 'BBC Sport Football', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' }],
  badminton: [{ source: 'The Hindu Other Sports', url: 'https://www.thehindu.com/sport/other-sports/feeder/default.rss' }],
  tennis: [{ source: 'BBC Sport Tennis', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml' }],
  other: [{ source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml' }],
};

const SAMPLE_OFFLINE_NEWS: Record<NewsCategory, NormalizedNewsArticle[]> = {
  top: [
    {
      id: 'sample_top_1',
      title: 'Assistive technology continues expanding hands-free communication access',
      summary:
        'Accessibility researchers and patient advocacy groups highlight eye-gaze communication interfaces helping people with motor or speech challenges stay connected with family and caregivers.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'top',
    },
    {
      id: 'sample_top_2',
      title: 'Community health centres expand tele-rehabilitation and caregiver support',
      summary:
        'Regional clinics are pairing simple daily digital check-ins with home care guidance so families can coordinate medication and appointments calmly.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'top',
    },
  ],
  india: [
    {
      id: 'sample_in_1',
      title: 'Digital accessibility standards gain wider adoption across Indian public portals',
      summary:
        'Updated bilingual web accessibility practices prioritize screen-reader labels, readable typography, and Hindi/English language support.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'india',
    },
  ],
  world: [
    {
      id: 'sample_wo_1',
      title: 'Global clean-energy microgrids bring steady power to rural clinics',
      summary:
        'Solar plus battery installations are helping regional health posts operate medical refrigeration and diagnostic tools reliably.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'world',
    },
  ],
  technology: [
    {
      id: 'sample_te_1',
      title: 'Lightweight on-device computer vision improves webcam gaze stability',
      summary:
        'Modern facial landmark pipelines can run locally inside standard web browsers without sending raw camera video streams off the user device.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'technology',
    },
  ],
  science: [
    {
      id: 'sample_sc_1',
      title: 'Ocean observation floats map seasonal temperature shifts with greater clarity',
      summary:
        'Autonomous marine sensors provide researchers with steady, open climate measurements across deep ocean basins.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'science',
    },
  ],
  sports: [
    {
      id: 'sample_sp_1',
      title: 'Domestic badminton and cricket academies emphasize athlete recovery science',
      summary:
        'Coaches increasingly pair gentle mobility training and rest tracking with match preparation across youth and senior squads.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'sports',
    },
  ],
  health: [
    {
      id: 'sample_he_1',
      title: 'Daily hydration, calming audio, and structured routines support caregiver balance',
      summary:
        'Occupational therapists recommend clear visual schedules, peaceful ambient soundscapes, and regular eye-rest breaks during screen use.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'health',
    },
  ],
  education: [
    {
      id: 'sample_ed_1',
      title: 'Bilingual interactive reading tools make home learning more inclusive',
      summary:
        'Simple word-guessing games, read-aloud short stories, and voice-supported quizzes help learners explore new concepts at their own pace.',
      url: '',
      source: 'Offline Sample Reader',
      publishedAt: 'Sample Overview',
      category: 'education',
    },
  ],
};

const REFERENCE_MOVIES: NormalizedMovieItem[] = [
  {
    id: 'ref_taare',
    title: 'Taare Zameen Par',
    genres: ['Family', 'Drama'],
    releaseYear: '2007',
    language: 'Hindi',
    description:
      'An empathetic story celebrating creativity, patient teaching, and understanding a young boy’s unique learning style.',
    isLiveCatalog: false,
  },
  {
    id: 'ref_chakde',
    title: 'Chak De! India',
    genres: ['Sports', 'Drama'],
    releaseYear: '2007',
    language: 'Hindi',
    description:
      'An inspiring sports drama about teamwork, discipline, and unity across a national women’s hockey squad.',
    isLiveCatalog: false,
  },
  {
    id: 'ref_3idiots',
    title: '3 Idiots',
    genres: ['Comedy', 'Drama'],
    releaseYear: '2009',
    language: 'Hindi',
    description:
      'A warm story following three college friends who learn to value curiosity and genuine passion.',
    isLiveCatalog: false,
  },
  {
    id: 'ref_pather',
    title: 'Pather Panchali',
    genres: ['Classic', 'Drama'],
    releaseYear: '1955',
    language: 'Bengali',
    description:
      'Satyajit Ray’s landmark poetic portrait of childhood and family life in rural Bengal.',
    isLiveCatalog: false,
  },
  {
    id: 'ref_nemo',
    title: 'Finding Nemo',
    genres: ['Animation', 'Adventure', 'Family'],
    releaseYear: '2003',
    language: 'English',
    description:
      'A colourful ocean adventure following a devoted clownfish father crossing the reef to reunite with his son.',
    isLiveCatalog: false,
  },
  {
    id: 'ref_lagaan',
    title: 'Lagaan',
    genres: ['Historical', 'Sports', 'Musical'],
    releaseYear: '2001',
    language: 'Hindi',
    description:
      'Villagers band together to learn cricket in a sweeping musical tale of courage and solidarity.',
    isLiveCatalog: false,
  },
];

const cacheStore = new Map<string, { expiresAt: number; payload: unknown }>();

function getCached<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.payload as T;
}

function setCached(key: string, payload: unknown, ttlMs = 5 * 60 * 1000): void {
  cacheStore.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

export function isSafeHttpUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripTagsAndClean(raw: string, maxLen = 280): string {
  const decoded = decodeHtmlEntities(raw);
  const withoutTags = decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutTags.length <= maxLen) return withoutTags;
  return `${withoutTags.slice(0, maxLen - 1).trim()}…`;
}

function extractXmlTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function extractRssImage(block: string): string | undefined {
  const mediaMatch =
    block.match(/<media:(?:thumbnail|content)[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*type=["']image\//i);
  if (mediaMatch && mediaMatch[1]) {
    const safe = isSafeHttpUrl(mediaMatch[1]);
    return safe || undefined;
  }
  return undefined;
}

export function parseRssItems(
  xmlText: string,
  sourceName: string,
  category: NewsCategory
): NormalizedNewsArticle[] {
  const itemMatches = xmlText.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  const results: NormalizedNewsArticle[] = [];

  for (let i = 0; i < Math.min(itemMatches.length, 12); i++) {
    const item = itemMatches[i];
    const title = stripTagsAndClean(extractXmlTag(item, 'title'), 180);
    const summary = stripTagsAndClean(extractXmlTag(item, 'description'), 300);
    const rawLink = decodeHtmlEntities(extractXmlTag(item, 'link')).trim();
    const url = isSafeHttpUrl(rawLink);
    const pubDateRaw = stripTagsAndClean(extractXmlTag(item, 'pubDate'), 64);
    const imageUrl = extractRssImage(item);

    if (!title || !url) continue;

    let publishedAt = pubDateRaw || 'Recent';
    if (pubDateRaw) {
      const parsedDate = Date.parse(pubDateRaw);
      if (!Number.isNaN(parsedDate)) {
        publishedAt = new Date(parsedDate).toISOString();
      }
    }

    results.push({
      id: `rss_${category}_${i}_${Buffer.from(url).toString('base64url').slice(0, 10)}`,
      title,
      summary: summary || 'Open original article to read full details.',
      url,
      imageUrl,
      source: sourceName,
      publishedAt,
      category,
    });
  }

  return results;
}

async function fetchFromNewsApi(
  apiKey: string,
  category: NewsCategory,
  searchQuery: string
): Promise<NormalizedNewsArticle[] | null> {
  try {
    const newsApiCategoryMap: Record<NewsCategory, string> = {
      top: 'general',
      india: 'general',
      world: 'general',
      technology: 'technology',
      science: 'science',
      sports: 'sports',
      health: 'health',
      education: 'general',
    };

    const url = new URL('https://newsapi.org/v2/top-headlines');
    if (category === 'india') {
      url.searchParams.set('country', 'in');
    } else if (category === 'world') {
      url.searchParams.set('language', 'en');
    } else {
      url.searchParams.set('language', 'en');
    }
    url.searchParams.set('category', newsApiCategoryMap[category]);
    if (searchQuery) {
      url.searchParams.set('q', searchQuery);
    } else if (category === 'education') {
      url.searchParams.set('q', 'education');
    }
    url.searchParams.set('pageSize', '15');

    const resp = await fetch(url.toString(), {
      headers: { 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      articles?: {
        title?: string;
        description?: string;
        url?: string;
        urlToImage?: string;
        publishedAt?: string;
        source?: { name?: string };
      }[];
    };

    if (!Array.isArray(data.articles)) return null;

    const normalized: NormalizedNewsArticle[] = [];
    for (let i = 0; i < data.articles.length; i++) {
      const a = data.articles[i];
      const safeUrl = isSafeHttpUrl(a.url);
      if (!a.title || !safeUrl || a.title === '[Removed]') continue;
      const safeImg = isSafeHttpUrl(a.urlToImage) || undefined;
      normalized.push({
        id: `newsapi_${category}_${i}`,
        title: a.title.trim().slice(0, 180),
        summary: (a.description || 'Open article link to read full story.').trim().slice(0, 320),
        url: safeUrl,
        imageUrl: safeImg,
        source: a.source?.name?.trim() || 'News Source',
        publishedAt: a.publishedAt || new Date().toISOString(),
        category,
      });
    }
    return normalized;
  } catch {
    return null;
  }
}

async function fetchFromAllowlistedRss(
  feeds: { source: string; url: string }[],
  category: NewsCategory
): Promise<NormalizedNewsArticle[]> {
  const settled = await Promise.allSettled(
    feeds.map(async (feed) => {
      const resp = await fetch(feed.url, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(4500),
      });
      if (!resp.ok) return [];
      const xml = await resp.text();
      return parseRssItems(xml, feed.source, category);
    })
  );

  const combined: NormalizedNewsArticle[] = [];
  for (const res of settled) {
    if (res.status === 'fulfilled') {
      combined.push(...res.value);
    }
  }
  return combined.slice(0, 16);
}

export function createMediaRouter(getGeminiClient: () => GoogleGenAI | null): express.Router {
  const router = express.Router();

  // 1. News Proxy & Normalizer
  router.get('/news', async (req, res) => {
    const rawCat = typeof req.query.category === 'string' ? req.query.category.toLowerCase() : 'top';
    const category: NewsCategory = VALID_NEWS_CATEGORIES.has(rawCat as NewsCategory)
      ? (rawCat as NewsCategory)
      : 'top';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

    const cacheKey = `news:${category}:${q.toLowerCase()}`;
    if (!forceRefresh) {
      const cached = getCached<Record<string, unknown>>(cacheKey);
      if (cached) {
        return res.json({ ...cached, fromCache: true });
      }
    }

    let articles: NormalizedNewsArticle[] = [];
    let mode: 'live' | 'rss' | 'demo' = 'demo';

    const newsApiKey = process.env.NEWS_API_KEY?.trim();
    if (newsApiKey) {
      const fromApi = await fetchFromNewsApi(newsApiKey, category, q);
      if (fromApi && fromApi.length > 0) {
        articles = fromApi;
        mode = 'live';
      }
    }

    if (articles.length === 0) {
      const rssResults = await fetchFromAllowlistedRss(NEWS_RSS_FEEDS[category], category);
      if (rssResults.length > 0) {
        articles = q
          ? rssResults.filter(
              (a) =>
                a.title.toLowerCase().includes(q.toLowerCase()) ||
                a.summary.toLowerCase().includes(q.toLowerCase())
            )
          : rssResults;
        mode = 'rss';
      }
    }

    if (articles.length === 0 && mode === 'demo') {
      const samplePool = SAMPLE_OFFLINE_NEWS[category] || SAMPLE_OFFLINE_NEWS.top;
      articles = q
        ? samplePool.filter(
            (a) =>
              a.title.toLowerCase().includes(q.toLowerCase()) ||
              a.summary.toLowerCase().includes(q.toLowerCase())
          )
        : samplePool;
    }

    const payload = {
      ok: true,
      mode,
      isLive: mode === 'live' || mode === 'rss',
      category,
      cachedAt: new Date().toISOString(),
      notice:
        mode === 'demo'
          ? 'Live news feeds could not be reached in this environment. Showing clearly labelled offline sample reader items.'
          : mode === 'rss'
            ? 'Retrieved from public RSS news feeds.'
            : 'Retrieved from configured News API.',
      articles,
    };

    if (mode !== 'demo') {
      setCached(cacheKey, payload, 5 * 60 * 1000);
    }
    return res.json(payload);
  });

  // 2. Simplify News Summary (uses server-side Gemini when available, honest plain excerpt fallback otherwise)
  router.post('/gemini/simplify', async (req, res) => {
    const body = (req.body || {}) as { title?: unknown; summary?: unknown; language?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 220) : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 1200) : '';
    const language = body.language === 'hi' ? 'hi' : 'en';

    if (!title && !summary) {
      return res.status(400).json({ ok: false, error: 'Article headline or summary is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Honest non-AI concise fallback so UI clearly discloses source: 'offline_excerpt'
      const combined = summary || title;
      const sentences = combined
        .split(/(?<=[.!?।])\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join(' ');
      return res.json({
        ok: true,
        source: 'offline_excerpt',
        simplifiedText: sentences || combined,
        notice: 'Gemini API key is not configured on the server; showing shortened original excerpt.',
      });
    }

    try {
      const targetLang = language === 'hi' ? 'simple Hindi (Devanagari)' : 'clear, gentle English';
      const prompt = [
        `Rewrite this news summary in ${targetLang} using 2 short, calm sentences.`,
        'STRICT RULES:',
        '1. Preserve every fact from the headline and summary accurately.',
        '2. Never add statistics, dates, causes, or opinions that were not in the input.',
        `Headline: ${title}`,
        `Summary: ${summary}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        return res.status(502).json({
          ok: false,
          error: 'Empty simplification response from Gemini.',
        });
      }

      return res.json({
        ok: true,
        source: 'gemini',
        simplifiedText: text,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upstream error';
      console.error('Gemini simplify error:', msg);
      return res.status(502).json({
        ok: false,
        error: 'Could not reach Gemini service for simplification.',
      });
    }
  });

  // 3. Movies & Entertainment Info (TMDB when TMDB_API_KEY configured, honest reference guide otherwise)
  router.get('/entertainment/movies', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const langFilter = typeof req.query.language === 'string' ? req.query.language.trim() : '';

    const cacheKey = `movies:${q.toLowerCase()}:${langFilter.toLowerCase()}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });

    const tmdbKey = process.env.TMDB_API_KEY?.trim();
    if (tmdbKey) {
      try {
        const endpoint = q
          ? `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`
          : `https://api.themoviedb.org/3/discover/movie?sort_by=popularity.desc&include_adult=false&language=en-US&page=1`;

        const resp = await fetch(`${endpoint}&api_key=${encodeURIComponent(tmdbKey)}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            results?: {
              id: number;
              title?: string;
              poster_path?: string | null;
              release_date?: string;
              original_language?: string;
              overview?: string;
            }[];
          };

          const movies: NormalizedMovieItem[] = (data.results || []).slice(0, 12).map((m) => ({
            id: `tmdb_${m.id}`,
            title: m.title || 'Untitled',
            posterUrl: m.poster_path
              ? isSafeHttpUrl(`https://image.tmdb.org/t/p/w342${m.poster_path}`) || undefined
              : undefined,
            genres: ['Cinema'],
            releaseYear: m.release_date ? m.release_date.slice(0, 4) : 'Unknown',
            language: (m.original_language || 'en').toUpperCase(),
            description: m.overview || 'No description available.',
            isLiveCatalog: true,
          }));

          const filtered = langFilter
            ? movies.filter((m) => m.language.toLowerCase().includes(langFilter.toLowerCase()))
            : movies;

          const payload = {
            ok: true,
            mode: 'tmdb',
            isLiveCatalog: true,
            notice: 'Movie metadata loaded from TMDB.',
            movies: filtered,
          };
          setCached(cacheKey, payload, 10 * 60 * 1000);
          return res.json(payload);
        }
      } catch {
        // Fall through cleanly to honest reference response
      }
    }

    const filteredRef = REFERENCE_MOVIES.filter((m) => {
      const matchQ =
        !q ||
        m.title.toLowerCase().includes(q.toLowerCase()) ||
        m.description.toLowerCase().includes(q.toLowerCase()) ||
        m.genres.some((g) => g.toLowerCase().includes(q.toLowerCase()));
      const matchLang =
        !langFilter || m.language.toLowerCase().includes(langFilter.toLowerCase());
      return matchQ && matchLang;
    });

    return res.json({
      ok: true,
      mode: 'reference',
      isLiveCatalog: false,
      notice:
        'Live TMDB movie discovery requires a TMDB_API_KEY configured on the server. Showing curated family cinema reference guide without fabricated ratings or streaming links.',
      movies: filteredRef,
    });
  });

  // 4. Sports Updates (Allowlisted RSS feeds only — never fabricates live scores)
  router.get('/entertainment/sports', async (req, res) => {
    const rawSport = typeof req.query.sport === 'string' ? req.query.sport.toLowerCase() : 'all';
    const validSports = new Set<SportCategory>([
      'all',
      'cricket',
      'football',
      'badminton',
      'tennis',
      'other',
    ]);
    const sport: SportCategory = validSports.has(rawSport as SportCategory)
      ? (rawSport as SportCategory)
      : 'all';
    const forceRefresh = req.query.refresh === '1';

    const cacheKey = `sports:${sport}`;
    if (!forceRefresh) {
      const cached = getCached<Record<string, unknown>>(cacheKey);
      if (cached) return res.json({ ...cached, fromCache: true });
    }

    const targetSports: Exclude<SportCategory, 'all'>[] =
      sport === 'all' ? ['cricket', 'football', 'badminton', 'tennis'] : [sport];

    const updates: NormalizedSportsItem[] = [];
    for (const sp of targetSports) {
      const items = await fetchFromAllowlistedRss(SPORTS_RSS_FEEDS[sp], 'sports');
      for (const item of items.slice(0, sport === 'all' ? 3 : 8)) {
        updates.push({
          id: `${sp}_${item.id}`,
          sport: sp,
          title: item.title,
          summary: item.summary,
          source: item.source,
          publishedAt: item.publishedAt,
          url: item.url,
        });
      }
    }

    const payload = {
      ok: true,
      mode: updates.length > 0 ? 'rss' : 'unavailable',
      isLive: updates.length > 0,
      sport,
      cachedAt: new Date().toISOString(),
      notice:
        updates.length > 0
          ? 'Recent sports headlines loaded from public RSS sports feeds.'
          : 'Sports RSS feeds could not be reached right now (offline or blocked). No live match scores are fabricated.',
      updates,
    };

    if (updates.length > 0) {
      setCached(cacheKey, payload, 5 * 60 * 1000);
    }
    return res.json(payload);
  });

  return router;
}
