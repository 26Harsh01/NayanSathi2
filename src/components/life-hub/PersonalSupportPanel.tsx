import React, { useRef, useState } from 'react';
import {
  FileText,
  ImagePlus,
  Mail,
  MessageCircleHeart,
  Phone,
  Plus,
  Printer,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { GazeButton } from '../gaze/GazeButton';
import { MY_VOICE_MY_RULES_PHRASES } from '../../features/communication/personal-autonomy';
import { speakText } from '../../features/communication/text-to-speech';
import type { ImportantPerson } from '../../types';

export type SupportSubTab = 'passport' | 'people' | 'intro' | 'rules';

interface PersonalSupportPanelProps {
  initialTab?: SupportSubTab;
}

export const PersonalSupportPanel: React.FC<PersonalSupportPanelProps> = ({
  initialTab = 'passport',
}) => {
  const { profile, updateProfile, settings } = useAppState();
  const {
    state,
    photosMap,
    uploadPhotoAsset,
    updatePassport,
    addImportantPerson,
    deleteImportantPerson,
    getPersonalIntroText,
  } = useLifeHub();
  const { addContact } = useEmergencyContacts();

  const lang = settings.communication.language;
  const [subTab, setSubTab] = useState<SupportSubTab>(initialTab);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [passportDraft, setPassportDraft] = useState(() => state.passport);
  const [editingPassport, setEditingPassport] = useState(false);

  // Important People form
  const [personName, setPersonName] = useState('');
  const [personRel, setPersonRel] = useState('');
  const [personCat, setPersonCat] = useState<ImportantPerson['category']>('family');
  const [personPhone, setPersonPhone] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [personPhrases, setPersonPhrases] = useState('');
  const [personPhotoId, setPersonPhotoId] = useState<string | undefined>(undefined);
  const [linkAsEmergency, setLinkAsEmergency] = useState(false);
  const personFileRef = useRef<HTMLInputElement>(null);

  // Personal intro
  const [introDraft, setIntroDraft] = useState(() => profile.personalIntroduction || '');

  const speakPhrase = (text: string) => {
    speakText(text, {
      language: lang,
      rate: settings.communication.speechRate,
      preferredVoiceURI:
        lang === 'hi'
          ? settings.communication.preferredVoiceHi
          : settings.communication.preferredVoiceEn,
    });
  };

  const showMsg = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2.5">
        <GazeButton
          gazeId="supp_tab_passport"
          variant={subTab === 'passport' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setPassportDraft(state.passport);
            setSubTab('passport');
          }}
        >
          <FileText className="w-4 h-4" />
          <span>Communication Passport</span>
        </GazeButton>

        <GazeButton
          gazeId="supp_tab_people"
          variant={subTab === 'people' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('people')}
        >
          <Users className="w-4 h-4" />
          <span>My Important People</span>
        </GazeButton>

        <GazeButton
          gazeId="supp_tab_intro"
          variant={subTab === 'intro' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setIntroDraft(profile.personalIntroduction || '');
            setSubTab('intro');
          }}
        >
          <MessageCircleHeart className="w-4 h-4" />
          <span>Personal Introduction</span>
        </GazeButton>

        <GazeButton
          gazeId="supp_tab_rules"
          variant={subTab === 'rules' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('rules')}
        >
          <Shield className="w-4 h-4" />
          <span>My Voice, My Rules</span>
        </GazeButton>
      </div>

      {feedback && (
        <div
          role="status"
          className="no-print p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-sm font-medium text-teal-900 dark:text-teal-200"
        >
          {feedback}
        </div>
      )}

      {/* 14. MY COMMUNICATION PASSPORT */}
      {subTab === 'passport' && (
        <div className="print-only-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Communication Passport — {profile.preferredName || profile.name || 'User'}
              </h3>
              <p className="text-xs text-slate-500">
                Portable guide explaining how I communicate and what supports me best.
              </p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPassportDraft(state.passport);
                  setEditingPassport(!editingPassport);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {editingPassport ? 'Close Editor' : 'Edit Passport'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Export PDF</span>
              </button>
            </div>
          </div>

          {editingPassport ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {(
                [
                  ['howICommunicate', 'How I Communicate'],
                  ['preferredLanguage', 'Preferred Language'],
                  ['howISayYesNo', 'How I Say Yes / No'],
                  ['responseTimeNeeded', 'Time Needed to Respond'],
                  ['communicationPreferences', 'Communication Preferences'],
                  ['whatMakesMeComfortable', 'What Makes Me Comfortable'],
                  ['whatHelpsMeCommunicate', 'What Helps Me Communicate Better'],
                  ['caregiverInstructions', 'Special Caregiver Instructions'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="space-y-1">
                  <span className="text-xs font-semibold">{label}</span>
                  <textarea
                    rows={2}
                    value={passportDraft[field]}
                    onChange={(e) =>
                      setPassportDraft((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              ))}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    updatePassport(passportDraft);
                    setEditingPassport(false);
                    showMsg('Communication Passport updated.');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold cursor-pointer"
                >
                  Save Passport
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {(
                [
                  ['howICommunicate', 'How I Communicate'],
                  ['preferredLanguage', 'Preferred Language'],
                  ['howISayYesNo', 'How I Say Yes / No'],
                  ['responseTimeNeeded', 'Time Needed to Respond'],
                  ['communicationPreferences', 'Communication Preferences'],
                  ['whatMakesMeComfortable', 'What Makes Me Comfortable'],
                  ['whatHelpsMeCommunicate', 'What Helps Me Communicate Better'],
                  ['caregiverInstructions', 'Special Caregiver Instructions'],
                ] as const
              ).map(([field, label]) => (
                <div
                  key={field}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1"
                >
                  <dt className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {label}
                  </dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {state.passport[field] || 'Not specified'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* 15. MY IMPORTANT PEOPLE */}
      {subTab === 'people' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Add Important Person</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <input
                type="text"
                placeholder="Full name *"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Relationship (e.g. Sister, Dr. Mehta)"
                value={personRel}
                onChange={(e) => setPersonRel(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={personCat}
                onChange={(e) => setPersonCat(e.target.value as ImportantPerson['category'])}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="family">Family</option>
                <option value="friend">Friends</option>
                <option value="caregiver">Caregivers</option>
                <option value="doctor">Doctors</option>
                <option value="other">Other</option>
              </select>
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={personPhone}
                onChange={(e) => setPersonPhone(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={personEmail}
                onChange={(e) => setPersonEmail(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Favorite phrases (comma-separated)"
                value={personPhrases}
                onChange={(e) => setPersonPhrases(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={personFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const id = await uploadPhotoAsset('person', f);
                    setPersonPhotoId(id);
                  }}
                />
                <button
                  type="button"
                  onClick={() => personFileRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{personPhotoId ? 'Photo Attached' : 'Upload Photo'}</span>
                </button>

                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkAsEmergency}
                    onChange={(e) => setLinkAsEmergency(e.target.checked)}
                    className="w-4 h-4 accent-teal-600"
                  />
                  <span>Also save to Emergency Contacts (requires phone)</span>
                </label>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!personName.trim()) return;
                  const phrasesList = personPhrases
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  addImportantPerson({
                    name: personName.trim(),
                    relationship: personRel.trim() || personCat,
                    category: personCat,
                    phone: personPhone.trim() || undefined,
                    email: personEmail.trim() || undefined,
                    photoAssetId: personPhotoId,
                    favoritePhrases:
                      phrasesList.length > 0
                        ? phrasesList
                        : [`I would like to talk to ${personName.trim()}.`],
                  });
                  if (linkAsEmergency && personPhone.trim()) {
                    await addContact({
                      name: personName.trim(),
                      relationship: personRel.trim() || personCat,
                      phone: personPhone.trim(),
                      email: personEmail.trim(),
                      isPrimary: false,
                    });
                  }
                  setPersonName('');
                  setPersonRel('');
                  setPersonPhone('');
                  setPersonEmail('');
                  setPersonPhrases('');
                  setPersonPhotoId(undefined);
                  setLinkAsEmergency(false);
                  showMsg('Added person to My Important People.');
                }}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Person</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.importantPeople.length === 0 ? (
              <p className="text-sm text-slate-500 col-span-full">
                No family members, friends, doctors, or caregivers added yet.
              </p>
            ) : (
              state.importantPeople.map((person) => {
                const photoUrl = person.photoAssetId ? photosMap[person.photoAssetId] : undefined;
                return (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={person.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-teal-700 text-white font-bold flex items-center justify-center">
                            {person.name[0]?.toUpperCase() || 'P'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{person.name}</p>
                          <p className="text-xs text-slate-500 capitalize">
                            {person.relationship} · {person.category}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteImportantPerson(person.id)}
                        aria-label={`Remove ${person.name}`}
                        className="p-1 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {person.phone && (
                        <a
                          href={`tel:${person.phone}`}
                          className="px-2.5 py-1 rounded-lg bg-teal-700 text-white font-semibold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                      )}
                      {person.email && (
                        <a
                          href={`mailto:${person.email}`}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold inline-flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Email</span>
                        </a>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {person.favoritePhrases.map((phr, idx) => (
                        <GazeButton
                          key={idx}
                          gazeId={`ip_${person.id}_phr_${idx}`}
                          variant="subtle"
                          sizeOverride="standard"
                          onClick={() => speakPhrase(phr)}
                          className="w-full justify-start text-left"
                        >
                          <Volume2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs">{phr}</span>
                        </GazeButton>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 16. MY PERSONAL INTRODUCTION */}
      {subTab === 'intro' && (
        <div className="print-only-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              My Personal Introduction
            </h3>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Introduction Card</span>
            </button>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">
              {getPersonalIntroText()}
            </p>
            <div className="no-print flex flex-wrap gap-3">
              <GazeButton
                gazeId="intro_speak"
                variant="primary"
                sizeOverride="large"
                onClick={() => speakPhrase(getPersonalIntroText())}
              >
                <Volume2 className="w-5 h-5" />
                <span>Speak Introduction Aloud</span>
              </GazeButton>
            </div>
          </div>

          <div className="no-print space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Customize Introduction Statement (Leave blank to automatically use your preferred name)
            </label>
            <textarea
              rows={3}
              value={introDraft}
              onChange={(e) => setIntroDraft(e.target.value)}
              placeholder={`Hello! My name is ${profile.preferredName || profile.name || 'Friend'}. I communicate using eye movements and assistive technology...`}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                updateProfile((prev) => ({
                  ...prev,
                  personalIntroduction: introDraft.trim(),
                }));
                showMsg('Personal introduction saved.');
              }}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold cursor-pointer"
            >
              Save Custom Introduction
            </button>
          </div>
        </div>
      )}

      {/* 17. MY VOICE, MY RULES */}
      {subTab === 'rules' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              My Voice, My Rules — Consent & Personal Autonomy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Direct, respectful boundary statements available via gaze dwell at any moment.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MY_VOICE_MY_RULES_PHRASES.map((item) => {
              const text = lang === 'hi' ? item.textHi : item.textEn;
              return (
                <GazeButton
                  key={item.id}
                  gazeId={item.id}
                  variant="default"
                  sizeOverride="large"
                  onClick={() => speakPhrase(text)}
                  className="justify-start text-left"
                >
                  <Volume2 className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" />
                  <span className="font-semibold">{text}</span>
                </GazeButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
