import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildChoiceTilesForPrompt,
  ENGLISH_WORD_PROMPTS,
  evaluateWordGuess,
  HINDI_WORD_PROMPTS,
} from '../games/word-guess';
import {
  canSlideTile,
  createSolvedPuzzle,
  generateSolvablePuzzle,
  isPuzzleSolved,
  isSolvablePuzzle,
  slideTileIntoBlank,
} from '../games/sliding-puzzle';
import {
  chooseConnectFourAIMove,
  createEmptyConnectFourBoard,
  evaluateConnectFour,
  getAvailableRow,
} from '../games/connect-four';
import { generatePatternChallenge } from '../games/pattern-sequence';
import {
  daysUntilMonthDay,
  sortUpcomingBirthdays,
} from '../entertainment/content-library';
import {
  createDefaultHubPreferences,
  loadHubPreferences,
  saveHubPreferences,
} from '../storage/hub-preferences-storage';
import { isSafeHttpUrl, parseRssItems } from '../../../server/media/routes';
import { getSafeArticleHref } from '../../components/news/NewsCard';

function installMockWindowStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      dispatchEvent: () => true,
    },
    configurable: true,
  });
  return store;
}

describe('Entertainment, Recreation, Music & News Hub', () => {
  beforeEach(() => {
    installMockWindowStorage();
  });
  it('supports English and Hindi Word Guess rounds with clean masking and win detection', () => {
    const enWord = ENGLISH_WORD_PROMPTS[0];
    expect(buildChoiceTilesForPrompt(enWord)).toHaveLength(26);

    const mid = evaluateWordGuess(enWord, [enWord.tokens[0], 'Z']);
    expect(mid.mistakes).toBe(1);
    expect(mid.isWon).toBe(false);
    expect(mid.maskedWord[0]).toBe(enWord.tokens[0]);

    const won = evaluateWordGuess(enWord, Array.from(new Set(enWord.tokens)));
    expect(won.isWon).toBe(true);
    expect(won.remainingLetters).toBe(0);

    const hiWord = HINDI_WORD_PROMPTS[0];
    const hiTiles = buildChoiceTilesForPrompt(hiWord);
    hiWord.tokens.forEach((tok) => expect(hiTiles).toContain(tok));
    const hiWon = evaluateWordGuess(hiWord, hiWord.tokens);
    expect(hiWon.isWon).toBe(true);
  });

  it('generates solvable 3x3 and 4x4 sliding puzzles and slides adjacent tiles only', () => {
    for (const size of [3, 4] as const) {
      const board = generateSolvablePuzzle(size);
      expect(board).toHaveLength(size * size);
      expect(isSolvablePuzzle(board, size)).toBe(true);
      expect(isPuzzleSolved(board)).toBe(false);
    }

    const solved3 = createSolvedPuzzle(3);
    expect(isPuzzleSolved(solved3)).toBe(true);
    // Index 7 is adjacent to blank at index 8; index 0 is not
    expect(canSlideTile(solved3, 3, 7)).toBe(true);
    expect(canSlideTile(solved3, 3, 0)).toBe(false);
    const moved = slideTileIntoBlank(solved3, 3, 7);
    expect(moved).not.toBeNull();
    expect(moved![8]).toBe(8);
    expect(moved![7]).toBe(0);
  });

  it('evaluates Connect Four wins and picks legal AI moves', () => {
    const board = createEmptyConnectFourBoard();
    for (let c = 0; c < 4; c++) {
      board[5][c] = 'R';
    }
    const ev = evaluateConnectFour(board);
    expect(ev.winner).toBe('R');
    expect(ev.winningCells).toHaveLength(4);

    const openBoard = createEmptyConnectFourBoard();
    openBoard[5][3] = 'R';
    openBoard[5][2] = 'R';
    openBoard[5][1] = 'R';
    // AI ('Y') on hard/medium should pick valid column 0 or 4 to block
    const col = chooseConnectFourAIMove(openBoard, 'Y', 'hard');
    expect(col).not.toBeNull();
    expect(getAvailableRow(openBoard, col!)).toBeGreaterThanOrEqual(0);
  });

  it('generates valid challenges for all Number & Pattern modes', () => {
    const modes = ['numbers', 'shapes', 'colours', 'missing_object', 'picture_match'] as const;
    for (const m of modes) {
      const ch = generatePatternChallenge(m, 'medium');
      expect(ch.options.length).toBeGreaterThanOrEqual(3);
      expect(ch.options.some((o) => o.id === ch.correctOptionId)).toBe(true);
    }
  });

  it('persists isolated hub preferences and calculates birthday countdowns accurately', () => {
    const prefs = createDefaultHubPreferences();
    prefs.disabledGameIds = ['chess'];
    prefs.favoriteSports = ['cricket', 'tennis'];
    saveHubPreferences(prefs, 'patient_test_hub_1');

    const reloaded = loadHubPreferences('patient_test_hub_1');
    expect(reloaded.disabledGameIds).toEqual(['chess']);
    expect(reloaded.favoriteSports).toEqual(['cricket', 'tennis']);

    const ref = new Date(2026, 10, 23); // Nov 23, 2026
    expect(daysUntilMonthDay(11, 23, ref)).toBe(0);
    expect(daysUntilMonthDay(11, 24, ref)).toBe(1);

    const sorted = sortUpcomingBirthdays(
      [
        { id: 'b1', personName: 'Asha', relationship: 'Sister', monthDay: '12-01' },
        { id: 'b2', personName: 'Ravi', relationship: 'Friend', monthDay: '11-24' },
      ],
      ref
    );
    expect(sorted[0].personName).toBe('Ravi');
    expect(sorted[0].daysAway).toBe(1);
  });

  it('validates external URLs strictly and parses safe RSS news items', () => {
    expect(isSafeHttpUrl('https://feeds.bbci.co.uk/news/story')).toBe('https://feeds.bbci.co.uk/news/story');
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe('');
    expect(getSafeArticleHref('javascript:alert(1)')).toBeNull();
    expect(getSafeArticleHref('https://example.org/article')).toBe('https://example.org/article');

    const mockXml = `
      <rss><channel>
        <item>
          <title><![CDATA[Assistive &amp; Gaze Tech]]></title>
          <description><![CDATA[<p>Helpful update for patients.</p>]]></description>
          <link>https://example.org/news-1</link>
          <pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Unsafe Item</title>
          <description>Should be skipped</description>
          <link>javascript:evil()</link>
        </item>
      </channel></rss>
    `;
    const items = parseRssItems(mockXml, 'Example Source', 'technology');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Assistive & Gaze Tech');
    expect(items[0].summary).toBe('Helpful update for patients.');
    expect(items[0].url).toBe('https://example.org/news-1');
  });
});
