import React, { useMemo, useRef, useState } from 'react';
import { Heart, Pause, Play, Sparkles, Trash2, Upload } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import { useMusic } from '../../context/MusicContext';
import { MUSIC_CATEGORIES } from '../../features/storage/games-music-storage';
import type { MusicCategoryId } from '../../types';
import type { AppRoute } from '../layout/AppShell';
import { GazeButton } from '../gaze/GazeButton';
import { AudioPlayer } from './AudioPlayer';
import { PlaylistManager } from './PlaylistManager';
import { RelaxationCorner } from './RelaxationCorner';

type MusicViewTab =
  | 'all'
  | 'favourites'
  | 'playlists'
  | 'relaxation'
  | MusicCategoryId;

interface MusicDashboardProps {
  onNavigate: (route: AppRoute) => void;
}

export const MusicDashboard: React.FC<MusicDashboardProps> = ({ onNavigate }) => {
  const { settings } = useAppState();
  const { hubPrefs } = useHubPreferences();
  const {
    musicState,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    toggleFavouriteTrack,
    uploadAudioTrack,
    removeTrack,
  } = useMusic();

  const lang = settings.communication.language;
  const [activeTab, setActiveTab] = useState<MusicViewTab>('all');
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Upload state
  const [upTitle, setUpTitle] = useState('');
  const [upArtist, setUpArtist] = useState('');
  const [upAlbum, setUpAlbum] = useState('');
  const [upCategory, setUpCategory] = useState<MusicCategoryId>('hindi_songs');
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upAuthorized, setUpAuthorized] = useState(false);
  const [upMessage, setUpMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visibleCategories = useMemo(() => {
    const enabled = MUSIC_CATEGORIES.filter(
      (c) => !hubPrefs.disabledMusicCategories.includes(c.id)
    );
    // Prioritize patient's favourite music genres first
    return [...enabled].sort((a, b) => {
      const aFav = musicState.preferences.favouriteGenres.includes(a.id) ? 0 : 1;
      const bFav = musicState.preferences.favouriteGenres.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [hubPrefs.disabledMusicCategories, musicState.preferences.favouriteGenres]);

  const filteredTracks = useMemo(() => {
    if (activeTab === 'all') return musicState.tracks;
    if (activeTab === 'favourites') {
      const favSet = new Set(musicState.favouriteTrackIds);
      return musicState.tracks.filter((t) => favSet.has(t.id));
    }
    if (activeTab === 'playlists' || activeTab === 'relaxation') return [];
    return musicState.tracks.filter((t) => t.category === activeTab);
  }, [activeTab, musicState.favouriteTrackIds, musicState.tracks]);

  const handleUploadSubmit = async () => {
    if (!upFile) {
      setUpMessage('Please choose an MP3, WAV, or OGG audio file first.');
      return;
    }
    const res = await uploadAudioTrack({
      file: upFile,
      title: upTitle || upFile.name.replace(/\.[^.]+$/, ''),
      artist: upArtist,
      album: upAlbum,
      category: upCategory,
      authorizedConfirmed: upAuthorized,
    });
    if (!res.ok) {
      setUpMessage(res.error || 'Could not save audio file.');
      return;
    }
    setUpTitle('');
    setUpArtist('');
    setUpAlbum('');
    setUpFile(null);
    setUpAuthorized(false);
    if (fileRef.current) fileRef.current.value = '';
    setUpMessage('Track saved securely in your browser IndexedDB library.');
  };

  return (
    <div className="space-y-6">
      {/* Persistent Audio Player Card */}
      <AudioPlayer />

      {/* Category & View Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <GazeButton
            gazeId="music_tab_all"
            variant={activeTab === 'all' ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => setActiveTab('all')}
          >
            <span>All Songs ({musicState.tracks.length})</span>
          </GazeButton>

          {!hubPrefs.disabledMusicCategories.includes('favourites') && (
            <GazeButton
              gazeId="music_tab_favourites"
              variant={activeTab === 'favourites' ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={() => setActiveTab('favourites')}
            >
              <span>Favourite Songs ({musicState.favouriteTrackIds.length})</span>
            </GazeButton>
          )}

          {!hubPrefs.disabledMusicCategories.includes('relaxation') && (
            <GazeButton
              gazeId="music_tab_relaxation"
              variant={activeTab === 'relaxation' ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={() => setActiveTab('relaxation')}
            >
              <span>Relaxation Corner</span>
            </GazeButton>
          )}

          <GazeButton
            gazeId="music_tab_playlists"
            variant={activeTab === 'playlists' ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => setActiveTab('playlists')}
          >
            <span>My Playlists ({musicState.playlists.length})</span>
          </GazeButton>

          {visibleCategories.map((cat) => (
            <GazeButton
              key={cat.id}
              gazeId={`music_cat_${cat.id}`}
              variant={activeTab === cat.id ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={() => setActiveTab(cat.id)}
            >
              <span>{lang === 'hi' ? cat.labelHi : cat.labelEn}</span>
            </GazeButton>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <GazeButton
            gazeId="music_toggle_upload"
            variant={showUploadForm ? 'primary' : 'default'}
            sizeOverride="standard"
            onClick={() => setShowUploadForm((v) => !v)}
          >
            <Upload className="w-4 h-4" />
            <span>Upload MP3 / WAV / OGG</span>
          </GazeButton>
          <GazeButton
            gazeId="music_profile_prefs"
            variant="subtle"
            sizeOverride="standard"
            onClick={() => onNavigate('profile')}
          >
            <Sparkles className="w-4 h-4" />
            <span>Preferences</span>
          </GazeButton>
        </div>
      </div>

      {/* Audio Upload Panel (IndexedDB per-patient isolated) */}
      {showUploadForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Upload Personal Audio File (Stored Privately in Browser IndexedDB)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <input
              type="text"
              placeholder="Song / Recording Title"
              value={upTitle}
              onChange={(e) => setUpTitle(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="text"
              placeholder="Artist / Singer (optional)"
              value={upArtist}
              onChange={(e) => setUpArtist(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="text"
              placeholder="Album / Note (optional)"
              value={upAlbum}
              onChange={(e) => setUpAlbum(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <select
              value={upCategory}
              onChange={(e) => setUpCategory(e.target.value as MusicCategoryId)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              {MUSIC_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
              onChange={(e) => setUpFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={upAuthorized}
                onChange={(e) => setUpAuthorized(e.target.checked)}
                className="w-4 h-4 accent-teal-600"
              />
              <span>I own or am authorized to upload and play this permitted audio file.</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleUploadSubmit()}
              className="px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold cursor-pointer"
            >
              Save to My Library
            </button>
            {upMessage && (
              <span className="text-xs font-medium text-teal-800 dark:text-teal-300">
                {upMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Subview Content */}
      {activeTab === 'relaxation' ? (
        <RelaxationCorner />
      ) : activeTab === 'playlists' ? (
        <PlaylistManager />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeTab === 'all'
                ? 'All Uploaded Songs'
                : activeTab === 'favourites'
                  ? 'Favourite Songs'
                  : MUSIC_CATEGORIES.find((c) => c.id === activeTab)?.labelEn || 'Tracks'}
            </h3>
            <span className="text-xs text-slate-500">
              {filteredTracks.length} track(s)
            </span>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No uploaded audio files in this category yet. Upload your permitted MP3, WAV, or OGG files — or open the Relaxation Corner for instant ambient soundscapes.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <GazeButton
                  gazeId="music_empty_upload"
                  variant="primary"
                  sizeOverride="standard"
                  onClick={() => setShowUploadForm(true)}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Audio File</span>
                </GazeButton>
                <GazeButton
                  gazeId="music_empty_relax"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={() => setActiveTab('relaxation')}
                >
                  <span>Open Relaxation Corner</span>
                </GazeButton>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                const isFav = musicState.favouriteTrackIds.includes(track.id);
                const queueIds = filteredTracks.map((t) => t.id);
                return (
                  <div
                    key={track.id}
                    className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                      isActive
                        ? 'border-teal-700 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {track.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {track.artist} · {track.category.replace(/_/g, ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <GazeButton
                        gazeId={`track_play_${track.id}`}
                        variant={isActive ? 'selected' : 'primary'}
                        sizeOverride="standard"
                        onClick={() => {
                          if (isActive) {
                            void togglePlayPause();
                          } else {
                            void playTrack(track.id, queueIds);
                          }
                        }}
                      >
                        {isActive && isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>{isActive && isPlaying ? 'Pause' : 'Play'}</span>
                      </GazeButton>

                      <GazeButton
                        gazeId={`track_fav_${track.id}`}
                        variant={isFav ? 'selected' : 'default'}
                        sizeOverride="standard"
                        onClick={() => toggleFavouriteTrack(track.id)}
                        aria-label="Toggle favourite"
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                      </GazeButton>

                      <GazeButton
                        gazeId={`track_del_${track.id}`}
                        variant="subtle"
                        sizeOverride="standard"
                        onClick={() => void removeTrack(track.id)}
                        aria-label={`Remove ${track.title}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </GazeButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
