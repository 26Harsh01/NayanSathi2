import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  Heart,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useLifeHub } from '../context/LifeHubContext';
import {
  calculateAgeFromDob,
  PERSONAL_INTEREST_OPTIONS,
} from '../features/communication/personal-autonomy';
import { getAvailableVoices, type VoiceSummary } from '../features/communication/text-to-speech';
import type { ButtonSize, FavouriteItem, Language } from '../types';

interface MyProfilePageProps {
  onNavigate: (route: AppRoute) => void;
}

export const MyProfilePage: React.FC<MyProfilePageProps> = ({ onNavigate }) => {
  const {
    activePatientId,
    patientAccounts,
    switchPatient,
    createNewPatient,
    profile,
    updateProfile,
    settings,
    updateSettings,
    setLanguage,
    phrases,
  } = useAppState();
  const {
    state,
    photosMap,
    uploadPhotoAsset,
    toggleInterest,
    addFavouriteItem,
    deleteFavouriteItem,
    getPersonalIntroText,
  } = useLifeHub();

  const [newAccountName, setNewAccountName] = useState('');
  const [customInterest, setCustomInterest] = useState('');
  const [favCategory, setFavCategory] = useState<FavouriteItem['category']>('food');
  const [favLabel, setFavLabel] = useState('');
  const [favNotes, setFavNotes] = useState('');
  const [favPhotoId, setFavPhotoId] = useState<string | undefined>(undefined);
  const [showPrivateAge, setShowPrivateAge] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [enVoices, setEnVoices] = useState<VoiceSummary[]>([]);
  const [hiVoices, setHiVoices] = useState<VoiceSummary[]>([]);

  const avatarFileRef = useRef<HTMLInputElement>(null);
  const favFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadVoices = () => {
      setEnVoices(getAvailableVoices('en'));
      setHiVoices(getAvailableVoices('hi'));
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const calculatedAge = calculateAgeFromDob(profile.dateOfBirth);
  const avatarUrl = profile.photoAssetId ? photosMap[profile.photoAssetId] : undefined;
  const favPhrases = phrases.filter((p) => p.isFavorite);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            My Profile & Identity
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Personal identity, private preferences, interests, favourite things, and isolated user profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('life-hub')}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
        >
          Open Life Hub
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-sm font-medium text-teal-800 dark:text-teal-200"
        >
          {feedback}
        </div>
      )}

      {/* Multi-User Profile Isolation Switcher */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Active User Profile (Isolated Local Storage & Media)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">ID: {activePatientId}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {patientAccounts.map((acct) => (
            <button
              key={acct.id}
              type="button"
              onClick={() => {
                switchPatient(acct.id);
                notify(`Switched active profile to "${acct.displayName}".`);
              }}
              className={`px-3.5 py-2 rounded-xl border text-sm font-semibold cursor-pointer ${
                acct.id === activePatientId
                  ? 'bg-teal-700 text-white border-teal-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              {acct.displayName}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <input
            type="text"
            placeholder="Create new isolated user profile (name)..."
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!newAccountName.trim()) return;
              const created = createNewPatient(newAccountName.trim());
              setNewAccountName('');
              notify(`Created isolated profile for "${created.displayName}".`);
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User Profile</span>
          </button>
        </div>
      </section>

      {/* Personal Information & Photo */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile.preferredName || profile.name}
              className="w-20 h-20 rounded-2xl object-cover border border-slate-300 dark:border-slate-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-slate-900 dark:bg-teal-700 text-white text-xl font-bold flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {profile.name || 'Guest User'}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const assetId = await uploadPhotoAsset('avatar', file);
                  updateProfile((prev) => ({ ...prev, photoAssetId: assetId }));
                  notify('Profile photo saved locally in IndexedDB.');
                }}
              />
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Profile Photo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Full Name</span>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateProfile((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Preferred Name</span>
            <input
              type="text"
              value={profile.preferredName}
              onChange={(e) =>
                updateProfile((prev) => ({ ...prev, preferredName: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Date of Birth (Private)</span>
              <button
                type="button"
                onClick={() => setShowPrivateAge(!showPrivateAge)}
                className="text-[11px] text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>{showPrivateAge ? 'Hide Age' : 'Show Age'}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={profile.dateOfBirth || ''}
                onChange={(e) =>
                  updateProfile((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                }
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              {showPrivateAge && calculatedAge !== null && (
                <span className="text-xs font-mono tabular-nums font-semibold">
                  {calculatedAge} yrs
                </span>
              )}
            </div>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Occupation</span>
            <input
              type="text"
              value={profile.occupation || ''}
              onChange={(e) =>
                updateProfile((prev) => ({ ...prev, occupation: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Education</span>
            <input
              type="text"
              value={profile.education || ''}
              onChange={(e) =>
                updateProfile((prev) => ({ ...prev, education: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">City</span>
            <input
              type="text"
              value={profile.city || ''}
              onChange={(e) => updateProfile((prev) => ({ ...prev, city: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">State</span>
            <input
              type="text"
              value={profile.state || ''}
              onChange={(e) => updateProfile((prev) => ({ ...prev, state: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Country</span>
            <input
              type="text"
              value={profile.country || ''}
              onChange={(e) => updateProfile((prev) => ({ ...prev, country: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-xs font-semibold">Personal Introduction Statement</span>
          <textarea
            rows={2}
            value={profile.personalIntroduction || ''}
            onChange={(e) =>
              updateProfile((prev) => ({ ...prev, personalIntroduction: e.target.value }))
            }
            placeholder={getPersonalIntroText()}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={settings.privacy.hidePrivateIdentityFields}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                privacy: { ...prev.privacy, hidePrivateIdentityFields: e.target.checked },
              }))
            }
            className="w-4 h-4 accent-teal-600"
          />
          <span>
            Keep date of birth, age, and location fields private (not displayed on Public Interaction cards)
          </span>
        </label>
      </section>

      {/* Personal Interests & Favourite Things */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Personal Interests ({state.interests.length})
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...PERSONAL_INTEREST_OPTIONS, ...state.interests])).map(
              (interest) => {
                const selected = state.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      selected
                        ? 'bg-teal-700 text-white border-teal-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {interest}
                  </button>
                );
              }
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Add custom interest..."
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!customInterest.trim()) return;
                toggleInterest(customInterest.trim());
                setCustomInterest('');
              }}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
            >
              Add
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-teal-700 dark:text-teal-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              My Favourite Things ({state.favourites.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
            <select
              value={favCategory}
              onChange={(e) => setFavCategory(e.target.value as FavouriteItem['category'])}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="food">Favourite Food</option>
              <option value="music">Favourite Music</option>
              <option value="movie">Favourite Movie</option>
              <option value="sport">Favourite Sport</option>
              <option value="colour">Favourite Colour</option>
              <option value="activity">Favourite Activity</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Name / detail *"
              value={favLabel}
              onChange={(e) => setFavLabel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="text"
              placeholder="Optional note"
              value={favNotes}
              onChange={(e) => setFavNotes(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <div className="flex gap-2">
              <input
                ref={favFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const id = await uploadPhotoAsset('fav', f);
                  setFavPhotoId(id);
                }}
              />
              <button
                type="button"
                onClick={() => favFileRef.current?.click()}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                <span>{favPhotoId ? 'Photo Ready' : 'Photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!favLabel.trim()) return;
                  addFavouriteItem({
                    category: favCategory,
                    label: favLabel.trim(),
                    notes: favNotes.trim() || undefined,
                    photoAssetId: favPhotoId,
                  });
                  setFavLabel('');
                  setFavNotes('');
                  setFavPhotoId(undefined);
                }}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {state.favourites.map((item) => {
              const photoUrl = item.photoAssetId ? photosMap[item.photoAssetId] : undefined;
              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    {photoUrl && (
                      <img
                        src={photoUrl}
                        alt={item.label}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {item.category}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteFavouriteItem(item.id)}
                    aria-label={`Remove ${item.label}`}
                    className="p-1 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Communication Profile */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Communication Profile
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Primary Language</span>
            <select
              value={settings.communication.language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Secondary Language</span>
            <select
              value={settings.communication.secondaryLanguage}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: {
                    ...prev.communication,
                    secondaryLanguage: e.target.value as Language,
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="hi">हिंदी (Hindi)</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Preferred Sentence Length</span>
            <select
              value={settings.communication.preferredSentenceLength}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: {
                    ...prev.communication,
                    preferredSentenceLength: e.target.value as
                      | 'concise'
                      | 'balanced'
                      | 'detailed',
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="concise">Short & Direct</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Preferred Voice ({settings.communication.language === 'hi' ? 'Hindi' : 'English'})</span>
            <select
              value={
                settings.communication.language === 'hi'
                  ? settings.communication.preferredVoiceHi
                  : settings.communication.preferredVoiceEn
              }
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: {
                    ...prev.communication,
                    ...(settings.communication.language === 'hi'
                      ? { preferredVoiceHi: e.target.value }
                      : { preferredVoiceEn: e.target.value }),
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">System Auto</option>
              {(settings.communication.language === 'hi' ? hiVoices : enVoices).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">
              Speech Speed ({settings.communication.speechRate.toFixed(2)}x)
            </span>
            <input
              type="range"
              min={0.6}
              max={1.5}
              step={0.05}
              value={settings.communication.speechRate}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  communication: {
                    ...prev.communication,
                    speechRate: Number(e.target.value),
                  },
                }))
              }
              className="w-full accent-teal-600 mt-2"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold">Preferred Button Size</span>
            <select
              value={settings.interface.buttonSize}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  interface: { ...prev.interface, buttonSize: e.target.value as ButtonSize },
                }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra-Large</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-xs font-semibold">
            Communication Instructions (Shared in Passport & Caregiver View)
          </span>
          <textarea
            rows={2}
            value={settings.communication.communicationInstructions}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                communication: {
                  ...prev.communication,
                  communicationInstructions: e.target.value,
                },
              }))
            }
            placeholder="e.g. Please ask one question at a time and allow extra response time."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </label>

        {favPhrases.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">
              Starred Favourite Phrases ({favPhrases.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {favPhrases.slice(0, 8).map((p) => (
                <span
                  key={p.id}
                  className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                >
                  {settings.communication.language === 'hi' ? p.textHi : p.textEn}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
