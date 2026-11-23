import type { AISuggestion, Language } from '../../types';
import { fetchGeminiSuggestions } from './gemini-client';
import { generateOfflineSuggestions } from './offline-fallback';

export interface SuggestionResult {
  suggestions: AISuggestion[];
  mode: 'gemini' | 'offline';
  notice?: string;
}

export async function getCommunicationSuggestions(options: {
  words: string[];
  currentSentence: string;
  language: Language;
  contextCategory?: string;
  signal?: AbortSignal;
}): Promise<SuggestionResult> {
  const hasInput =
    options.words.length > 0 || options.currentSentence.trim().length > 0;

  if (!hasInput) {
    return {
      suggestions: generateOfflineSuggestions([], '', options.language),
      mode: 'offline',
    };
  }

  // Respect browser offline status immediately without hanging
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      suggestions: generateOfflineSuggestions(
        options.words,
        options.currentSentence,
        options.language
      ),
      mode: 'offline',
      notice: 'Offline mode active — showing deterministic local suggestions.',
    };
  }

  const remote = await fetchGeminiSuggestions(options);
  if (remote.source === 'gemini' && remote.suggestions.length > 0) {
    return {
      suggestions: remote.suggestions,
      mode: 'gemini',
    };
  }

  return {
    suggestions: generateOfflineSuggestions(
      options.words,
      options.currentSentence,
      options.language
    ),
    mode: 'offline',
    notice: remote.reason,
  };
}
