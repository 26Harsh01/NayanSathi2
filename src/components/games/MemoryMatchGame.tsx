import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pause, Play, RotateCcw, Trash2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { speakText } from '../../features/communication/text-to-speech';
import { GazeButton } from '../gaze/GazeButton';

type DeckCategory = 'animals' | 'fruits' | 'objects' | 'custom';

interface CardDefinition {
  key: string;
  label: string;
  symbol?: string;
  assetId?: string;
}

interface BoardCard extends CardDefinition {
  uid: string;
  matched: boolean;
}

const ANIMAL_DECK: CardDefinition[] = [
  { key: 'cat', label: 'Cat', symbol: '🐱' },
  { key: 'dog', label: 'Dog', symbol: '🐶' },
  { key: 'bird', label: 'Bird', symbol: '🐦' },
  { key: 'fish', label: 'Fish', symbol: '🐟' },
  { key: 'rabbit', label: 'Rabbit', symbol: '🐰' },
  { key: 'turtle', label: 'Turtle', symbol: '🐢' },
  { key: 'elephant', label: 'Elephant', symbol: '🐘' },
  { key: 'owl', label: 'Owl', symbol: '🦉' },
];

const FRUIT_DECK: CardDefinition[] = [
  { key: 'apple', label: 'Apple', symbol: '🍎' },
  { key: 'banana', label: 'Banana', symbol: '🍌' },
  { key: 'mango', label: 'Mango', symbol: '🥭' },
  { key: 'grapes', label: 'Grapes', symbol: '🍇' },
  { key: 'orange', label: 'Orange', symbol: '🍊' },
  { key: 'watermelon', label: 'Melon', symbol: '🍉' },
  { key: 'strawberry', label: 'Berry', symbol: '🍓' },
  { key: 'pineapple', label: 'Pineapple', symbol: '🍍' },
];

const OBJECT_DECK: CardDefinition[] = [
  { key: 'cup', label: 'Cup', symbol: '☕' },
  { key: 'book', label: 'Book', symbol: '📖' },
  { key: 'key', label: 'Key', symbol: '🔑' },
  { key: 'clock', label: 'Clock', symbol: '⏰' },
  { key: 'umbrella', label: 'Umbrella', symbol: '☂️' },
  { key: 'lamp', label: 'Lamp', symbol: '💡' },
  { key: 'music', label: 'Guitar', symbol: '🎸' },
  { key: 'bell', label: 'Bell', symbol: '🔔' },
];

function buildShuffledBoard(defs: CardDefinition[], pairCount: number): BoardCard[] {
  const chosen = defs.slice(0, pairCount);
  const doubled = [...chosen, ...chosen].map((c, idx) => ({
    ...c,
    uid: `${c.key}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    matched: false,
  }));
  for (let i = doubled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
  }
  return doubled;
}

export const MemoryMatchGame: React.FC<{ onBackToLibrary: () => void }> = ({ onBackToLibrary }) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult, addCustomMemoryCard, removeCustomMemoryCard } = useGames();
  const { photosMap, refreshPhotos } = useLifeHub();

  const [category, setCategory] = useState<DeckCategory>('animals');
  const [pairCount, setPairCount] = useState<number>(6);
  const [cards, setCards] = useState<BoardCard[]>(() => buildShuffledBoard(ANIMAL_DECK, 6));
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [paused, setPaused] = useState(false);
  const [checkingMismatch, setCheckingMismatch] = useState(false);
  const [confirmedMsg, setConfirmedMsg] = useState('Select two cards to find a matching pair.');
  const [recorded, setRecorded] = useState(false);

  const [customLabel, setCustomLabel] = useState('');
  const [customMsg, setCustomMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const getDeckDefs = (cat: DeckCategory): CardDefinition[] => {
    if (cat === 'animals') return ANIMAL_DECK;
    if (cat === 'fruits') return FRUIT_DECK;
    if (cat === 'objects') return OBJECT_DECK;
    const customDefs: CardDefinition[] = gamesState.customMemoryCards.map((c) => ({
      key: c.id,
      label: c.label,
      assetId: c.assetId,
    }));
    return customDefs.length >= 2 ? customDefs : ANIMAL_DECK;
  };

  const restartWith = (nextCat: DeckCategory, nextPairs: number) => {
    const defs = getDeckDefs(nextCat);
    const effectivePairs = Math.min(nextPairs, defs.length);
    setCategory(nextCat);
    setPairCount(effectivePairs);
    setCards(buildShuffledBoard(defs, effectivePairs));
    setFlippedUids([]);
    setMoves(0);
    setPaused(false);
    setCheckingMismatch(false);
    setRecorded(false);
    setConfirmedMsg(`Started ${nextCat} deck with ${effectivePairs} pairs.`);
  };

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const totalPairs = cards.length / 2;
  const completed = cards.length > 0 && cards.every((c) => c.matched);

  useEffect(() => {
    if (!completed || recorded) return;
    setRecorded(true);
    setConfirmedMsg(`Completed all ${totalPairs} pairs in ${moves} moves!`);
    recordGameResult({
      gameId: 'memory-match',
      outcome: 'completed',
      difficulty: totalPairs >= 8 ? 'hard' : totalPairs >= 6 ? 'medium' : 'easy',
      moves,
      puzzleSolved: true,
      summary: `Matched ${totalPairs} ${category} pairs in ${moves} moves`,
    });
  }, [category, completed, moves, recordGameResult, recorded, totalPairs]);

  const handleCardSelect = (card: BoardCard) => {
    if (paused || checkingMismatch || card.matched || flippedUids.includes(card.uid)) return;

    const nextFlipped = [...flippedUids, card.uid];
    setFlippedUids(nextFlipped);
    setConfirmedMsg(`Revealed: ${card.label}.`);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const first = cards.find((c) => c.uid === nextFlipped[0]);
      const second = card;
      if (first && first.key === second.key) {
        setCards((prev) =>
          prev.map((c) =>
            c.uid === first.uid || c.uid === second.uid ? { ...c, matched: true } : c
          )
        );
        setFlippedUids([]);
        setConfirmedMsg(`Matched pair: ${second.label}!`);
      } else {
        setCheckingMismatch(true);
        window.setTimeout(() => {
          setFlippedUids([]);
          setCheckingMismatch(false);
          setConfirmedMsg('Not a match. Try selecting another pair.');
        }, 900);
      }
    }
  };

  const readInstructions = () => {
    speakText(
      'Memory Match. Select a card to flip it over, then select a second card to match the picture pair. Choose Animal, Fruit, Object, or your own custom photo cards.',
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Memory Match</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Match picture pairs at your own pace with zero countdown timer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="mem_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton gazeId="mem_pause" sizeOverride="standard" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="mem_restart"
            sizeOverride="standard"
            onClick={() => restartWith(category, pairCount)}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton gazeId="mem_back" variant="subtle" sizeOverride="standard" onClick={onBackToLibrary}>
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Category & Pair Count */}
      <div className="flex flex-wrap items-center gap-2.5">
        {(
          [
            ['animals', 'Animals'],
            ['fruits', 'Fruits'],
            ['objects', 'Objects'],
            ['custom', `Custom Pictures (${gamesState.customMemoryCards.length})`],
          ] as [DeckCategory, string][]
        ).map(([cat, label]) => (
          <GazeButton
            key={cat}
            gazeId={`mem_cat_${cat}`}
            variant={category === cat ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => restartWith(cat, pairCount)}
          >
            <span>{label}</span>
          </GazeButton>
        ))}

        <div className="flex gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          {[4, 6, 8].map((count) => (
            <GazeButton
              key={count}
              gazeId={`mem_pairs_${count}`}
              variant={pairCount === count ? 'primary' : 'default'}
              sizeOverride="standard"
              onClick={() => restartWith(category, count)}
            >
              <span>{count} Pairs</span>
            </GazeButton>
          ))}
        </div>
      </div>

      {/* Custom Picture Card Uploader */}
      {category === 'custom' && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Upload at least 2 custom picture cards to build a personal Memory Match deck (stored locally per patient in IndexedDB).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Card label (e.g. Garden, Family Dog)..."
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const res = await addCustomMemoryCard(customLabel || file.name.replace(/\.[^.]+$/, ''), file);
                if (!res.ok) {
                  setCustomMsg(res.error || 'Could not add card.');
                  return;
                }
                await refreshPhotos();
                setCustomLabel('');
                setCustomMsg('Custom card saved! Upload at least 2 cards and click Restart.');
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              <span>Upload Card Picture</span>
            </button>
          </div>
          {customMsg && <p className="text-xs text-teal-700 dark:text-teal-400">{customMsg}</p>}
          {gamesState.customMemoryCards.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gamesState.customMemoryCards.map((c) => (
                <div
                  key={c.id}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs"
                >
                  {photosMap[c.assetId] && (
                    <img
                      src={photosMap[c.assetId]}
                      alt={c.label}
                      className="w-6 h-6 rounded object-cover"
                    />
                  )}
                  <span>{c.label}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomMemoryCard(c.id)}
                    aria-label={`Remove ${c.label}`}
                    className="text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Banner */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{confirmedMsg}</span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Moves: {moves} · Pairs Matched: {matchedPairs}/{totalPairs}
        </span>
      </div>

      {/* Card Grid */}
      {paused ? (
        <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
          <p className="text-lg font-bold">Memory Match Paused</p>
          <GazeButton gazeId="mem_resume_center" variant="primary" onClick={() => setPaused(false)}>
            <Play className="w-4 h-4" />
            <span>Resume Game</span>
          </GazeButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {cards.map((card, idx) => {
            const revealed = card.matched || flippedUids.includes(card.uid);
            const imgUrl = card.assetId ? photosMap[card.assetId] : undefined;
            return (
              <button
                key={card.uid}
                type="button"
                data-gaze-target={`mem_card_${idx}`}
                data-gaze-label={revealed ? card.label : `Card ${idx + 1}`}
                disabled={card.matched || flippedUids.includes(card.uid)}
                onClick={() => handleCardSelect(card)}
                className={`min-h-[108px] rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-2 cursor-pointer disabled:cursor-default ${
                  card.matched
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-700'
                    : revealed
                      ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-teal-500'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                }`}
              >
                {revealed ? (
                  <>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={card.label}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-3xl leading-none" aria-hidden="true">
                        {card.symbol || '★'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {card.label}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    Card {idx + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
