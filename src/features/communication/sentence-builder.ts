export interface SentenceState {
  text: string;
  history: string[];
  selectedTokens: string[];
}

export function createInitialSentenceState(initialText = ''): SentenceState {
  return {
    text: initialText,
    history: [],
    selectedTokens: initialText ? initialText.split(/\s+/).filter(Boolean) : [],
  };
}

export function appendPhraseToSentence(state: SentenceState, phrase: string): SentenceState {
  const clean = phrase.trim();
  if (!clean) return state;

  const nextText = state.text.trim().length > 0 ? `${state.text.trim()} ${clean}` : clean;
  return {
    text: nextText,
    history: [...state.history.slice(-24), state.text],
    selectedTokens: [...state.selectedTokens, clean],
  };
}

export function appendCharacterToSentence(state: SentenceState, char: string): SentenceState {
  const nextText = state.text + char;
  return {
    text: nextText,
    history: [...state.history.slice(-24), state.text],
    selectedTokens: nextText.trim().split(/\s+/).filter(Boolean),
  };
}

export function replaceSentenceWithSuggestion(
  state: SentenceState,
  suggestion: string
): SentenceState {
  const clean = suggestion.trim();
  if (!clean) return state;
  return {
    text: clean,
    history: [...state.history.slice(-24), state.text],
    selectedTokens: clean.split(/\s+/).filter(Boolean),
  };
}

export function backspaceCharacter(state: SentenceState): SentenceState {
  if (!state.text) return state;
  const nextText = state.text.slice(0, -1);
  return {
    text: nextText,
    history: [...state.history.slice(-24), state.text],
    selectedTokens: nextText.trim().split(/\s+/).filter(Boolean),
  };
}

export function deleteLastWord(state: SentenceState): SentenceState {
  const trimmed = state.text.trimEnd();
  if (!trimmed) {
    return state.text ? clearSentence(state) : state;
  }
  const lastSpace = trimmed.lastIndexOf(' ');
  const nextText = lastSpace === -1 ? '' : trimmed.slice(0, lastSpace + 1);
  return {
    text: nextText,
    history: [...state.history.slice(-24), state.text],
    selectedTokens: nextText.trim().split(/\s+/).filter(Boolean),
  };
}

export function undoSentence(state: SentenceState): SentenceState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return {
    text: prev,
    history: state.history.slice(0, -1),
    selectedTokens: prev.trim().split(/\s+/).filter(Boolean),
  };
}

export function clearSentence(state: SentenceState): SentenceState {
  if (!state.text) return state;
  return {
    text: '',
    history: [...state.history.slice(-24), state.text],
    selectedTokens: [],
  };
}
