import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Crosshair,
  Eye,
  HeartHandshake,
  Languages,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sliders,
  Volume2,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { speakText } from '../features/communication/text-to-speech';

interface LandingPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { profile, settings, setLanguage } = useAppState();
  const [previewSentence, setPreviewSentence] = useState('I am thirsty. Please give me some water.');
  const [previewLang, setPreviewLang] = useState<'en' | 'hi'>(settings.communication.language);

  const previewSamples =
    previewLang === 'hi'
      ? [
          'मुझे पानी चाहिए।',
          'कृपया मेरे देखभालकर्ता को बुलाएँ।',
          'मैं अभी आराम करना चाहता हूँ।',
        ]
      : [
          'I am thirsty. Please give me some water.',
          'Please call my caregiver.',
          'I am feeling better today, thank you.',
        ];

  const handlePreviewSpeak = () => {
    speakText(previewSentence, {
      language: previewLang,
      rate: settings.communication.speechRate,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            NayanSathi
          </a>

          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
            aria-label="Primary landing navigation"
          >
            <a
              href="#how-it-works"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#technology"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Technology
            </a>
            <a
              href="#accessibility"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Accessibility
            </a>
            <a
              href="#privacy"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(profile.onboardingCompleted ? 'communicate' : 'onboarding')}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Communicating
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* 1. Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-14 pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lg:col-span-6 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
                  <span>NayanSathi</span>
                  <span aria-hidden="true">·</span>
                  <span>GazeConnect AAC Platform</span>
                </div>

                <h1
                  className="font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)', textWrap: 'balance' }}
                >
                  Your Eyes. Your Voice. Your Freedom.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  NayanSathi turns an ordinary laptop webcam into a personalized, privacy-first eye-controlled communication system. Build sentences with gaze dwell, receive context-aware AI phrase suggestions, and speak aloud in English or Hindi—without needing a mouse, keyboard, or touchscreen.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(profile.onboardingCompleted ? 'communicate' : 'onboarding')
                    }
                    className="px-6 py-3.5 text-base font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Start Communicating</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="#how-it-works"
                    className="px-6 py-3.5 text-base font-semibold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors whitespace-nowrap"
                  >
                    Explore How It Works
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>100% browser-based webcam processing</span>
                  <span aria-hidden="true">·</span>
                  <span>English & हिंदी speech output</span>
                  <span aria-hidden="true">·</span>
                  <span>Offline-ready core AAC</span>
                </div>
              </div>
            </motion.div>

            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900 aspect-video lg:flex-1">
                <img
                  src="/src/assets/images/hero_gaze_communication_1795445889368.jpg"
                  alt="Person comfortably communicating at a bright home desk using webcam gaze tracking"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Interactive Product Preview */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Interactive GazeConnect Voice Preview
                  </span>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLang('en');
                        setLanguage('en');
                        setPreviewSentence('I am thirsty. Please give me some water.');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        previewLang === 'en'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLang('hi');
                        setLanguage('hi');
                        setPreviewSentence('मुझे पानी चाहिए।');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        previewLang === 'hi'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      हिंदी
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {previewSamples.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setPreviewSentence(sample)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        previewSentence === sample
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-teal-600 dark:border-teal-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {previewSentence}
                  </p>
                  <button
                    type="button"
                    onClick={handlePreviewSpeak}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak Aloud</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. How It Works */}
        <section
          id="how-it-works"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-20"
        >
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                How GazeConnect Works
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                From webcam framing to spoken communication in four steps
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Every stage runs directly in your browser. Performance naturally depends on lighting, seating distance, webcam quality, and careful calibration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '01. Enable Webcam',
                  title: 'Local Landmark Framing',
                  desc: 'Grant browser camera access so MediaPipe Face Landmarker can locate eye corners, eyelids, and iris centers locally on your device.',
                },
                {
                  step: '02. Calibrate 9 Points',
                  title: 'Personal Gaze Model',
                  desc: 'Look at nine screen targets while the system filters blinks and outliers, then fits an individualized Polynomial Ridge Regression model.',
                },
                {
                  step: '03. Dwell to Select',
                  title: 'Hands-Free Control',
                  desc: 'Hold your gaze on large communication tiles for your chosen duration (500–3000 ms) while adaptive 1-Euro smoothing reduces cursor jitter.',
                },
                {
                  step: '04. Speak Clearly',
                  title: 'Bilingual Voice Output',
                  desc: 'Assemble phrases or type on the virtual keyboard, review AI or offline sentence completions, and speak aloud via Web Speech synthesis.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 space-y-3"
                >
                  <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {item.step}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Key Features & 4. Eye-Tracking Technology Overview */}
        <section id="technology" className="py-20 max-w-7xl mx-auto px-6 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                Computer Vision & AI Architecture
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Real-time iris geometry paired with head-pose compensation
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Standard webcam tracking often drifts when a user shifts posture. NayanSathi normalizes iris coordinates relative to each eye’s corner axis, accounts for yaw, pitch, and face scale, and rejects natural blinks before predicting screen coordinates.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('calibration')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Crosshair className="w-4 h-4" />
                  <span>Open Calibration Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Inspect Live Diagnostics</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  MediaPipe 478-Point Face & Iris Pipeline
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Extracts both iris centers and perimeter rings, eye corners, eyelid openings, Eye Aspect Ratio (EAR), and facial transformation matrices on every frame, degrading gracefully to a single reliable eye if one eye is temporarily occluded.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Polynomial Ridge Regression
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Trains independent degree-2 regularized X and Y models on your 9-point calibration samples with holdout validation residuals per screen zone.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  1-Euro Adaptive Smoothing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Suppresses micro-jitter while fixating on a button, then increases cutoff frequency dynamically during rapid saccades to reduce cursor lag.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Gemini + Deterministic Fallback
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Expands selected keywords into polite, short sentences via a server-side Gemini endpoint, with full offline rule-based completion if offline.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Blink Protection & Emergency Access
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Natural blinks suspend dwell timers so buttons never misfire, while high-contrast urgent phrases remain one gaze away.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Accessibility & 6. Patient and Caregiver Benefits */}
        <section
          id="accessibility"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-20"
        >
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[4/3]">
              <img
                src="/src/assets/images/caregiver_support_1795445889072.jpg"
                alt="Caregiver and patient reviewing communication settings together on a tablet"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">
                  Built for Patients & Caregivers
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Designed around comfort, fatigue reduction, and shared customization
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Motor abilities and visual needs vary throughout the day. NayanSathi separates distraction-free patient communication from caregiver configuration so everyday speech stays effortless.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: <Sliders className="w-5 h-5 text-teal-700 dark:text-teal-400" />,
                    title: 'Adjustable Dwell, Sizing & High Contrast',
                    text: 'Tune dwell duration from 500 ms to 3000 ms, choose Standard, Large, or Extra-Large buttons, switch Light/Dark/High-Contrast themes, or use Keyboard, Mouse, and Switch navigation anytime.',
                  },
                  {
                    icon: <Languages className="w-5 h-5 text-teal-700 dark:text-teal-400" />,
                    title: 'Seamless English & हिंदी Bilingual AAC',
                    text: 'Switch phrase libraries, Devanagari and QWERTY virtual keyboards, AI completions, and Web Speech voices with a single selection.',
                  },
                  {
                    icon: <HeartHandshake className="w-5 h-5 text-teal-700 dark:text-teal-400" />,
                    title: 'Dedicated Caregiver Workspace',
                    text: 'Add custom household phrases, configure emergency contact numbers, fine-tune smoothing, and assist with point-by-point calibration.',
                  },
                ].map((row) => (
                  <div key={row.title} className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {row.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {row.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {row.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Privacy & Security */}
        <section id="privacy" className="py-20 max-w-7xl mx-auto px-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy & Data Boundaries</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Your webcam video never leaves your browser
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                All facial and iris landmark extraction happens locally in browser memory. NayanSathi never records, uploads, or stores camera footage. Communication history is turned OFF by default and only recorded locally with explicit user or caregiver consent.
              </p>
            </div>

            <div className="lg:col-span-5 space-y-3">
              {[
                'Zero webcam video recording or server upload',
                'Communication history strictly OFF by default',
                'Server-side AI boundary with zero exposed keys',
                'One-click deletion of calibration & local data',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  <Check className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 8. Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-sm text-slate-600 dark:text-slate-400">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              NayanSathi — GazeConnect
            </p>
            <p className="text-xs">
              Browser-based Augmentative and Alternative Communication · Not a certified medical diagnostic device.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate('communicate')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Communicate
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calibration')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Calibrate
            </button>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Patient Hub
            </button>
            <button
              type="button"
              onClick={() => onNavigate('caregiver')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Caregiver
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
