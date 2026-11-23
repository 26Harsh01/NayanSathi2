import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, Eye, Languages, Sliders } from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { useEyeTracking } from '../hooks/useEyeTracking';
import type { ButtonSize, Language } from '../types';

interface OnboardingPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { settings, updateSettings, setLanguage, updateProfile } = useAppState();
  const { startTracking, errorMessage } = useEyeTracking();

  const [step, setStep] = useState(1);
  const [startingCamera, setStartingCamera] = useState(false);

  const lang = settings.communication.language;
  const buttonSize = settings.interface.buttonSize;

  const completeAndGo = (target: AppRoute) => {
    updateProfile((prev) => ({ ...prev, onboardingCompleted: true }));
    onNavigate(target);
  };

  const handleEnableCameraAndCalibrate = async () => {
    setStartingCamera(true);
    const ok = await startTracking();
    setStartingCamera(false);
    if (ok) {
      completeAndGo('calibration');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            Step {step} of 5
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {step === 1 && (lang === 'hi' ? 'NayanSathi में आपका स्वागत है' : 'Welcome to NayanSathi — GazeConnect')}
            {step === 2 && (lang === 'hi' ? 'अपनी भाषा चुनें' : 'Choose Your Communication Language')}
            {step === 3 && (lang === 'hi' ? 'बटन का आकार चुनें' : 'Choose Interface Button Size')}
            {step === 4 && (lang === 'hi' ? 'कैमरा अनुमति निर्देश' : 'Camera Permission & Seating Guide')}
            {step === 5 && (lang === 'hi' ? 'आई-ट्रैकिंग सेटअप शुरू करें' : 'Start Eye-Tracking Setup')}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => completeAndGo('communicate')}
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
        >
          {lang === 'hi' ? 'सीधे संवाद पर जाएँ' : 'Skip to Communicate'}
        </button>
      </div>

      {/* Step Progress Bar */}
      <div className="grid grid-cols-5 gap-2" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-colors ${
              idx <= step ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <p className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
              NayanSathi helps you speak, select phrases, and reach your caregiver using only eye movements through your webcam—or with keyboard, mouse, or switch navigation whenever preferred.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your camera feed is processed strictly inside your browser and is never uploaded or stored.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Languages className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Select the primary language for phrases, keyboard, AI suggestions, and speech:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { code: 'en', title: 'English', sub: 'QWERTY keyboard & English speech voices' },
                { code: 'hi', title: 'हिंदी (Hindi)', sub: 'देवनागरी कीबोर्ड और हिंदी वाणी समर्थन' },
              ] as { code: Language; title: string; sub: string }[]).map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLanguage(opt.code)}
                  className={`p-5 rounded-xl border text-left space-y-1 transition-colors cursor-pointer ${
                    lang === opt.code
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-600/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {opt.title}
                    </span>
                    {lang === opt.code && <Check className="w-5 h-5 text-teal-700 dark:text-teal-400" />}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Sliders className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>Larger buttons make gaze dwell targets much easier to hit comfortably:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { id: 'standard', title: 'Standard', desc: 'Compact grid, more tiles visible' },
                { id: 'large', title: 'Large (Recommended)', desc: 'Balanced targets for everyday gaze' },
                { id: 'xlarge', title: 'Extra-Large', desc: 'Maximum spacing for effortless dwell' },
              ] as { id: ButtonSize; title: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    updateSettings((prev) => ({
                      ...prev,
                      interface: { ...prev.interface, buttonSize: opt.id },
                    }))
                  }
                  className={`p-5 rounded-xl border text-left space-y-1.5 cursor-pointer ${
                    buttonSize === opt.id
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 ring-2 ring-teal-600/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span className="text-base font-bold text-slate-900 dark:text-white block">
                    {opt.title}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 block">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <li>1. Sit comfortably about 45–65 cm from your screen with your face evenly lit from the front.</li>
              <li>2. Avoid strong backlighting behind your head (such as an uncovered bright window directly behind you).</li>
              <li>3. When the browser asks for Camera permission on the next step, choose <strong>Allow</strong>.</li>
              <li>4. Video frames stay completely local inside your browser memory and are never uploaded.</li>
            </ul>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-base text-slate-700 dark:text-slate-200 leading-relaxed">
              We are ready to turn on your webcam and run a quick 9-point gaze calibration. You can also skip calibration for now and explore the AAC board using mouse or keyboard.
            </p>
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
                {errorMessage}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={startingCamera}
                onClick={handleEnableCameraAndCalibrate}
                className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Camera className="w-4 h-4" />
                <span>{startingCamera ? 'Starting Camera...' : 'Enable Camera & Start Calibration'}</span>
              </button>
              <button
                type="button"
                onClick={() => completeAndGo('communicate')}
                className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Open Communicate Without Camera
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {step < 5 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-teal-600 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
