import type { Language } from '../../types';

export interface WordGuessPrompt {
  id: string;
  language: Language;
  /** Letter/akshara tokens cleanly separable without complex Unicode cluster bugs */
  tokens: string[];
  clue: string;
  emoji: string;
  category: string;
}

export const ENGLISH_WORD_PROMPTS: WordGuessPrompt[] = [
  { id: 'en_sun', language: 'en', tokens: ['S', 'U', 'N'], clue: 'Shines brightly in the sky during the day', emoji: '☀️', category: 'Nature' },
  { id: 'en_cup', language: 'en', tokens: ['C', 'U', 'P'], clue: 'Used for drinking warm tea or coffee', emoji: '☕', category: 'Home' },
  { id: 'en_tree', language: 'en', tokens: ['T', 'R', 'E', 'E'], clue: 'Has green leaves, a trunk, and deep roots', emoji: '🌳', category: 'Nature' },
  { id: 'en_book', language: 'en', tokens: ['B', 'O', 'O', 'K'], clue: 'You open and read pages inside it', emoji: '📖', category: 'Everyday' },
  { id: 'en_apple', language: 'en', tokens: ['A', 'P', 'P', 'L', 'E'], clue: 'A crisp, sweet red or green fruit', emoji: '🍎', category: 'Food' },
  { id: 'en_water', language: 'en', tokens: ['W', 'A', 'T', 'E', 'R'], clue: 'Clear drink we need every day to stay hydrated', emoji: '💧', category: 'Everyday' },
  { id: 'en_house', language: 'en', tokens: ['H', 'O', 'U', 'S', 'E'], clue: 'A cosy place where a family lives', emoji: '🏠', category: 'Home' },
  { id: 'en_music', language: 'en', tokens: ['M', 'U', 'S', 'I', 'C'], clue: 'Songs and melodies that help us relax', emoji: '🎵', category: 'Recreation' },
  { id: 'en_flower', language: 'en', tokens: ['F', 'L', 'O', 'W', 'E', 'R'], clue: 'Blooms in a garden with colourful petals', emoji: '🌸', category: 'Nature' },
  { id: 'en_smile', language: 'en', tokens: ['S', 'M', 'I', 'L', 'E'], clue: 'A happy expression on your face', emoji: '😊', category: 'Feelings' },
  { id: 'en_garden', language: 'en', tokens: ['G', 'A', 'R', 'D', 'E', 'N'], clue: 'Outdoor space full of plants and butterflies', emoji: '🏡', category: 'Nature' },
  { id: 'en_friend', language: 'en', tokens: ['F', 'R', 'I', 'E', 'N', 'D'], clue: 'Someone kind who spends happy time with you', emoji: '🤝', category: 'People' },
];

/**
 * Simple everyday Hindi words split cleanly into standalone Hindi letters / matra-syllables
 * so eye-gaze letter buttons remain effortless and accurate in Devanagari.
 */
export const HINDI_WORD_PROMPTS: WordGuessPrompt[] = [
  { id: 'hi_jal', language: 'hi', tokens: ['ज', 'ल'], clue: 'पीने के लिए साफ़ पानी', emoji: '💧', category: 'दैनिक जीवन' },
  { id: 'hi_ghar', language: 'hi', tokens: ['घ', 'र'], clue: 'जहाँ परिवार के साथ रहते हैं', emoji: '🏠', category: 'घर' },
  { id: 'hi_phal', language: 'hi', tokens: ['फ', 'ल'], clue: 'आम, सेब और केला जैसे मीठे खाद्य', emoji: '🍎', category: 'भोजन' },
  { id: 'hi_kamal', language: 'hi', tokens: ['क', 'म', 'ल'], clue: 'पानी में खिलने वाला सुंदर फूल', emoji: '🪷', category: 'प्रकृति' },
  { id: 'hi_suraj', language: 'hi', tokens: ['सू', 'र', 'ज'], clue: 'सुबह आकाश में रोशनी देने वाला तारा', emoji: '☀️', category: 'प्रकृति' },
  { id: 'hi_chanda', language: 'hi', tokens: ['चं', 'दा'], clue: 'रात को आकाश में चमकने वाला चाँद', emoji: '🌙', category: 'प्रकृति' },
  { id: 'hi_phool', language: 'hi', tokens: ['फू', 'ल'], clue: 'बगीचे में खिलने वाला खुशबूदार पौधा', emoji: '🌸', category: 'प्रकृति' },
  { id: 'hi_kitaab', language: 'hi', tokens: ['कि', 'ता', 'ब'], clue: 'कहानियाँ और ज्ञान पढ़ने के लिए', emoji: '📖', category: 'दैनिक जीवन' },
  { id: 'hi_chai', language: 'hi', tokens: ['चा', 'य'], clue: 'सुबह का गरम पेय', emoji: '☕', category: 'भोजन' },
  { id: 'hi_dost', language: 'hi', tokens: ['दो', 'स्', 'त'], clue: 'साथ निभाने वाला प्रिय मित्र', emoji: '🤝', category: 'रिश्ते' },
];

export const ENGLISH_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const HINDI_EXTRA_DISTRACTORS = [
  'क', 'ख', 'ग', 'घ', 'च', 'ज', 'ट', 'त', 'द', 'न',
  'प', 'फ', 'ब', 'म', 'य', 'र', 'ल', 'व', 'स', 'ह',
  'का', 'कि', 'ता', 'पा', 'ना', 'मा', 'रा', 'सा', 'सू', 'फू',
];

export function buildChoiceTilesForPrompt(prompt: WordGuessPrompt): string[] {
  if (prompt.language === 'en') {
    return ENGLISH_ALPHABET;
  }
  const uniqueTokens = Array.from(new Set(prompt.tokens));
  const pool = [...uniqueTokens];
  for (const extra of HINDI_EXTRA_DISTRACTORS) {
    if (pool.length >= 16) break;
    if (!pool.includes(extra)) pool.push(extra);
  }
  // Deterministic friendly sorting by character code so gaze positions feel predictable
  return pool.sort((a, b) => a.localeCompare(b, 'hi'));
}

export function evaluateWordGuess(
  prompt: WordGuessPrompt,
  guessedTokens: string[],
  maxMistakes = 6
): {
  maskedWord: (string | null)[];
  mistakes: number;
  maxMistakes: number;
  isWon: boolean;
  isLost: boolean;
  remainingLetters: number;
} {
  const guessedSet = new Set(guessedTokens);
  const wordSet = new Set(prompt.tokens);
  const mistakes = guessedTokens.filter((t) => !wordSet.has(t)).length;
  const maskedWord = prompt.tokens.map((t) => (guessedSet.has(t) ? t : null));
  const remainingLetters = maskedWord.filter((t) => t === null).length;
  const isWon = remainingLetters === 0;
  const isLost = !isWon && mistakes >= maxMistakes;

  return {
    maskedWord,
    mistakes,
    maxMistakes,
    isWon,
    isLost,
    remainingLetters,
  };
}
