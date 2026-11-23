import React from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Eye,
  Pause,
  Play,
  Users,
} from 'lucide-react';
import type { AppRoute } from '../layout/AppShell';
import { useAppState } from '../../context/AppStateContext';
import { useEyeTracking } from '../../hooks/useEyeTracking';
import { GazeButton } from '../gaze/GazeButton';
import { WebcamLandmarkPreview } from '../gaze/WebcamLandmarkPreview';

interface TrackingStatusPanelProps {
  onNavigate?: (route: AppRoute) => void;
}

export const TrackingStatusPanel: React.FC<TrackingStatusPanelProps> = ({ onNavigate }) => {
  const { settings, calibration } = useAppState();
  const {
    isRunning,
    isPaused,
    setIsPaused,
    startTracking,
    status,
    calibrationStale,
    diagnostics,
    selectTrackingSubject,
    clearSelectedSubject,
  } = useEyeTracking();

  const lang = settings.communication.language;

  const cameraStatusText = !isRunning
    ? status === 'camera-error'
      ? lang === 'hi'
        ? 'कैमरा त्रुटि'
        : 'Camera Error'
      : status === 'initializing'
        ? lang === 'hi'
          ? 'शुरू हो रहा है'
          : 'Starting'
        : lang === 'hi'
          ? 'बंद'
          : 'Camera Off'
    : isPaused
      ? lang === 'hi'
        ? 'रोका गया'
        : 'Paused'
      : lang === 'hi'
        ? 'सक्रिय'
        : 'Active';

  const faceDetectionText = !isRunning
    ? lang === 'hi'
      ? 'निष्क्रिय'
      : 'Idle'
    : diagnostics.faceCount === 0
      ? lang === 'hi'
        ? 'चेहरा नहीं मिला'
        : 'No face detected'
      : diagnostics.requiresSubjectSelection
        ? lang === 'hi'
          ? 'चयन आवश्यक'
          : 'Selection required'
        : lang === 'hi'
          ? 'चेहरा पहचाना गया'
          : 'Face detected';

  const trackingStateText = !isRunning
    ? lang === 'hi'
      ? 'निष्क्रिय'
      : 'Inactive'
    : isPaused
      ? lang === 'hi'
        ? 'रुका हुआ'
        : 'Paused'
      : status === 'multiple-faces'
        ? lang === 'hi'
          ? 'अस्पष्टता पर रुका'
          : 'Paused (Multi-face)'
        : status === 'blink-paused'
          ? lang === 'hi'
            ? 'पलक विराम'
            : 'Blink Pause'
          : status === 'tracking'
            ? lang === 'hi'
              ? 'सक्रिय'
              : 'Active'
            : lang === 'hi'
              ? 'तैयार'
              : 'Standby';

  const calibrationText = !calibration
    ? lang === 'hi'
      ? 'कैलिब्रेट नहीं'
      : 'Uncalibrated'
    : calibrationStale
      ? lang === 'hi'
        ? 'पुनः कैलिब्रेट करें'
        : 'Viewport Changed'
      : calibration.qualityTier === 'strong'
        ? lang === 'hi'
          ? 'उत्तम'
          : 'Strong'
        : calibration.qualityTier === 'moderate'
          ? lang === 'hi'
            ? 'मध्यम'
            : 'Moderate'
          : lang === 'hi'
            ? 'कमज़ोर'
            : 'Needs Recalibration';

  const confidencePct =
    isRunning && diagnostics.confidence > 0
      ? `${Math.round(diagnostics.confidence * 100)}%`
      : '—';

  const subjectText = !isRunning
    ? '—'
    : diagnostics.requiresSubjectSelection
      ? lang === 'hi'
        ? 'चयन लंबित'
        : 'Pending Selection'
      : diagnostics.selectedSubjectLabel || (lang === 'hi' ? 'कोई नहीं' : 'None');

  return (
    <section
      aria-label={lang === 'hi' ? 'लाइव ट्रैकिंग स्थिति' : 'Live Tracking Status'}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning && !isPaused && status === 'tracking' ? (
            <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          ) : (
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
          )}
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {lang === 'hi' ? 'लाइव ट्रैकिंग स्थिति' : 'Tracking Status'}
          </h2>
        </div>

        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${
            !isRunning || isPaused
              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              : diagnostics.requiresSubjectSelection
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200'
                : status === 'tracking'
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {trackingStateText}
        </span>
      </div>

      {/* Multi-face selection pause alert */}
      {isRunning && diagnostics.requiresSubjectSelection && diagnostics.detectedFaces.length > 1 && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2.5"
        >
          <div className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">
                {lang === 'hi'
                  ? `${diagnostics.faceCount} चेहरे मिले — गेज़ नियंत्रण रोका गया`
                  : `${diagnostics.faceCount} faces detected — gaze control paused`}
              </p>
              <p className="text-amber-900/90 dark:text-amber-200/90">
                {lang === 'hi'
                  ? 'ट्रैक करने के लिए इच्छित व्यक्ति चुनें:'
                  : 'Select the intended person to resume tracking:'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {diagnostics.detectedFaces.map((face) => (
              <button
                key={face.index}
                type="button"
                onClick={() => selectTrackingSubject(face.index)}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{face.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Miniature webcam preview + compact status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        <div className="xl:col-span-5">
          <WebcamLandmarkPreview compact showLandmarks className="w-full" />
        </div>

        <dl className="xl:col-span-7 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'कैमरा' : 'Camera'}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-white truncate">
              {cameraStatusText}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'चेहरा पहचान' : 'Face Status'}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-white truncate">
              {faceDetectionText}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'चेहरे की संख्या' : 'Detected Faces'}
            </dt>
            <dd className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              {isRunning ? diagnostics.faceCount : 0}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'विश्वास स्तर' : 'Confidence'}
            </dt>
            <dd className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              {confidencePct}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'चयनित व्यक्ति' : 'Tracked Subject'}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-white flex items-center justify-between gap-2">
              <span className="truncate">{subjectText}</span>
              {isRunning && diagnostics.faceCount > 1 && !diagnostics.requiresSubjectSelection && (
                <button
                  type="button"
                  onClick={clearSelectedSubject}
                  className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  {lang === 'hi' ? 'बदलें' : 'Switch'}
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'कैलिब्रेशन' : 'Calibration'}
            </dt>
            <dd
              className={`font-semibold truncate ${
                !calibration || calibrationStale || calibration.qualityTier === 'needs-recalibration'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-teal-700 dark:text-teal-400'
              }`}
            >
              {calibrationText}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {lang === 'hi' ? 'फ़ोकस लक्ष्य' : 'Focused Target'}
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-white truncate">
              {diagnostics.focusedTargetLabel || (lang === 'hi' ? 'कोई नहीं' : 'None')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Controls Row */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
        {!isRunning ? (
          <GazeButton
            gazeId="track_panel_start"
            gazeLabel="Start Camera"
            variant="primary"
            sizeOverride="standard"
            onClick={() => startTracking()}
            className="flex-1 whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>{lang === 'hi' ? 'कैमरा शुरू करें' : 'Start Camera'}</span>
          </GazeButton>
        ) : (
          <GazeButton
            gazeId="track_panel_pause"
            gazeLabel={isPaused ? 'Resume Tracking' : 'Pause Tracking'}
            variant={isPaused ? 'primary' : 'subtle'}
            sizeOverride="standard"
            onClick={() => setIsPaused(!isPaused)}
            className="flex-1 whitespace-nowrap"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>
              {isPaused
                ? lang === 'hi'
                  ? 'ट्रैकिंग शुरू करें'
                  : 'Resume'
                : lang === 'hi'
                  ? 'ट्रैकिंग रोकें'
                  : 'Pause'}
            </span>
          </GazeButton>
        )}

        {onNavigate && (!calibration || calibrationStale) && (
          <GazeButton
            gazeId="track_panel_calibrate"
            gazeLabel="Calibrate"
            variant="default"
            sizeOverride="standard"
            onClick={() => onNavigate('calibration')}
            className="whitespace-nowrap"
          >
            <Crosshair className="w-4 h-4" />
            <span>{lang === 'hi' ? 'कैलिब्रेट' : 'Calibrate'}</span>
          </GazeButton>
        )}

        {onNavigate && (
          <GazeButton
            gazeId="track_panel_diagnostics"
            gazeLabel="Detailed Diagnostics"
            variant="default"
            sizeOverride="standard"
            onClick={() => onNavigate('dashboard')}
            className="whitespace-nowrap"
          >
            <Activity className="w-4 h-4" />
            <span>{lang === 'hi' ? 'डायग्नोस्टिक्स' : 'Diagnostics'}</span>
          </GazeButton>
        )}
      </div>
    </section>
  );
};
