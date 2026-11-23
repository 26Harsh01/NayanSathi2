import React, { useEffect, useRef, useState } from 'react';
import { Eye, ImagePlus, Pause, Play, RotateCcw, Shuffle, Trash2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useGames } from '../../context/GamesContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  canSlideTile,
  generateSolvablePuzzle,
  isPuzzleSolved,
  slideTileIntoBlank,
} from '../../features/games/sliding-puzzle';
import { GazeButton } from '../gaze/GazeButton';

type PuzzleTheme = 'sunrise' | 'garden' | 'ocean' | string; // string assetId when custom photo chosen

const BUILTIN_THEMES: Record<
  'sunrise' | 'garden' | 'ocean',
  { label: string; emoji: string; colors: string[] }
> = {
  sunrise: {
    label: 'Warm Sunrise',
    emoji: '🌅',
    colors: [
      '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
      '#fdba74', '#fb923c', '#f97316', '#fca5a5',
      '#fda4af', '#f472b6', '#e879f9', '#c084fc',
      '#93c5fd', '#60a5fa', '#38bdf8',
    ],
  },
  garden: {
    label: 'Calm Garden',
    emoji: '🌿',
    colors: [
      '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
      '#d9f99d', '#bef264', '#a7f3d0', '#6ee7b7',
      '#99f6e4', '#5eead4', '#2dd4bf', '#bae6fd',
      '#7dd3fc', '#fde68a', '#fef08a',
    ],
  },
  ocean: {
    label: 'Deep Ocean',
    emoji: '🌊',
    colors: [
      '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
      '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee',
      '#ccfbf1', '#99f6e4', '#5eead4', '#c7d2fe',
      '#a5b4fc', '#818cf8', '#ddd6fe',
    ],
  },
};

export const PicturePuzzleGame: React.FC<{ onBackToLibrary: () => void }> = ({
  onBackToLibrary,
}) => {
  const { settings } = useAppState();
  const { gamesState, recordGameResult, addCustomPuzzlePhoto, removeCustomPuzzlePhoto } =
    useGames();
  const { photosMap, refreshPhotos } = useLifeHub();

  const [gridSize, setGridSize] = useState<3 | 4>(3);
  const [board, setBoard] = useState<number[]>(() => generateSolvablePuzzle(3));
  const [moves, setMoves] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<PuzzleTheme>('sunrise');
  const [selectedTileIdx, setSelectedTileIdx] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState(
    'Select any tile next to the empty space to slide it into place.'
  );
  const [recorded, setRecorded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const solved = isPuzzleSolved(board);
  const customPhotoUrl =
    selectedTheme !== 'sunrise' && selectedTheme !== 'garden' && selectedTheme !== 'ocean'
      ? photosMap[selectedTheme]
      : undefined;

  const restartPuzzle = (nextSize: 3 | 4 = gridSize) => {
    setGridSize(nextSize);
    setBoard(generateSolvablePuzzle(nextSize));
    setMoves(0);
    setPaused(false);
    setSelectedTileIdx(null);
    setRecorded(false);
    setStatusNote(
      `Shuffled ${nextSize}×${nextSize} sliding puzzle. Select any tile touching the open space.`
    );
  };

  useEffect(() => {
    if (!solved || recorded || moves === 0) return;
    setRecorded(true);
    setStatusNote(`Solved the ${gridSize}×${gridSize} Picture Puzzle in ${moves} moves!`);
    recordGameResult({
      gameId: 'picture-puzzle',
      outcome: 'completed',
      difficulty: gridSize === 4 ? 'hard' : 'easy',
      moves,
      puzzleSolved: true,
      summary: `Completed ${gridSize}×${gridSize} puzzle in ${moves} moves`,
    });
  }, [gridSize, moves, recordGameResult, recorded, solved]);

  const handleTilePress = (idx: number) => {
    if (paused || solved) return;
    const val = board[idx];

    if (val === 0) {
      // Blank clicked after selecting a tile: attempt slide
      if (selectedTileIdx !== null) {
        const slid = slideTileIntoBlank(board, gridSize, selectedTileIdx);
        if (slid) {
          setBoard(slid);
          setMoves((m) => m + 1);
          setSelectedTileIdx(null);
          setStatusNote(`Moved tile ${board[selectedTileIdx]} into the empty space.`);
        } else {
          setStatusNote('That tile is not next to the empty space.');
          setSelectedTileIdx(null);
        }
      }
      return;
    }

    if (canSlideTile(board, gridSize, idx)) {
      const slid = slideTileIntoBlank(board, gridSize, idx);
      if (slid) {
        setBoard(slid);
        setMoves((m) => m + 1);
        setSelectedTileIdx(null);
        setStatusNote(`Moved tile ${val}.`);
      }
      return;
    }

    setSelectedTileIdx(idx);
    setStatusNote(
      `Tile ${val} is not directly adjacent to the empty slot. Select a tile next to the open slot.`
    );
  };

  const readInstructions = () => {
    speakText(
      `Picture Puzzle. Arrange tiles from 1 to ${gridSize * gridSize - 1} in order. Look at or click any numbered tile right next to the empty space to slide it.`,
      {
        language: settings.communication.language,
        rate: settings.communication.speechRate,
      }
    );
  };

  const builtinTheme =
    selectedTheme === 'sunrise' || selectedTheme === 'garden' || selectedTheme === 'ocean'
      ? BUILTIN_THEMES[selectedTheme]
      : BUILTIN_THEMES.sunrise;

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Picture Puzzle</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Tap or dwell on a tile next to the blank slot to slide it — no dragging needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GazeButton gazeId="puz_audio_help" sizeOverride="standard" onClick={readInstructions}>
            <Volume2 className="w-4 h-4" />
            <span>Audio Instructions</span>
          </GazeButton>
          <GazeButton
            gazeId="puz_pause"
            sizeOverride="standard"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </GazeButton>
          <GazeButton
            gazeId="puz_shuffle"
            sizeOverride="standard"
            onClick={() => restartPuzzle(gridSize)}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </GazeButton>
          <GazeButton
            gazeId="puz_restart"
            sizeOverride="standard"
            onClick={() => restartPuzzle(gridSize)}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </GazeButton>
          <GazeButton
            gazeId="puz_back"
            variant="subtle"
            sizeOverride="standard"
            onClick={onBackToLibrary}
          >
            <span>All Games</span>
          </GazeButton>
        </div>
      </div>

      {/* Mode & Theme Selector */}
      <div className="flex flex-wrap items-center gap-2.5">
        <GazeButton
          gazeId="puz_size_3"
          variant={gridSize === 3 ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => restartPuzzle(3)}
        >
          <span>3×3 Easy (8 Tiles)</span>
        </GazeButton>
        <GazeButton
          gazeId="puz_size_4"
          variant={gridSize === 4 ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => restartPuzzle(4)}
        >
          <span>4×4 Challenge (15 Tiles)</span>
        </GazeButton>

        <GazeButton
          gazeId="puz_toggle_preview"
          variant={showPreview ? 'primary' : 'subtle'}
          sizeOverride="standard"
          onClick={() => setShowPreview((v) => !v)}
        >
          <Eye className="w-4 h-4" />
          <span>{showPreview ? 'Hide Preview' : 'Image Preview'}</span>
        </GazeButton>

        <div className="flex flex-wrap gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
          {(['sunrise', 'garden', 'ocean'] as const).map((key) => (
            <GazeButton
              key={key}
              gazeId={`puz_theme_${key}`}
              variant={selectedTheme === key ? 'primary' : 'default'}
              sizeOverride="standard"
              onClick={() => setSelectedTheme(key)}
            >
              <span>
                {BUILTIN_THEMES[key].emoji} {BUILTIN_THEMES[key].label}
              </span>
            </GazeButton>
          ))}
        </div>
      </div>

      {/* Custom Photo Picker */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Personal Photo Puzzles:
          </span>
          {gamesState.customPuzzlePhotoIds.map((id, idx) => (
            <div key={id} className="inline-flex items-center gap-1">
              <GazeButton
                gazeId={`puz_custom_${idx}`}
                variant={selectedTheme === id ? 'selected' : 'subtle'}
                sizeOverride="standard"
                onClick={() => setSelectedTheme(id)}
              >
                <span>Photo {idx + 1}</span>
              </GazeButton>
              <button
                type="button"
                aria-label="Remove puzzle photo"
                onClick={() => {
                  removeCustomPuzzlePhoto(id);
                  if (selectedTheme === id) setSelectedTheme('sunrise');
                }}
                className="p-1 text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const res = await addCustomPuzzlePhoto(file);
              if (res.ok && res.assetId) {
                await refreshPhotos();
                setSelectedTheme(res.assetId);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ImagePlus className="w-4 h-4" />
            <span>Upload Puzzle Image</span>
          </button>
        </div>
      </div>

      {/* Status & Counter Banner */}
      <div
        role="status"
        aria-live="polite"
        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <span className="font-semibold text-slate-900 dark:text-white">{statusNote}</span>
        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          Moves: {moves} · Solved: {gamesState.scores['picture-puzzle'].puzzlesSolved}
        </span>
      </div>

      {/* Board + Reference Image Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          {paused ? (
            <div className="p-10 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-4">
              <p className="text-lg font-bold">Picture Puzzle Paused</p>
              <GazeButton
                gazeId="puz_resume_center"
                variant="primary"
                onClick={() => setPaused(false)}
              >
                <Play className="w-4 h-4" />
                <span>Resume Game</span>
              </GazeButton>
            </div>
          ) : (
            <div
              className={`max-w-md mx-auto grid gap-2.5 ${
                gridSize === 4 ? 'grid-cols-4' : 'grid-cols-3'
              }`}
              role="grid"
              aria-label="Sliding Picture Puzzle"
            >
              {board.map((tileNum, idx) => {
                const isBlank = tileNum === 0;
                const movable = !isBlank && canSlideTile(board, gridSize, idx);
                const solvedRow = Math.floor((tileNum - 1) / gridSize);
                const solvedCol = (tileNum - 1) % gridSize;
                const pctStep = gridSize > 1 ? 100 / (gridSize - 1) : 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    data-gaze-target={`puz_tile_${idx}`}
                    data-gaze-label={isBlank ? 'Empty slot' : `Tile ${tileNum}`}
                    onClick={() => handleTilePress(idx)}
                    aria-label={isBlank ? 'Empty space' : `Tile ${tileNum}`}
                    className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer select-none ${
                      isBlank
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-700'
                        : selectedTileIdx === idx
                          ? 'border-teal-700 dark:border-teal-400 bg-white dark:bg-slate-900'
                          : movable
                            ? 'border-slate-900 dark:border-teal-500 bg-white dark:bg-slate-900'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                    style={
                      !isBlank && customPhotoUrl
                        ? {
                            backgroundImage: `url(${customPhotoUrl})`,
                            backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                            backgroundPosition: `${solvedCol * pctStep}% ${solvedRow * pctStep}%`,
                          }
                        : !isBlank
                          ? {
                              backgroundColor:
                                builtinTheme.colors[(tileNum - 1) % builtinTheme.colors.length],
                            }
                          : undefined
                    }
                  >
                    {!isBlank && (
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold tabular-nums ${
                          gridSize === 4 ? 'text-lg' : 'text-2xl'
                        } ${
                          customPhotoUrl
                            ? 'bg-slate-950/75 text-white text-sm'
                            : 'text-slate-900'
                        }`}
                      >
                        {tileNum}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showPreview && (
          <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Target Image Preview ({gridSize}×{gridSize})
            </h3>
            {customPhotoUrl ? (
              <img
                src={customPhotoUrl}
                alt="Completed puzzle reference"
                className="w-full max-w-[220px] aspect-square rounded-xl object-cover border border-slate-300 dark:border-slate-700"
              />
            ) : (
              <div
                className={`max-w-[220px] grid gap-1.5 ${
                  gridSize === 4 ? 'grid-cols-4' : 'grid-cols-3'
                }`}
              >
                {Array.from({ length: gridSize * gridSize - 1 }, (_, i) => i + 1).map((n) => (
                  <div
                    key={n}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold text-slate-900"
                    style={{
                      backgroundColor: builtinTheme.colors[(n - 1) % builtinTheme.colors.length],
                    }}
                  >
                    {n}
                  </div>
                ))}
                <div className="aspect-square rounded-lg border border-dashed border-slate-300 dark:border-slate-700" />
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Match tiles left-to-right from 1 to {gridSize * gridSize - 1} with the empty space at the bottom-right corner.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
};
