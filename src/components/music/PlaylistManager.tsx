import React, { useState } from 'react';
import { Check, Edit3, ListMusic, Play, Plus, Trash2, X } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { GazeButton } from '../gaze/GazeButton';

export const PlaylistManager: React.FC = () => {
  const {
    musicState,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    playTrack,
  } = useMusic();

  const [newName, setNewName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    musicState.playlists[0]?.id || null
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlaylist =
    musicState.playlists.find((p) => p.id === selectedPlaylistId) ||
    musicState.playlists[0] ||
    null;

  const notify = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-5">
      {message && (
        <div
          role="status"
          className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs font-medium text-teal-900 dark:text-teal-200"
        >
          {message}
        </div>
      )}

      {/* Create Playlist */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <span>Create New Playlist</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Playlist name (e.g. Morning Bhajans, Evening Calm)..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <GazeButton
            gazeId="pl_create_btn"
            variant="primary"
            sizeOverride="standard"
            onClick={() => {
              const res = createPlaylist(newName);
              if (!res.ok) {
                notify(res.error || 'Could not create playlist.');
                return;
              }
              setNewName('');
              if (res.id) setSelectedPlaylistId(res.id);
              notify('Playlist created.');
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Playlist</span>
          </GazeButton>
        </div>
      </div>

      {/* Playlists List & Details */}
      {musicState.playlists.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500">
          No playlists yet. Create a playlist above, then add any uploaded song to it.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-2.5">
            {musicState.playlists.map((pl) => {
              const active = selectedPlaylist?.id === pl.id;
              return (
                <div
                  key={pl.id}
                  className={`p-3.5 rounded-2xl border space-y-2 ${
                    active
                      ? 'border-teal-700 bg-teal-50/50 dark:bg-teal-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {renamingId === pl.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          renamePlaylist(pl.id, renameText);
                          setRenamingId(null);
                          notify('Playlist renamed.');
                        }}
                        aria-label="Save playlist name"
                        className="p-1.5 rounded-lg bg-teal-700 text-white cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        aria-label="Cancel rename"
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <GazeButton
                        gazeId={`pl_select_${pl.id}`}
                        variant={active ? 'selected' : 'subtle'}
                        sizeOverride="standard"
                        onClick={() => setSelectedPlaylistId(pl.id)}
                        className="flex-1 justify-between"
                      >
                        <span className="truncate">{pl.name}</span>
                        <span className="text-xs opacity-75">{pl.trackIds.length}</span>
                      </GazeButton>

                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(pl.id);
                          setRenameText(pl.name);
                        }}
                        aria-label={`Rename ${pl.name}`}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deletePlaylist(pl.id);
                          notify(`Deleted playlist "${pl.name}".`);
                        }}
                        aria-label={`Delete ${pl.name}`}
                        className="p-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedPlaylist && (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedPlaylist.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selectedPlaylist.trackIds.length} song(s) in playlist
                  </p>
                </div>
                {selectedPlaylist.trackIds.length > 0 && (
                  <GazeButton
                    gazeId="pl_play_all"
                    variant="primary"
                    sizeOverride="standard"
                    onClick={() =>
                      void playTrack(selectedPlaylist.trackIds[0], selectedPlaylist.trackIds)
                    }
                  >
                    <Play className="w-4 h-4" />
                    <span>Play Playlist</span>
                  </GazeButton>
                )}
              </div>

              {selectedPlaylist.trackIds.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No songs in this playlist yet. Add uploaded songs below.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedPlaylist.trackIds.map((tid) => {
                    const track = musicState.tracks.find((t) => t.id === tid);
                    if (!track) return null;
                    return (
                      <div
                        key={tid}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2"
                      >
                        <GazeButton
                          gazeId={`pl_track_play_${tid}`}
                          variant="default"
                          sizeOverride="standard"
                          onClick={() => void playTrack(tid, selectedPlaylist.trackIds)}
                          className="flex-1 justify-start text-left"
                        >
                          <Play className="w-3.5 h-3.5 shrink-0 text-teal-700" />
                          <span className="truncate font-semibold">{track.title}</span>
                          <span className="text-xs text-slate-500 truncate">· {track.artist}</span>
                        </GazeButton>
                        <GazeButton
                          gazeId={`pl_track_rm_${tid}`}
                          variant="subtle"
                          sizeOverride="standard"
                          onClick={() => removeTrackFromPlaylist(selectedPlaylist.id, tid)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </GazeButton>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add from Library */}
              {musicState.tracks.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Add Songs from Library:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {musicState.tracks
                      .filter((t) => !selectedPlaylist.trackIds.includes(t.id))
                      .map((track) => (
                        <GazeButton
                          key={track.id}
                          gazeId={`pl_add_${track.id}`}
                          sizeOverride="standard"
                          onClick={() => addTrackToPlaylist(selectedPlaylist.id, track.id)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{track.title}</span>
                        </GazeButton>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
