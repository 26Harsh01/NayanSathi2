import React from 'react';
import {
  Bell,
  Crosshair,
  Eye,
  HeartHandshake,
  LayoutGrid,
  MessageSquare,
  Pause,
  Play,
  Settings,
  Square,
  User,
} from 'lucide-react';
import { useEyeTracking } from '../../hooks/useEyeTracking';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';

export type AppRoute =
  | 'landing'
  | 'onboarding'
  | 'communicate'
  | 'life-hub'
  | 'calibration'
  | 'caregiver'
  | 'settings'
  | 'profile';

interface AppShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: React.ReactNode;
  minimalHeader?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentRoute,
  onNavigate,
  children,
  minimalHeader = false,
}) => {
  const { isRunning, isPaused, setIsPaused, startTracking, stopTracking, status } =
    useEyeTracking();
  const { settings, setLanguage, calibration, profile } = useAppState();
  const { dueMedicines, photosMap } = useLifeHub();
  const lang = settings.communication.language;

  const hideSidebar = minimalHeader || currentRoute === 'calibration';

  const navItems: { route: AppRoute; labelEn: string; labelHi: string; icon: React.ReactNode }[] = [
    {
      route: 'communicate',
      labelEn: 'Communicate',
      labelHi: 'संवाद',
      icon: <MessageSquare className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'life-hub',
      labelEn: 'Life Hub',
      labelHi: 'जीवन केंद्र',
      icon: <LayoutGrid className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'calibration',
      labelEn: 'Calibrate',
      labelHi: 'कैलिब्रेट',
      icon: <Crosshair className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'caregiver',
      labelEn: 'Caregiver',
      labelHi: 'देखभालकर्ता',
      icon: <HeartHandshake className="w-4 h-4 shrink-0" />,
    },
    {
      route: 'settings',
      labelEn: 'Settings',
      labelHi: 'सेटिंग्स',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const activeNavItem =
    navItems.find((i) => i.route === currentRoute) ??
    (currentRoute === 'profile'
      ? { labelEn: 'My Profile', labelHi: 'मेरी प्रोफ़ाइल' }
      : null);

  const statusLabel =
    status === 'tracking'
      ? lang === 'hi'
        ? 'ट्रैकिंग सक्रिय'
        : 'Gaze Tracking Active'
      : status === 'blink-paused'
        ? lang === 'hi'
          ? 'पलक विराम'
          : 'Blink Pause'
        : status === 'no-face'
          ? lang === 'hi'
            ? 'चेहरा नहीं मिला'
            : 'Face Not Detected'
          : status === 'multiple-faces'
            ? lang === 'hi'
              ? 'कई चेहरे — चयन आवश्यक'
              : 'Multiple Faces Detected'
            : status === 'low-confidence'
              ? lang === 'hi'
                ? 'कम विश्वास स्तर'
                : 'Low Confidence'
              : status === 'camera-error'
                ? lang === 'hi'
                  ? 'कैमरा त्रुटि'
                  : 'Camera Error'
                : status === 'initializing'
                  ? lang === 'hi'
                    ? 'कैमरा शुरू हो रहा है'
                    : 'Starting Camera'
                  : isRunning
                    ? isPaused
                      ? lang === 'hi'
                        ? 'ट्रैकिंग रुकी हुई'
                        : 'Tracking Paused'
                      : lang === 'hi'
                        ? 'कैमरा तैयार'
                        : 'Camera Ready'
                    : lang === 'hi'
                      ? 'कैमरा बंद'
                      : 'Camera Off';

  const displayName = profile.preferredName || profile.name || 'Guest User';
  const patientInitials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  const avatarUrl = profile.photoAssetId ? photosMap[profile.photoAssetId] : undefined;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Left Navigation Sidebar (Desktop lg+) */}
      {!hideSidebar && (
        <aside
          aria-label="Primary Sidebar Navigation"
          className="hidden lg:flex lg:flex-col lg:w-56 xl:w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen no-print"
        >
          <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                NayanSathi
              </span>
            </button>
          </div>

          <nav
            className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto"
            aria-label="Workspace navigation"
          >
            {navItems.map((item) => {
              const active = currentRoute === item.route;
              const label = lang === 'hi' ? item.labelHi : item.labelEn;
              return (
                <button
                  key={item.route}
                  type="button"
                  data-gaze-target={`nav_${item.route}`}
                  data-gaze-label={label}
                  onClick={() => onNavigate(item.route)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-teal-700 text-white dark:bg-teal-600'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Patient Profile Card -> My Profile */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              data-gaze-target="nav_my_profile"
              data-gaze-label="My Profile"
              onClick={() => onNavigate('profile')}
              className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left cursor-pointer ${
                currentRoute === 'profile'
                  ? 'bg-teal-700 text-white dark:bg-teal-600'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-300 dark:border-slate-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-teal-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {patientInitials || <User className="w-4 h-4" />}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                <p
                  className={`text-xs truncate ${
                    currentRoute === 'profile'
                      ? 'text-teal-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {lang === 'hi' ? 'मेरी प्रोफ़ाइल' : 'My Profile'}
                </p>
              </div>
            </button>
          </div>
        </aside>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm no-print">
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className={`flex items-center gap-2 text-left whitespace-nowrap shrink-0 cursor-pointer ${
                  hideSidebar ? 'flex' : 'lg:hidden'
                }`}
              >
                <Eye className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  NayanSathi
                </span>
              </button>

              {!hideSidebar && activeNavItem && (
                <h1 className="hidden lg:block text-base font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'hi' ? activeNavItem.labelHi : activeNavItem.labelEn}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {dueMedicines.length > 0 && !hideSidebar && (
                <button
                  type="button"
                  onClick={() => onNavigate('life-hub')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{dueMedicines.length} Med Due</span>
                </button>
              )}

              <span
                className={`hidden sm:inline-block text-xs font-medium whitespace-nowrap ${
                  status === 'multiple-faces' || status === 'camera-error'
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : status === 'tracking'
                      ? 'text-teal-700 dark:text-teal-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {statusLabel}
                {calibration ? '' : ' · Uncalibrated'}
              </span>

              <button
                type="button"
                onClick={() => setLanguage(lang === 'en' ? 'hi' : 'en')}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                aria-label="Switch language between English and Hindi"
              >
                {lang === 'en' ? 'EN / हिंदी' : 'हिंदी / EN'}
              </button>

              {isRunning ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsPaused(!isPaused)}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPaused ? 'Resume Gaze' : 'Pause Gaze'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopTracking}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startTracking()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white dark:bg-teal-600 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Start Tracking</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile / tablet compact navigation row */}
          {!minimalHeader && (
            <nav
              className="lg:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto"
              aria-label="Mobile workspace navigation"
            >
              {navItems.map((item) => {
                const active = currentRoute === item.route;
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => onNavigate(item.route)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-teal-600'
                        : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span>{lang === 'hi' ? item.labelHi : item.labelEn}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  currentRoute === 'profile'
                    ? 'bg-slate-900 text-white dark:bg-teal-600'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}</span>
              </button>
            </nav>
          )}
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};
