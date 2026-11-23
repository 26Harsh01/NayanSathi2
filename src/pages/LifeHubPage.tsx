import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Crosshair,
  Eye,
  Heart,
  HeartPulse,
  Home,
  MessageSquare,
  Mic,
  Settings,
  Shield,
  Star,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useLifeHub } from '../context/LifeHubContext';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { GazeButton } from '../components/gaze/GazeButton';
import { WebcamLandmarkPreview } from '../components/gaze/WebcamLandmarkPreview';
import { GazeStabilityTestPanel } from '../components/gaze/GazeStabilityTestPanel';
import { DailyAssistancePanel, type DailySubTab } from '../components/life-hub/DailyAssistancePanel';
import { HealthCarePanel, type HealthSubTab } from '../components/life-hub/HealthCarePanel';
import { EnvironmentPanel } from '../components/life-hub/EnvironmentPanel';
import { ActivitiesPanel, type ActivitiesSubTab } from '../components/life-hub/ActivitiesPanel';
import { PersonalSupportPanel, type SupportSubTab } from '../components/life-hub/PersonalSupportPanel';
import { TwoWayConversationPanel } from '../components/life-hub/TwoWayConversationPanel';

export type LifeHubSection =
  | 'overview'
  | 'daily'
  | 'health'
  | 'environment'
  | 'activities'
  | 'support'
  | 'two_way'
  | 'diagnostics';

interface LifeHubPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const LifeHubPage: React.FC<LifeHubPageProps> = ({ onNavigate }) => {
  const { profile, settings, calibration, phrases, toggleFavoritePhrase, recentPhrases } =
    useAppState();
  const { state, dueMedicines } = useLifeHub();
  const { diagnostics, isRunning, startTracking, errorMessage, calibrationStale } = useEyeTracking();

  const lang = settings.communication.language;
  const [section, setSection] = useState<LifeHubSection>('overview');
  const [dailyTab, setDailyTab] = useState<DailySubTab>('choices');
  const [healthTab, setHealthTab] = useState<HealthSubTab>('medicine');
  const [actTab, setActTab] = useState<ActivitiesSubTab>('routine');
  const [suppTab, setSuppTab] = useState<SupportSubTab>('passport');

  const pendingReqCount = state.helpRequests.filter(
    (r) => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress'
  ).length;
  const favoritePhrases = phrases.filter((p) => p.isFavorite);

  const openSection = (next: LifeHubSection) => {
    setSection(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-7">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          {section !== 'overview' && (
            <button
              type="button"
              onClick={() => setSection('overview')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 inline-flex items-center gap-1 hover:underline cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to My Life Hub</span>
            </button>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {lang === 'hi' ? 'मेरा जीवन केंद्र (My Life Hub)' : 'My Life Hub'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {lang === 'hi'
              ? 'मेरे दैनिक जीवन, स्वास्थ्य और स्वतंत्रता के लिए आवश्यक सब कुछ।'
              : 'Everything I need for my everyday life.'}{' '}
            · {profile.preferredName || profile.name || 'Friend'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <GazeButton
            gazeId="lh_go_communicate"
            variant="primary"
            sizeOverride="standard"
            onClick={() => onNavigate('communicate')}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{lang === 'hi' ? 'संवाद खोलें' : 'Open Communicate'}</span>
          </GazeButton>

          <GazeButton
            gazeId="lh_go_profile"
            variant="default"
            sizeOverride="standard"
            onClick={() => onNavigate('profile')}
          >
            <span>{lang === 'hi' ? 'मेरी प्रोफ़ाइल' : 'My Profile'}</span>
          </GazeButton>
        </div>
      </div>

      {/* Category Top Pills (Quick Switcher) */}
      <div className="no-print flex flex-wrap gap-2">
        {(
          [
            ['overview', 'All Hub Areas'],
            ['daily', `Daily Assistance (${pendingReqCount})`],
            ['health', `Health & Care${dueMedicines.length > 0 ? ` (${dueMedicines.length} Due)` : ''}`],
            ['environment', 'Control My Room'],
            ['activities', 'My Activities'],
            ['support', 'Personal Support'],
            ['two_way', 'Two-Way Conversation'],
            ['diagnostics', 'Gaze Diagnostics'],
          ] as [LifeHubSection, string][]
        ).map(([id, label]) => (
          <GazeButton
            key={id}
            gazeId={`lh_nav_${id}`}
            variant={section === id ? 'selected' : 'subtle'}
            sizeOverride="standard"
            onClick={() => openSection(id)}
          >
            <span>{label}</span>
          </GazeButton>
        ))}
      </div>

      {/* OVERVIEW HUB */}
      {section === 'overview' && (
        <div className="space-y-8">
          {dueMedicines.length > 0 && (
            <div className="p-4 rounded-2xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-amber-950 dark:text-amber-100">
                <p className="font-bold">
                  {dueMedicines.length} Medicine Reminder(s) Due Now
                </p>
                <p className="text-xs">
                  {dueMedicines.map((m) => `${m.name} (${m.reminderTime})`).join(' · ')}
                </p>
              </div>
              <GazeButton
                gazeId="lh_due_med_jump"
                variant="primary"
                sizeOverride="standard"
                onClick={() => {
                  setHealthTab('medicine');
                  openSection('health');
                }}
              >
                <span>Open Medicine Confirmations</span>
              </GazeButton>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* A. Daily Assistance */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Heart className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>Daily Assistance</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {pendingReqCount} open
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Express food, clothing, comfort, and belonging needs or track caregiver help status.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['choices', 'My Choices'],
                    ['comfort', 'Comfort Needs'],
                    ['belongings', 'Bring Me Item'],
                    ['tracker', 'Help Tracker'],
                  ] as [DailySubTab, string][]
                ).map(([tab, label]) => (
                  <GazeButton
                    key={tab}
                    gazeId={`hub_daily_${tab}`}
                    variant="default"
                    sizeOverride="standard"
                    onClick={() => {
                      setDailyTab(tab);
                      openSection('daily');
                    }}
                  >
                    <span>{label}</span>
                  </GazeButton>
                ))}
              </div>
            </section>

            {/* B. Health & Care */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <HeartPulse className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>Health & Care</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {state.medicineReminders.length} meds
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Confirm medicines, locate body discomfort for doctor visits, protect medical info, and track wellbeing.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['medicine', 'Medicine Alerts'],
                    ['doctor', 'Doctor Visit Mode'],
                    ['medical_card', 'Medical Info Card'],
                    ['wellbeing', 'Wellbeing Journal'],
                  ] as [HealthSubTab, string][]
                ).map(([tab, label]) => (
                  <GazeButton
                    key={tab}
                    gazeId={`hub_health_${tab}`}
                    variant="default"
                    sizeOverride="standard"
                    onClick={() => {
                      setHealthTab(tab);
                      openSection('health');
                    }}
                  >
                    <span>{label}</span>
                  </GazeButton>
                ))}
              </div>
            </section>

            {/* C. My Environment */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Home className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>My Environment</h2>
                </div>
                <span className="text-xs text-slate-500">Room Control</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Control lights, fan, TV, curtains, and temperature via Home Assistant or Caregiver Assistance request.
              </p>
              <GazeButton
                gazeId="hub_open_room"
                variant="primary"
                sizeOverride="large"
                onClick={() => openSection('environment')}
                className="w-full"
              >
                <Home className="w-4 h-4" />
                <span>Open Control My Room</span>
              </GazeButton>
            </section>

            {/* D. My Activities */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Calendar className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>My Activities</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {state.appointments.length} appts
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Step-by-step daily routines, shopping & restaurant boards, public speech cards, and appointments.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['routine', 'Daily Routine'],
                    ['shopping', 'Shopping Mode'],
                    ['restaurant', 'Restaurant Mode'],
                    ['public', 'Public Mode'],
                    ['appointments', 'Appointments'],
                  ] as [ActivitiesSubTab, string][]
                ).map(([tab, label]) => (
                  <GazeButton
                    key={tab}
                    gazeId={`hub_act_${tab}`}
                    variant="default"
                    sizeOverride="standard"
                    onClick={() => {
                      setActTab(tab);
                      openSection('activities');
                    }}
                  >
                    <span>{label}</span>
                  </GazeButton>
                ))}
              </div>
            </section>

            {/* E. Personal Support */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Shield className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>Personal Support</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {state.importantPeople.length} people
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Printable Communication Passport, Important People directory, Personal Intro, and My Voice, My Rules.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['passport', 'Comm. Passport'],
                    ['people', 'Important People'],
                    ['intro', 'Personal Intro'],
                    ['rules', 'My Voice, Rules'],
                  ] as [SupportSubTab, string][]
                ).map(([tab, label]) => (
                  <GazeButton
                    key={tab}
                    gazeId={`hub_supp_${tab}`}
                    variant="default"
                    sizeOverride="standard"
                    onClick={() => {
                      setSuppTab(tab);
                      openSection('support');
                    }}
                  >
                    <span>{label}</span>
                  </GazeButton>
                ))}
              </div>
            </section>

            {/* F. Two-Way Conversation & Diagnostics */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Mic className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h2>Conversation & Gaze Tools</h2>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Listen to conversation partners with explicit mic control and respond via gaze, or run live 9-point gaze diagnostics.
              </p>
              <div className="space-y-2.5">
                <GazeButton
                  gazeId="hub_open_twoway"
                  variant="primary"
                  sizeOverride="large"
                  onClick={() => openSection('two_way')}
                  className="w-full"
                >
                  <Mic className="w-4 h-4" />
                  <span>Open Two-Way Conversation</span>
                </GazeButton>
                <GazeButton
                  gazeId="hub_open_diagnostics"
                  variant="subtle"
                  sizeOverride="standard"
                  onClick={() => openSection('diagnostics')}
                  className="w-full"
                >
                  <Activity className="w-4 h-4" />
                  <span>Live Gaze Diagnostics & Stability Tests</span>
                </GazeButton>
              </div>
            </section>
          </div>
        </div>
      )}

      {section === 'daily' && <DailyAssistancePanel key={dailyTab} initialTab={dailyTab} />}
      {section === 'health' && <HealthCarePanel key={healthTab} initialTab={healthTab} />}
      {section === 'environment' && <EnvironmentPanel />}
      {section === 'activities' && <ActivitiesPanel key={actTab} initialTab={actTab} />}
      {section === 'support' && <PersonalSupportPanel key={suppTab} initialTab={suppTab} />}
      {section === 'two_way' && <TwoWayConversationPanel />}

      {/* Preserved Gaze Diagnostics & Phrase Shortcuts */}
      {section === 'diagnostics' && (
        <div className="space-y-8">
          {calibrationStale && calibration && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  Viewport size or aspect ratio changed significantly since last calibration ({calibration.viewportWidth}x{calibration.viewportHeight}). Recalibrating is recommended.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('calibration')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
              >
                Recalibrate Now
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Local Webcam & Iris Landmark Feed
                </h2>
                {!isRunning && (
                  <button
                    type="button"
                    onClick={() => startTracking()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Start Tracking</span>
                  </button>
                )}
              </div>
              <WebcamLandmarkPreview showLandmarks />
              {errorMessage && (
                <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMessage}</p>
              )}
            </div>

            <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Live Pipeline Diagnostics
                </h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Status: {diagnostics.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Frame Rate', value: `${diagnostics.fps} FPS` },
                  { label: 'Confidence', value: diagnostics.confidence.toFixed(2) },
                  {
                    label: 'Blink State / EAR L·R',
                    value: `${diagnostics.blink.state} (${diagnostics.blink.earLeft.toFixed(2)}/${diagnostics.blink.earRight.toFixed(2)})`,
                  },
                  {
                    label: 'Raw Gaze (X, Y)',
                    value: `${Math.round(diagnostics.rawX)}, ${Math.round(diagnostics.rawY)}`,
                  },
                  {
                    label: '1-Euro Filtered',
                    value: `${Math.round(diagnostics.filteredX)}, ${Math.round(diagnostics.filteredY)}`,
                  },
                  {
                    label: 'Head Yaw / Pitch',
                    value: `${diagnostics.yaw.toFixed(2)} / ${diagnostics.pitch.toFixed(2)}`,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70"
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">
                      {stat.label}
                    </span>
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-1 block">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onNavigate('calibration')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{calibration ? 'Review Calibration' : 'Run Calibration'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Adjust Smoothing & Dwell Settings</span>
                </button>
              </div>
            </div>
          </div>

          <GazeStabilityTestPanel onNavigateCalibration={() => onNavigate('calibration')} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Favorite Phrases ({favoritePhrases.length})
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {phrases.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                  >
                    <span className="text-sm text-slate-800 dark:text-slate-200">
                      {lang === 'hi' ? p.textHi : p.textEn}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFavoritePhrase(p.id)}
                      aria-label="Toggle favorite phrase"
                      className="p-1.5 rounded-lg cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          p.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recently Spoken Phrases
              </h2>
              {recentPhrases.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Phrases you speak aloud in Communicate appear here for quick reference.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentPhrases.map((text, idx) => (
                    <li
                      key={`${text}_${idx}`}
                      className="py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-200"
                    >
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
