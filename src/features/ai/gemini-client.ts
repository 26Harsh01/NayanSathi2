import type { AISuggestion, Language } from '../../types';

export interface GeminiSuggestParams {
  words: string[];
  currentSentence: string;
  language: Language;
  contextCategory?: string;
  signal?: AbortSignal;
}

export interface GeminiSuggestResponse {
  suggestions: AISuggestion[];
  source: 'gemini' | 'unavailable';
  reason?: string;
}

export async function fetchGeminiSuggestions(
  params: GeminiSuggestParams
): Promise<GeminiSuggestResponse> {
  const baseUrl =
    (import.meta.env.VITE_BACKEND_API_URL as string | undefined)?.replace(/\/$/, '') || '';
  const endpoint = `${baseUrl}/api/gemini/suggest`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        words: params.words,
        currentSentence: params.currentSentence,
        language: params.language,
        contextCategory: params.contextCategory ?? 'general',
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        suggestions: [],
        source: 'unavailable',
        reason:
          typeof errBody?.message === 'string'
            ? errBody.message
            : `Gemini endpoint returned ${response.status}`,
      };
    }

    const data = (await response.json()) as { suggestions?: unknown };
    const list = Array.isArray(data.suggestions)
      ? data.suggestions
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .slice(0, 3)
      : [];

    if (list.length === 0) {
      return {
        suggestions: [],
        source: 'unavailable',
        reason: 'Empty suggestions returned',
      };
    }

    return {
      source: 'gemini',
      suggestions: list.map((text, idx) => ({
        id: `gem_${idx}_${Date.now()}`,
        text: text.trim(),
        source: 'gemini',
      })),
    };
  } catch (err) {
    return {
      suggestions: [],
      source: 'unavailable',
      reason: err instanceof Error ? err.message : 'Network error',
    };
  }
}
