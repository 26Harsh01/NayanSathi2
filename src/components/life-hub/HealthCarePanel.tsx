import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  Phone,
  Pill,
  Plus,
  Printer,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Unlock,
  Volume2,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { GazeButton } from '../gaze/GazeButton';
import {
  BODY_REGIONS,
  DOCTOR_VISIT_PHRASES,
} from '../../features/communication/personal-autonomy';
import { speakText } from '../../features/communication/text-to-speech';
import type { MedicineFrequency } from '../../types';

export type HealthSubTab = 'medicine' | 'doctor' | 'medical_card' | 'wellbeing';

interface HealthCarePanelProps {
  initialTab?: HealthSubTab;
}

export const HealthCarePanel: React.FC<HealthCarePanelProps> = ({
  initialTab = 'medicine',
}) => {
  const { profile, settings, updateSettings } = useAppState();
  const {
    state,
    dueMedicines,
    hasPermission,
    addMedicineReminder,
    toggleMedicineReminderActive,
    deleteMedicineReminder,
    acknowledgeMedicine,
    addDiscomfortEntry,
    deleteDiscomfortEntry,
    updateMedicalInfo,
    addWellbeingEntry,
    deleteWellbeingEntry,
  } = useLifeHub();
  const { primaryContact } = useEmergencyContacts();

  const lang = settings.communication.language;
  const [subTab, setSubTab] = useState<HealthSubTab>(initialTab);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Medicine reminder form
  const [medName, setMedName] = useState('');
  const [medDesc, setMedDesc] = useState('');
  const [medTime, setMedTime] = useState('09:00');
  const [medFreq, setMedFreq] = useState<MedicineFrequency>('daily');
  const [medInstr, setMedInstr] = useState('');
  const [medStart, setMedStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [medEnd, setMedEnd] = useState('');

  // Doctor visit discomfort form
  const [selectedArea, setSelectedArea] = useState<string>('head');
  const [discomfortType, setDiscomfortType] = useState('Pain / Ache');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [startedWhen, setStartedWhen] = useState('Today');
  const [discomfortDetails, setDiscomfortDetails] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');

  // Medical Info Authorization Unlock
  const [medicalUnlocked, setMedicalUnlocked] = useState(false);
  const [medicalDraft, setMedicalDraft] = useState(() => state.medicalInfo);
  const [editingMedical, setEditingMedical] = useState(false);

  // Wellbeing journal
  const [mood, setMood] = useState('Calm');
  const [sleepQuality, setSleepQuality] = useState('Good');
  const [appetite, setAppetite] = useState('Normal');
  const [discomfortLevel, setDiscomfortLevel] = useState('None');
  const [comfortLevel, setComfortLevel] = useState('Comfortable');
  const [generalWellbeing, setGeneralWellbeing] = useState('Stable');
  const [wbNotes, setWbNotes] = useState('');
  const [wbShare, setWbShare] = useState(false);

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

  const canViewMedical = hasPermission('canViewMedical');
  const canEditMedical = hasPermission('canEditMedical');

  const compiledDoctorSummary =
    summaryDraft ||
    [
      `Patient Communication Summary (${profile.preferredName || profile.name || 'Patient'})`,
      `Date: ${new Date().toLocaleDateString()}`,
      state.discomfortEntries.length > 0
        ? `User-reported discomfort notes:\n${state.discomfortEntries
            .slice(0, 6)
            .map(
              (d) =>
                `- ${d.bodyArea}: ${d.discomfortType} (User-reported severity: ${d.severity}, started: ${d.startedWhen})${d.details ? ` — ${d.details}` : ''}`
            )
            .join('\n')}`
        : 'No discomfort regions logged yet.',
      'Note: Patient self-reported communication aid only — not a medical diagnosis.',
    ].join('\n\n');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2.5 no-print">
        <GazeButton
          gazeId="health_tab_medicine"
          variant={subTab === 'medicine' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('medicine')}
        >
          <Pill className="w-4 h-4" />
          <span>
            Medicine Reminders {dueMedicines.length > 0 ? `(${dueMedicines.length} Due)` : ''}
          </span>
        </GazeButton>

        <GazeButton
          gazeId="health_tab_doctor"
          variant={subTab === 'doctor' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('doctor')}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Doctor Visit Mode</span>
        </GazeButton>

        <GazeButton
          gazeId="health_tab_card"
          variant={subTab === 'medical_card' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => {
            setMedicalDraft(state.medicalInfo);
            setSubTab('medical_card');
          }}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>My Medical Info Card</span>
        </GazeButton>

        <GazeButton
          gazeId="health_tab_wellbeing"
          variant={subTab === 'wellbeing' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('wellbeing')}
        >
          <BookOpen className="w-4 h-4" />
          <span>Wellbeing Journal</span>
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

      {/* 5. MEDICINE REMINDER SYSTEM */}
      {subTab === 'medicine' && (
        <div className="space-y-6">
          {dueMedicines.length > 0 && (
            <section
              aria-label="Due medicine reminders"
              className="rounded-2xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-5 space-y-4"
            >
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Bell className="w-5 h-5" />
                <h3 className="text-base font-bold">
                  Medicine Due Now — Explicit Confirmation Required
                </h3>
              </div>

              {dueMedicines.map((med) => (
                <div
                  key={med.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 space-y-3"
                >
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {med.name} · {med.reminderTime}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {med.description} {med.instructions ? `· ${med.instructions}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <GazeButton
                      gazeId={`med_taken_${med.id}`}
                      variant="primary"
                      sizeOverride="standard"
                      onClick={() => {
                        acknowledgeMedicine(med.id, 'taken');
                        speakPhrase(`I have taken my medicine: ${med.name}.`);
                        showMsg(`Logged intake confirmation for ${med.name}.`);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>I have taken my medicine</span>
                    </GazeButton>

                    <GazeButton
                      gazeId={`med_later_${med.id}`}
                      variant="subtle"
                      sizeOverride="standard"
                      onClick={() => {
                        acknowledgeMedicine(med.id, 'snoozed', 'Snoozed 15 minutes');
                        showMsg(`Reminder for ${med.name} snoozed for 15 minutes.`);
                      }}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Remind me later</span>
                    </GazeButton>

                    <GazeButton
                      gazeId={`med_help_${med.id}`}
                      variant="default"
                      sizeOverride="standard"
                      onClick={() => {
                        acknowledgeMedicine(med.id, 'help');
                        speakPhrase(`I need help with my medicine: ${med.name}.`);
                        showMsg(`Help request sent for ${med.name}.`);
                      }}
                    >
                      <span>I need help</span>
                    </GazeButton>

                    <GazeButton
                      gazeId={`med_cg_${med.id}`}
                      variant="danger"
                      sizeOverride="standard"
                      onClick={() => {
                        acknowledgeMedicine(med.id, 'call_caregiver');
                        speakPhrase(`Please call my caregiver for my medicine ${med.name}.`);
                        showMsg(`Caregiver alert logged for ${med.name}.`);
                      }}
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call my caregiver</span>
                    </GazeButton>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Add reminder form */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add Medicine Reminder
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <input
                type="text"
                placeholder="Medicine name *"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Dosage / Description"
                value={medDesc}
                onChange={(e) => setMedDesc(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={medTime}
                  onChange={(e) => setMedTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <select
                  value={medFreq}
                  onChange={(e) => setMedFreq(e.target.value as MedicineFrequency)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="daily">Daily</option>
                  <option value="twice_daily">Twice daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="as_needed">As needed</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Instructions (e.g. after food)"
                value={medInstr}
                onChange={(e) => setMedInstr(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <label className="flex items-center gap-2 text-xs">
                <span>Start</span>
                <input
                  type="date"
                  value={medStart}
                  onChange={(e) => setMedStart(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <span>End</span>
                <input
                  type="date"
                  value={medEnd}
                  onChange={(e) => setMedEnd(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const res = addMedicineReminder({
                  name: medName,
                  description: medDesc,
                  reminderTime: medTime,
                  frequency: medFreq,
                  instructions: medInstr,
                  startDate: medStart,
                  endDate: medEnd || undefined,
                });
                if (!res.ok) {
                  showMsg(res.error || 'Could not save reminder.');
                  return;
                }
                setMedName('');
                setMedDesc('');
                setMedInstr('');
                showMsg('Medicine reminder scheduled.');
              }}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Reminder</span>
            </button>
          </div>

          {/* Configured Reminders + Acknowledgment Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Scheduled Medicines ({state.medicineReminders.length})
              </h3>
              {state.medicineReminders.length === 0 ? (
                <p className="text-sm text-slate-500">No medicine reminders configured yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {state.medicineReminders.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">
                            {m.name} · <span className="font-mono tabular-nums">{m.reminderTime}</span>
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {m.frequency} {m.description ? `· ${m.description}` : ''}{' '}
                            {m.lastAcknowledgedDate
                              ? `· Last taken: ${m.lastAcknowledgedDate}`
                              : '· Not yet confirmed today'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleMedicineReminderActive(m.id)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer"
                          >
                            {m.active ? 'Active' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMedicineReminder(m.id)}
                            aria-label={`Delete ${m.name}`}
                            className="p-1 text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <GazeButton
                          gazeId={`med_quick_take_${m.id}`}
                          variant="subtle"
                          sizeOverride="standard"
                          onClick={() => {
                            acknowledgeMedicine(m.id, 'taken');
                            showMsg(`Confirmed intake of ${m.name}.`);
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Taken</span>
                        </GazeButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Explicit Acknowledgment Log ({state.medicineAcks.length})
              </h3>
              {state.medicineAcks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No medicine intake acknowledgments logged yet. Intake is never assumed automatically.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {state.medicineAcks.map((ack) => (
                    <div
                      key={ack.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {ack.medicineName} — {ack.action.replace('_', ' ')}
                        </p>
                        {ack.note && <p className="text-slate-500">{ack.note}</p>}
                      </div>
                      <span className="font-mono tabular-nums text-slate-500">
                        {new Date(ack.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. DOCTOR VISIT MODE */}
      {subTab === 'doctor' && (
        <div className="space-y-6">
          <div className="no-print space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Quick Clinical Communication Phrases
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DOCTOR_VISIT_PHRASES.map((item) => {
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
                    <span>{text}</span>
                  </GazeButton>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gaze-Selectable Body Region Selector */}
            <div className="lg:col-span-6 no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Where Does It Hurt? (Select Body Region)
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <svg
                  viewBox="0 0 180 280"
                  role="img"
                  aria-label="Interactive body region selector diagram"
                  className="w-36 h-56 shrink-0 select-none"
                >
                  {/* Head */}
                  <circle
                    cx="90"
                    cy="34"
                    r="22"
                    onClick={() => setSelectedArea('head')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'head'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Neck */}
                  <rect
                    x="78"
                    y="57"
                    width="24"
                    height="16"
                    rx="4"
                    onClick={() => setSelectedArea('neck')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'neck'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Chest */}
                  <rect
                    x="58"
                    y="75"
                    width="64"
                    height="44"
                    rx="8"
                    onClick={() => setSelectedArea('chest')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'chest'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Abdomen */}
                  <rect
                    x="60"
                    y="121"
                    width="60"
                    height="42"
                    rx="8"
                    onClick={() => setSelectedArea('abdomen')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'abdomen'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Left Arm (viewer left = patient right, labeled clearly by region) */}
                  <rect
                    x="30"
                    y="77"
                    width="22"
                    height="82"
                    rx="10"
                    onClick={() => setSelectedArea('right_arm')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'right_arm'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Right side (patient left arm) */}
                  <rect
                    x="128"
                    y="77"
                    width="22"
                    height="82"
                    rx="10"
                    onClick={() => setSelectedArea('left_arm')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'left_arm'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  {/* Legs */}
                  <rect
                    x="60"
                    y="167"
                    width="26"
                    height="96"
                    rx="10"
                    onClick={() => setSelectedArea('right_leg')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'right_leg'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                  <rect
                    x="94"
                    y="167"
                    width="26"
                    height="96"
                    rx="10"
                    onClick={() => setSelectedArea('left_leg')}
                    className={`cursor-pointer stroke-2 ${
                      selectedArea === 'left_leg'
                        ? 'fill-teal-600/30 stroke-teal-700 dark:stroke-teal-400'
                        : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                    }`}
                  />
                </svg>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full">
                  {BODY_REGIONS.map((region) => {
                    const label = lang === 'hi' ? region.labelHi : region.labelEn;
                    return (
                      <GazeButton
                        key={region.id}
                        gazeId={`body_${region.id}`}
                        variant={selectedArea === region.id ? 'selected' : 'default'}
                        sizeOverride="standard"
                        onClick={() => setSelectedArea(region.id)}
                      >
                        <span>{label}</span>
                      </GazeButton>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold">Discomfort Type</span>
                  <select
                    value={discomfortType}
                    onChange={(e) => setDiscomfortType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option>Pain / Ache</option>
                    <option>Sharp / Shooting</option>
                    <option>Pressure / Tightness</option>
                    <option>Numbness / Tingling</option>
                    <option>Fatigue / Weakness</option>
                    <option>Breathing Discomfort</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold">User-Reported Severity</span>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold">When did it start?</span>
                  <input
                    type="text"
                    value={startedWhen}
                    onChange={(e) => setStartedWhen(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold">Additional Details</span>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={discomfortDetails}
                    onChange={(e) => setDiscomfortDetails(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </label>
              </div>

              <GazeButton
                gazeId="doc_add_discomfort"
                variant="primary"
                sizeOverride="standard"
                onClick={() => {
                  const regionObj = BODY_REGIONS.find((r) => r.id === selectedArea);
                  const areaName = regionObj
                    ? lang === 'hi'
                      ? regionObj.labelHi
                      : regionObj.labelEn
                    : selectedArea;
                  addDiscomfortEntry({
                    bodyArea: areaName,
                    discomfortType,
                    severity,
                    startedWhen,
                    details: discomfortDetails,
                  });
                  speakPhrase(
                    `I am feeling ${severity} ${discomfortType} in my ${areaName}, started ${startedWhen}.`
                  );
                  setDiscomfortDetails('');
                  showMsg('Added self-reported note to Doctor Visit summary.');
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Add to Visit Summary & Speak</span>
              </GazeButton>
            </div>

            {/* Structured Printable Doctor Summary */}
            <div className="lg:col-span-6 print-only-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Editable Medical Communication Summary
                </h3>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                User-reported symptom notes for doctor communication only. NayanSathi never generates medical diagnoses.
              </p>

              <textarea
                rows={7}
                value={compiledDoctorSummary}
                onChange={(e) => setSummaryDraft(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />

              {state.discomfortEntries.length > 0 && (
                <div className="no-print space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Logged Entries ({state.discomfortEntries.length})
                  </p>
                  {state.discomfortEntries.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                    >
                      <span>
                        <strong>{entry.bodyArea}</strong> · {entry.discomfortType} ({entry.severity})
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteDiscomfortEntry(entry.id)}
                        className="text-red-600 cursor-pointer"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. MY MEDICAL INFORMATION CARD */}
      {subTab === 'medical_card' && (
        <div className="space-y-5">
          {!canViewMedical ? (
            <div className="p-6 rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-red-900 dark:text-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Restricted</p>
                <p>
                  The active caregiver role does not have consent permission to view medical information. Switch to the patient profile or grant medical view consent in Settings / Caregiver Portal.
                </p>
              </div>
            </div>
          ) : !medicalUnlocked ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
              <Lock className="w-8 h-8 mx-auto text-teal-700 dark:text-teal-400" />
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Medical Information Card Locked for Privacy
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Sensitive allergies, conditions, medications, and doctor contacts stay hidden until intentionally unlocked.
                </p>
              </div>
              <GazeButton
                gazeId="med_card_unlock"
                variant="primary"
                sizeOverride="large"
                onClick={() => setMedicalUnlocked(true)}
                className="mx-auto"
              >
                <Unlock className="w-4 h-4" />
                <span>Authorize & View Medical Card</span>
              </GazeButton>
            </div>
          ) : (
            <div className="print-only-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Medical Information Card — {profile.preferredName || profile.name || 'Patient'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    All fields are optional and user/authorized-caregiver controlled.
                  </p>
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMedicalUnlocked(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock</span>
                  </button>
                  {canEditMedical && (
                    <button
                      type="button"
                      onClick={() => {
                        setMedicalDraft(state.medicalInfo);
                        setEditingMedical(!editingMedical);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      {editingMedical ? 'Close Editor' : 'Edit Medical Info'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!settings.privacy.medicalEmergencyCardConsent}
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Emergency Card</span>
                  </button>
                </div>
              </div>

              <label className="no-print inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privacy.medicalEmergencyCardConsent}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      privacy: {
                        ...prev.privacy,
                        medicalEmergencyCardConsent: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-teal-600"
                />
                <span>
                  I consent to generating a printable Emergency Medical Card from these fields.
                </span>
              </label>

              {editingMedical && canEditMedical ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {(
                    [
                      ['allergies', 'Allergies'],
                      ['existingConditions', 'Existing Conditions'],
                      ['medications', 'Current Medications'],
                      ['careInstructions', 'Essential Care Instructions'],
                      ['preferredDoctor', 'Preferred Doctor Name'],
                      ['doctorContact', 'Doctor Contact'],
                      ['preferredHospital', 'Preferred Hospital'],
                      ['emergencyCaregiverInfo', 'Emergency Caregiver Info'],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="space-y-1">
                      <span className="text-xs font-semibold">{label}</span>
                      <input
                        type="text"
                        value={medicalDraft[field]}
                        onChange={(e) =>
                          setMedicalDraft((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </label>
                  ))}
                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const res = updateMedicalInfo(medicalDraft);
                        if (!res.ok) {
                          showMsg(res.error || 'Unable to save medical info.');
                          return;
                        }
                        setEditingMedical(false);
                        showMsg('Medical information updated.');
                      }}
                      className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold cursor-pointer"
                    >
                      Save Medical Card
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Allergies</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.allergies || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Existing Conditions</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.existingConditions || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Medications</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.medications || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Essential Care Instructions</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.careInstructions || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Preferred Doctor & Contact</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {[state.medicalInfo.preferredDoctor, state.medicalInfo.doctorContact]
                        .filter(Boolean)
                        .join(' · ') || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Preferred Hospital</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.preferredHospital || 'Not provided'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Emergency Caregiver Contact</dt>
                    <dd className="font-medium text-slate-900 dark:text-white">
                      {state.medicalInfo.emergencyCaregiverInfo ||
                        (primaryContact
                          ? `${primaryContact.name} (${primaryContact.relationship}) · ${primaryContact.phone}`
                          : 'Not configured')}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. PERSONAL WELLBEING JOURNAL */}
      {subTab === 'wellbeing' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Daily Wellbeing Check-In (Private Unless You Choose to Share)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-semibold">Mood & Feelings</span>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>Calm</option>
                  <option>Happy / Content</option>
                  <option>Tired</option>
                  <option>Anxious / Stressed</option>
                  <option>Low / Frustrated</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold">Sleep Quality</span>
                <select
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>Good</option>
                  <option>Fair / Interrupted</option>
                  <option>Poor / Restless</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold">Appetite</span>
                <select
                  value={appetite}
                  onChange={(e) => setAppetite(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>Normal</option>
                  <option>Light</option>
                  <option>Low</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold">Discomfort Level</span>
                <select
                  value={discomfortLevel}
                  onChange={(e) => setDiscomfortLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>None</option>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>Significant</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold">Comfort Level</span>
                <select
                  value={comfortLevel}
                  onChange={(e) => setComfortLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>Comfortable</option>
                  <option>Needs Adjustment</option>
                  <option>Uncomfortable</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold">General Wellbeing</span>
                <select
                  value={generalWellbeing}
                  onChange={(e) => setGeneralWellbeing(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option>Stable</option>
                  <option>Feeling Better</option>
                  <option>Need Extra Support</option>
                </select>
              </label>
            </div>

            <textarea
              rows={2}
              placeholder="Personal notes..."
              value={wbNotes}
              onChange={(e) => setWbNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={wbShare}
                  onChange={(e) => setWbShare(e.target.checked)}
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Share this entry with consented caregivers / doctor</span>
              </label>

              <GazeButton
                gazeId="wb_save_entry"
                variant="primary"
                sizeOverride="standard"
                onClick={() => {
                  addWellbeingEntry({
                    date: new Date().toISOString().slice(0, 10),
                    mood,
                    sleepQuality,
                    appetite,
                    discomfort: discomfortLevel,
                    comfortLevel,
                    generalWellbeing,
                    notes: wbNotes.trim(),
                    sharedWithCaregiver: wbShare,
                  });
                  setWbNotes('');
                  showMsg('Saved wellbeing journal entry.');
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Journal Entry</span>
              </GazeButton>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Historical Timeline ({state.wellbeingJournal.length})
            </h3>
            {state.wellbeingJournal.length === 0 ? (
              <p className="text-sm text-slate-500">No wellbeing entries recorded yet.</p>
            ) : (
              state.wellbeingJournal.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {entry.date} · Mood: {entry.mood} · Wellbeing: {entry.generalWellbeing}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Sleep: {entry.sleepQuality} · Appetite: {entry.appetite} · Discomfort:{' '}
                      {entry.discomfort} · Comfort: {entry.comfortLevel} ·{' '}
                      {entry.sharedWithCaregiver ? 'Shared with caregivers' : 'Private'}
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-slate-700 dark:text-slate-200">{entry.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWellbeingEntry(entry.id)}
                    className="p-1.5 text-red-600 cursor-pointer"
                    aria-label="Delete wellbeing entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
