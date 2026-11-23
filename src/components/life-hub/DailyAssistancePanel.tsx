import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Heart,
  ImagePlus,
  Package,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { GazeButton } from '../gaze/GazeButton';
import { COMFORT_PRESET_REQUESTS } from '../../features/communication/personal-autonomy';
import { speakText } from '../../features/communication/text-to-speech';
import type { ChoiceCategoryId, HelpRequestStatus, PersonalChoiceOption } from '../../types';

export type DailySubTab = 'choices' | 'comfort' | 'belongings' | 'tracker';

interface DailyAssistancePanelProps {
  initialTab?: DailySubTab;
}

const CHOICE_CATEGORIES: { id: ChoiceCategoryId; labelEn: string; labelHi: string }[] = [
  { id: 'eat', labelEn: 'What to Eat', labelHi: 'क्या खाना है' },
  { id: 'drink', labelEn: 'What to Drink', labelHi: 'क्या पीना है' },
  { id: 'wear', labelEn: 'What to Wear', labelHi: 'क्या पहनना है' },
  { id: 'watch', labelEn: 'What to Watch / Listen', labelHi: 'क्या देखना / सुनना है' },
  { id: 'activity', labelEn: 'Which Activity', labelHi: 'कौन सी गतिविधि' },
  { id: 'where', labelEn: 'Where to Go', labelHi: 'कहाँ जाना है' },
  { id: 'person', labelEn: 'Whom to Talk To', labelHi: 'किससे बात करनी है' },
];

function statusLabel(status: HelpRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'resolved':
      return 'Resolved';
  }
}

export const DailyAssistancePanel: React.FC<DailyAssistancePanelProps> = ({
  initialTab = 'choices',
}) => {
  const { settings } = useAppState();
  const {
    state,
    photosMap,
    hasConnectedCaregiver,
    uploadPhotoAsset,
    addChoiceOption,
    deleteChoiceOption,
    confirmChoiceSelection,
    sendComfortRequest,
    addBelongingItem,
    requestBelonging,
    createHelpRequest,
    updateHelpRequestStatus,
  } = useLifeHub();
  const { primaryContact } = useEmergencyContacts();

  const lang = settings.communication.language;
  const [subTab, setSubTab] = useState<DailySubTab>(initialTab);
  const [choiceCat, setChoiceCat] = useState<ChoiceCategoryId>('eat');
  const [pendingConfirmChoice, setPendingConfirmChoice] = useState<PersonalChoiceOption | null>(null);
  const [newChoiceEn, setNewChoiceEn] = useState('');
  const [newChoiceHi, setNewChoiceHi] = useState('');
  const [newChoicePhotoId, setNewChoicePhotoId] = useState<string | undefined>(undefined);

  const [customComfortText, setCustomComfortText] = useState('');
  const [newBelongingEn, setNewBelongingEn] = useState('');
  const [newBelongingHi, setNewBelongingHi] = useState('');
  const [newBelongingPhotoId, setNewBelongingPhotoId] = useState<string | undefined>(undefined);

  const [customReqTitle, setCustomReqTitle] = useState('');
  const [customReqDetails, setCustomReqDetails] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const choiceFileRef = useRef<HTMLInputElement>(null);
  const belongingFileRef = useRef<HTMLInputElement>(null);

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

  const notify = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handlePhotoUpload = async (
    file: File | undefined,
    prefix: string,
    onDone: (assetId: string) => void
  ) => {
    if (!file) return;
    setUploadErr(null);
    try {
      const assetId = await uploadPhotoAsset(prefix, file);
      onDone(assetId);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const filteredChoices = state.choices.filter((c) => c.category === choiceCat);

  return (
    <div className="space-y-6">
      {/* Sub-module Gaze Navigation */}
      <div className="flex flex-wrap gap-2.5">
        <GazeButton
          gazeId="daily_tab_choices"
          variant={subTab === 'choices' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('choices')}
        >
          <Sparkles className="w-4 h-4" />
          <span>{lang === 'hi' ? 'मेरी पसंद' : 'My Choices'}</span>
        </GazeButton>

        <GazeButton
          gazeId="daily_tab_comfort"
          variant={subTab === 'comfort' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('comfort')}
        >
          <Heart className="w-4 h-4" />
          <span>{lang === 'hi' ? 'आराम और ज़रूरतें' : 'Comfort & Personal Needs'}</span>
        </GazeButton>

        <GazeButton
          gazeId="daily_tab_belongings"
          variant={subTab === 'belongings' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('belongings')}
        >
          <Package className="w-4 h-4" />
          <span>{lang === 'hi' ? 'सामान मँगवाएँ' : 'Bring Me Something'}</span>
        </GazeButton>

        <GazeButton
          gazeId="daily_tab_tracker"
          variant={subTab === 'tracker' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('tracker')}
        >
          <Clock className="w-4 h-4" />
          <span>
            {lang === 'hi' ? 'सहायता अनुरोध ट्रैकर' : 'Help Request Tracker'} (
            {state.helpRequests.filter((r) => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress').length})
          </span>
        </GazeButton>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-sm font-medium text-teal-900 dark:text-teal-200"
        >
          {feedbackMsg}
        </div>
      )}

      {uploadErr && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200"
        >
          {uploadErr}
        </div>
      )}

      {/* 1. MY CHOICES */}
      {subTab === 'choices' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {CHOICE_CATEGORIES.map((cat) => (
              <GazeButton
                key={cat.id}
                gazeId={`choice_cat_${cat.id}`}
                variant={choiceCat === cat.id ? 'selected' : 'subtle'}
                sizeOverride="standard"
                onClick={() => {
                  setChoiceCat(cat.id);
                  setPendingConfirmChoice(null);
                }}
              >
                <span>{lang === 'hi' ? cat.labelHi : cat.labelEn}</span>
              </GazeButton>
            ))}
          </div>

          {/* Explicit confirmation step before sending request */}
          {pendingConfirmChoice && (
            <div className="p-5 rounded-2xl border-2 border-teal-600 bg-white dark:bg-slate-900 space-y-4">
              <div>
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                  Confirm Your Selection
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {lang === 'hi' ? pendingConfirmChoice.labelHi : pendingConfirmChoice.labelEn}
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                <GazeButton
                  gazeId="choice_confirm_speak_send"
                  variant="primary"
                  sizeOverride="large"
                  onClick={() => {
                    const label =
                      lang === 'hi'
                        ? pendingConfirmChoice.labelHi
                        : pendingConfirmChoice.labelEn;
                    confirmChoiceSelection(pendingConfirmChoice, true);
                    speakPhrase(
                      lang === 'hi' ? `मेरी पसंद: ${label}` : `I would like: ${label}`
                    );
                    notify(`Confirmed "${label}" and added to Help Request Tracker.`);
                    setPendingConfirmChoice(null);
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm, Speak & Send Request</span>
                </GazeButton>

                <GazeButton
                  gazeId="choice_confirm_speak_only"
                  variant="default"
                  sizeOverride="large"
                  onClick={() => {
                    const label =
                      lang === 'hi'
                        ? pendingConfirmChoice.labelHi
                        : pendingConfirmChoice.labelEn;
                    confirmChoiceSelection(pendingConfirmChoice, false);
                    speakPhrase(label);
                    notify(`Confirmed "${label}" without sending a caregiver task.`);
                    setPendingConfirmChoice(null);
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Confirm & Speak Only</span>
                </GazeButton>

                <GazeButton
                  gazeId="choice_confirm_cancel"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={() => setPendingConfirmChoice(null)}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel</span>
                </GazeButton>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChoices.map((opt) => {
              const label = lang === 'hi' ? opt.labelHi : opt.labelEn;
              const imgUrl = opt.photoAssetId ? photosMap[opt.photoAssetId] : undefined;
              return (
                <div
                  key={opt.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3"
                >
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt={label}
                      className="w-full h-36 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  <GazeButton
                    gazeId={`choice_opt_${opt.id}`}
                    variant="default"
                    sizeOverride="large"
                    onClick={() => setPendingConfirmChoice(opt)}
                    className="w-full justify-start text-left"
                  >
                    <span className="font-semibold">{label}</span>
                  </GazeButton>

                  {opt.isCustom && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteChoiceOption(opt.id)}
                        className="text-xs text-red-600 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add custom choice option */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add Custom Option to "{CHOICE_CATEGORIES.find((c) => c.id === choiceCat)?.labelEn}"
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Option name (English)"
                value={newChoiceEn}
                onChange={(e) => setNewChoiceEn(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                placeholder="हिंदी नाम (optional)"
                value={newChoiceHi}
                onChange={(e) => setNewChoiceHi(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={choiceFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    void handlePhotoUpload(e.target.files?.[0], 'choice', setNewChoicePhotoId)
                  }
                />
                <button
                  type="button"
                  onClick={() => choiceFileRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{newChoicePhotoId ? 'Photo Ready' : 'Upload Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newChoiceEn.trim()) return;
                    addChoiceOption(choiceCat, newChoiceEn, newChoiceHi, newChoicePhotoId);
                    setNewChoiceEn('');
                    setNewChoiceHi('');
                    setNewChoicePhotoId(undefined);
                    notify('Custom choice saved.');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. COMFORT & PERSONAL NEEDS */}
      {subTab === 'comfort' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMFORT_PRESET_REQUESTS.map((item) => {
              const text = lang === 'hi' ? item.textHi : item.textEn;
              return (
                <GazeButton
                  key={item.id}
                  gazeId={item.id}
                  variant="default"
                  sizeOverride="large"
                  onClick={() => {
                    sendComfortRequest(text, false);
                    speakPhrase(text);
                    notify(`Spoke & logged comfort request: "${text}"`);
                  }}
                  className="justify-start text-left"
                >
                  <Volume2 className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" />
                  <span>{text}</span>
                </GazeButton>
              );
            })}

            {state.customComfortRequests.map((customText, idx) => (
              <GazeButton
                key={`cust_comf_${idx}`}
                gazeId={`cust_comf_${idx}`}
                variant="subtle"
                sizeOverride="large"
                onClick={() => {
                  sendComfortRequest(customText, false);
                  speakPhrase(customText);
                  notify(`Spoke & logged comfort request: "${customText}"`);
                }}
                className="justify-start text-left"
              >
                <Volume2 className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" />
                <span>{customText}</span>
              </GazeButton>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add Custom Comfort Request
            </h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="e.g. Please raise the backrest slightly."
                value={customComfortText}
                onChange={(e) => setCustomComfortText(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (!customComfortText.trim()) return;
                  sendComfortRequest(customComfortText, true);
                  speakPhrase(customComfortText);
                  setCustomComfortText('');
                  notify('Saved & submitted comfort request.');
                }}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold cursor-pointer"
              >
                Save & Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BRING ME SOMETHING */}
      {subTab === 'belongings' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.belongings.map((item) => {
              const label = lang === 'hi' ? item.labelHi : item.labelEn;
              const photoUrl = item.photoAssetId ? photosMap[item.photoAssetId] : undefined;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                >
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt={label}
                      className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  <GazeButton
                    gazeId={`bring_${item.id}`}
                    variant="default"
                    sizeOverride="large"
                    onClick={() => {
                      requestBelonging(item);
                      speakPhrase(
                        lang === 'hi'
                          ? `कृपया मुझे ${label} ला दें।`
                          : `Please bring me my ${label}.`
                      );
                      notify(`Requested "${label}" — status is Pending in Help Request Tracker.`);
                    }}
                    className="w-full justify-start text-left"
                  >
                    <Package className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" />
                    <span>{label}</span>
                  </GazeButton>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add Personal Belonging (with Optional Photo)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Item name (English)"
                value={newBelongingEn}
                onChange={(e) => setNewBelongingEn(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                placeholder="हिंदी नाम (optional)"
                value={newBelongingHi}
                onChange={(e) => setNewBelongingHi(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={belongingFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    void handlePhotoUpload(
                      e.target.files?.[0],
                      'belonging',
                      setNewBelongingPhotoId
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => belongingFileRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{newBelongingPhotoId ? 'Photo Ready' : 'Upload Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newBelongingEn.trim()) return;
                    addBelongingItem(newBelongingEn, newBelongingHi, newBelongingPhotoId);
                    setNewBelongingEn('');
                    setNewBelongingHi('');
                    setNewBelongingPhotoId(undefined);
                    notify('Personal belonging added.');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. HELP REQUEST TRACKER */}
      {subTab === 'tracker' && (
        <div className="space-y-5">
          {!hasConnectedCaregiver && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-sm text-amber-950 dark:text-amber-100 space-y-2">
              <p className="font-semibold">
                Local Tracker Mode — No Caregiver Linked Yet
              </p>
              <p className="text-xs">
                Requests are logged honestly in your device tracker, and NayanSathi will never fake caregiver acceptance. Add a caregiver or emergency contact in Caregiver Portal, or use direct phone contact if urgent.
              </p>
              {primaryContact && (
                <a
                  href={`tel:${primaryContact.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {primaryContact.name} ({primaryContact.phone})</span>
                </a>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Create New Help Request
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="What do you need help with?"
                value={customReqTitle}
                onChange={(e) => setCustomReqTitle(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                placeholder="Optional details..."
                value={customReqDetails}
                onChange={(e) => setCustomReqDetails(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <GazeButton
                gazeId="help_req_create"
                variant="primary"
                sizeOverride="standard"
                onClick={() => {
                  if (!customReqTitle.trim()) return;
                  createHelpRequest('general', customReqTitle, customReqDetails);
                  speakPhrase(customReqTitle);
                  setCustomReqTitle('');
                  setCustomReqDetails('');
                  notify('Help request created with Pending status.');
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Submit Request</span>
              </GazeButton>
            </div>
          </div>

          <div className="space-y-3">
            {state.helpRequests.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-500">
                No help requests yet. Selections from Choices, Comfort, Bring Me Something, or Room Control appear here with live status.
              </div>
            ) : (
              state.helpRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase text-teal-700 dark:text-teal-400">
                        {statusLabel(req.status)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{req.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {new Date(req.createdAt).toLocaleString()}
                      </span>
                      {req.acknowledgedBy && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Acknowledged by {req.acknowledgedBy}</span>
                        </>
                      )}
                    </div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {req.title}
                    </p>
                    {req.details && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{req.details}</p>
                    )}
                    {req.caregiverNote && (
                      <p className="text-xs text-teal-800 dark:text-teal-300">
                        Caregiver note: {req.caregiverNote}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {req.status !== 'resolved' && req.status !== 'completed' && req.status !== 'cancelled' && (
                      <>
                        <GazeButton
                          gazeId={`req_resolve_${req.id}`}
                          variant="subtle"
                          sizeOverride="standard"
                          onClick={() => updateHelpRequestStatus(req.id, 'resolved')}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Resolved</span>
                        </GazeButton>
                        <GazeButton
                          gazeId={`req_cancel_${req.id}`}
                          variant="default"
                          sizeOverride="standard"
                          onClick={() => updateHelpRequestStatus(req.id, 'cancelled')}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Cancel</span>
                        </GazeButton>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
