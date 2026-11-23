import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  BriefcaseMedical,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Delete,
  FolderHeart,
  GraduationCap,
  Heart,
  Home,
  Keyboard,
  Layers,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Smile,
  Sparkles,
  Square,
  Star,
  Trash2,
  Trees,
  Users,
  Utensils,
  Volume2,
} from 'lucide-react';
import type { AppRoute } from '../components/layout/AppShell';
import { useAppState } from '../context/AppStateContext';
import { GazeButton } from '../components/gaze/GazeButton';
import { EmergencyContactPanel } from '../components/communication/EmergencyContactPanel';
import { EmergencyModal } from '../components/communication/EmergencyModal';
import { TrackingStatusPanel } from '../components/communication/TrackingStatusPanel';
import {
  COMMUNICATION_CONTEXTS,
  deduplicatePhrases,
  paginateItems,
  QUICK_ACCESS_NEEDS,
} from '../features/communication/context-modes';
import {
  appendCharacterToSentence,
  appendPhraseToSentence,
  backspaceCharacter,
  clearSentence,
  createInitialSentenceState,
  deleteLastWord,
  replaceSentenceWithSuggestion,
  undoSentence,
} from '../features/communication/sentence-builder';
import {
  EN_LETTER_ROWS,
  getControlRow,
  HI_LETTER_ROWS,
  NUMBER_ROWS,
  type VirtualKey,
} from '../features/communication/virtual-keyboard';
import {
  EMERGENCY_PHRASES,
  QUICK_WORDS_EN,
  QUICK_WORDS_HI,
} from '../features/communication/phrase-library';
import {
  pauseSpeech,
  resumeSpeech,
  speakText,
  stopSpeech,
  type SpeechStatus,
} from '../features/communication/text-to-speech';
import { getCommunicationSuggestions } from '../features/ai/suggestion-engine';
import { MY_VOICE_MY_RULES_PHRASES } from '../features/communication/personal-autonomy';
import type { AISuggestion, CommunicationContextId, PhraseItem } from '../types';

interface CommunicatePageProps {
  onNavigate?: (route: AppRoute) => void;
}

type BoardViewMode = 'phrases' | 'keyboard' | 'contexts' | 'autonomy';

const CATEGORY_VISUALS: Record<
  string,
  { icon: React.ReactNode; accentClass: string }
> = {
  favorites: {
    icon: <Star className="w-4 h-4 shrink-0" />,
    accentClass: 'border-amber-300 dark:border-amber-800',
  },
  basic: {
    icon: <Utensils className="w-4 h-4 shrink-0" />,
    accentClass: 'border-teal-300 dark:border-teal-800',
  },
  medical: {
    icon: <BriefcaseMedical className="w-4 h-4 shrink-0" />,
    accentClass: 'border-rose-300 dark:border-rose-800',
  },
  emotions: {
    icon: <Smile className="w-4 h-4 shrink-0" />,
    accentClass: 'border-violet-300 dark:border-violet-800',
  },
  social: {
    icon: <Users className="w-4 h-4 shrink-0" />,
    accentClass: 'border-sky-300 dark:border-sky-800',
  },
  daily: {
    icon: <Calendar className="w-4 h-4 shrink-0" />,
    accentClass: 'border-emerald-300 dark:border-emerald-800',
  },
  emergency: {
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
    accentClass: 'border-red-400 dark:border-red-800',
  },
};

const CONTEXT_ICONS: Record<CommunicationContextId, React.ReactNode> = {
  home: <Home className="w-4 h-4 shrink-0" />,
  hospital: <Building2 className="w-4 h-4 shrink-0" />,
  school: <GraduationCap className="w-4 h-4 shrink-0" />,
  family: <Heart className="w-4 h-4 shrink-0" />,
  outside: <Trees className="w-4 h-4 shrink-0" />,
  custom: <FolderHeart className="w-4 h-4 shrink-0" />,
};

const QUICK_ACCESS_TONES: Record<string, string> = {
  amber: 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100',
  sky: 'bg-sky-50 border-sky-200 text-sky-950 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-100',
  violet: 'bg-violet-50 border-violet-200 text-violet-950 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-100',
  rose: 'bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100',
  slate: 'bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100',
};

const PHRASES_PER_PAGE = 6;

export const CommunicatePage: React.FC<CommunicatePageProps> = ({ onNavigate }) => {
  const {
    settings,
    updateSettings,
    categories,
    phrases,
    addCustomPhrase,
    recordCommunication,
  } = useAppState();

  const lang = settings.communication.language;
  const activeContext = settings.communication.activeContext || 'home';

  const [boardView, setBoardView] = useState<BoardViewMode>('phrases');
  const [sentenceState, setSentenceState] = useState(() => createInitialSentenceState(''));
  const [activeCategoryId, setActiveCategoryId] = useState<string>('basic');
  const [phrasePage, setPhrasePage] = useState<number>(0);
  const [showNumbers, setShowNumbers] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<'gemini' | 'offline'>('offline');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const spacingClass =
    settings.interface.buttonSpacing === 'wide'
      ? 'gap-4'
      : settings.interface.buttonSpacing === 'compact'
        ? 'gap-2.5'
        : 'gap-3';

  const fontClass =
    settings.interface.fontSize === 'xlarge'
      ? 'text-2xl sm:text-3xl'
      : settings.interface.fontSize === 'large'
        ? 'text-xl sm:text-2xl'
        : 'text-lg sm:text-xl';

  // Reset pagination whenever category or language changes
  useEffect(() => {
    setPhrasePage(0);
  }, [activeCategoryId, lang]);

  // Refresh AI / offline suggestions cleanly whenever sentence or context changes
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingSuggestions(true);
      const res = await getCommunicationSuggestions({
        words: sentenceState.selectedTokens,
        currentSentence: sentenceState.text,
        language: lang,
        contextCategory: activeContext === 'custom' ? activeCategoryId : activeContext,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSuggestions(res.suggestions);
        setSuggestionMode(res.mode);
        setLoadingSuggestions(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeCategoryId, activeContext, lang, sentenceState.selectedTokens, sentenceState.text]);

  // Build ordered category tabs including Favorites, 5 core categories, Emergency, and Custom categories
  const orderedCategoryTabs = useMemo(() => {
    const coreIds = ['basic', 'medical', 'emotions', 'social', 'daily'];
    const byId = new Map(categories.map((c) => [c.id, c]));
    const core = coreIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const custom = categories.filter((c) => !coreIds.includes(c.id));

    return [
      { id: 'favorites', nameEn: 'Favorites', nameHi: 'पसंदीदा' },
      ...core,
      { id: 'emergency', nameEn: 'Emergency', nameHi: 'आपातकाल' },
      ...custom,
    ];
  }, [categories]);

  const categoryPhrases = useMemo(() => {
    let rawList: PhraseItem[];
    if (activeCategoryId === 'favorites') {
      rawList = phrases.filter((p) => p.isFavorite);
    } else if (activeCategoryId === 'emergency') {
      rawList = EMERGENCY_PHRASES.map((item) => ({
        id: item.id,
        categoryId: 'emergency',
        textEn: item.textEn,
        textHi: item.textHi,
      }));
    } else {
      rawList = phrases.filter((p) => p.categoryId === activeCategoryId);
    }
    return deduplicatePhrases(rawList);
  }, [activeCategoryId, phrases]);

  const paginatedPhrases = useMemo(
    () => paginateItems(categoryPhrases, phrasePage, PHRASES_PER_PAGE),
    [categoryPhrases, phrasePage]
  );

  const activeContextDef = useMemo(
    () =>
      COMMUNICATION_CONTEXTS.find((c) => c.id === activeContext) ??
      COMMUNICATION_CONTEXTS[0],
    [activeContext]
  );

  const contextShortcuts = useMemo(() => {
    if (activeContext === 'custom') {
      const custom = deduplicatePhrases(phrases.filter((p) => p.isCustom));
      if (custom.length > 0) {
        return custom.slice(0, 6).map((p) => ({
          id: `ctx_custom_${p.id}`,
          textEn: p.textEn,
          textHi: p.textHi,
        }));
      }
      const favs = deduplicatePhrases(phrases.filter((p) => p.isFavorite));
      return favs.slice(0, 6).map((p) => ({
        id: `ctx_fav_${p.id}`,
        textEn: p.textEn,
        textHi: p.textHi,
      }));
    }
    return activeContextDef.shortcuts;
  }, [activeContext, activeContextDef.shortcuts, phrases]);

  const handleSelectContext = (contextId: CommunicationContextId) => {
    // Switching context NEVER modifies the user's composed sentence!
    updateSettings((prev) => ({
      ...prev,
      communication: {
        ...prev.communication,
        activeContext: contextId,
      },
    }));
  };

  const handleSpeak = (textOverride?: string) => {
    const textToSpeak = (textOverride ?? sentenceState.text).trim();
    if (!textToSpeak) return;

    const preferredUri =
      lang === 'hi'
        ? settings.communication.preferredVoiceHi
        : settings.communication.preferredVoiceEn;

    const res = speakText(textToSpeak, {
      language: lang,
      rate: settings.communication.speechRate,
      preferredVoiceURI: preferredUri,
      onStart: () => setSpeechStatus('speaking'),
      onEnd: () => setSpeechStatus('idle'),
      onError: () => setSpeechStatus('idle'),
    });

    if (res.voiceMissingForLanguage) {
      setVoiceWarning(
        lang === 'hi'
          ? 'इस डिवाइस पर हिंदी TTS आवाज़ उपलब्ध नहीं है। ब्राउज़र की डिफ़ॉल्ट आवाज़ से प्रयास किया जा रहा है।'
          : 'No dedicated English voice found on this browser; using default speech output.'
      );
    } else {
      setVoiceWarning(null);
    }

    if (res.started) {
      recordCommunication(textToSpeak, true);
    }
  };

  const handleQuickAccessSpeak = (text: string) => {
    setSentenceState((prev) => replaceSentenceWithSuggestion(prev, text));
    handleSpeak(text);
  };

  const handleSaveFavoritePhrase = () => {
    const clean = sentenceState.text.trim();
    if (!clean) return;
    const targetCategory =
      activeCategoryId === 'favorites' || activeCategoryId === 'emergency'
        ? 'basic'
        : activeCategoryId;
    addCustomPhrase(targetCategory, clean, clean);
    setSavedNotice(lang === 'hi' ? 'वाक्यांश सहेजा गया।' : 'Saved to custom phrases.');
    window.setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleVirtualKey = (key: VirtualKey) => {
    if (key.action === 'toggle-numbers') {
      setShowNumbers((prev) => !prev);
      return;
    }
    if (key.action === 'backspace') {
      setSentenceState((prev) => backspaceCharacter(prev));
      return;
    }
    if (key.action === 'clear') {
      setSentenceState((prev) => clearSentence(prev));
      return;
    }
    if (key.action === 'enter') {
      handleSpeak();
      return;
    }
    if (key.action === 'space') {
      setSentenceState((prev) => appendCharacterToSentence(prev, ' '));
      return;
    }
    setSentenceState((prev) => appendCharacterToSentence(prev, key.value));
  };

  const quickWords = lang === 'hi' ? QUICK_WORDS_HI : QUICK_WORDS_EN;
  const keyboardRows = showNumbers
    ? NUMBER_ROWS
    : lang === 'hi'
      ? HI_LETTER_ROWS
      : EN_LETTER_ROWS;
  const controlRow = getControlRow(lang, showNumbers);

  return (
    <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-5">
      {/* Main 2-Column Workspace (Paired with AppShell Left Nav Rail = 3-Section Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CENTER / MAIN COMMUNICATION AREA */}
        <div className="lg:col-span-8 space-y-4 min-w-0">
          {/* Mode Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <GazeButton
                gazeId="mode_phrases"
                gazeLabel="Quick Phrases"
                variant={boardView === 'phrases' ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => setBoardView('phrases')}
                className="whitespace-nowrap"
              >
                <MessageSquareText className="w-4 h-4" />
                <span>{lang === 'hi' ? 'वाक्यांश बोर्ड' : 'Quick Phrases'}</span>
              </GazeButton>

              <GazeButton
                gazeId="mode_keyboard"
                gazeLabel="Virtual Keyboard"
                variant={boardView === 'keyboard' ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => setBoardView('keyboard')}
                className="whitespace-nowrap"
              >
                <Keyboard className="w-4 h-4" />
                <span>{lang === 'hi' ? 'वर्चुअल कीबोर्ड' : 'Virtual Keyboard'}</span>
              </GazeButton>

              <GazeButton
                gazeId="mode_contexts"
                gazeLabel="Context Boards"
                variant={boardView === 'contexts' ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => setBoardView('contexts')}
                className="whitespace-nowrap"
              >
                <Layers className="w-4 h-4" />
                <span>
                  {lang === 'hi' ? 'संदर्भ मोड' : 'Contexts'}:{' '}
                  {lang === 'hi' ? activeContextDef.labelHi : activeContextDef.labelEn}
                </span>
              </GazeButton>

              <GazeButton
                gazeId="mode_autonomy"
                gazeLabel="My Voice, My Rules"
                variant={boardView === 'autonomy' ? 'selected' : 'default'}
                sizeOverride="standard"
                onClick={() => setBoardView('autonomy')}
                className="whitespace-nowrap"
              >
                <Shield className="w-4 h-4" />
                <span>{lang === 'hi' ? 'मेरी आवाज़, मेरे नियम' : 'My Voice, My Rules'}</span>
              </GazeButton>
            </div>

            <GazeButton
              gazeId="comm_emergency"
              gazeLabel="Emergency Panel"
              variant="danger"
              sizeOverride="standard"
              onClick={() => setEmergencyOpen(true)}
              className="whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{lang === 'hi' ? 'आपातकाल' : 'Emergency'}</span>
            </GazeButton>
          </div>

          {/* 1. Prominent Sentence Builder */}
          <section
            aria-label={lang === 'hi' ? 'वाक्य निर्माता' : 'Sentence builder'}
            className="rounded-2xl border-2 border-teal-600/70 dark:border-teal-500/70 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-h-[80px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center">
                <p
                  className={`font-semibold tracking-tight leading-snug break-words ${fontClass} ${
                    sentenceState.text
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {sentenceState.text ||
                    (lang === 'hi'
                      ? 'बोलने के लिए नीचे वाक्यांश या कीबोर्ड चुनें...'
                      : 'Select phrases or letters below to compose your message...')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <GazeButton
                  gazeId="comm_speak"
                  gazeLabel="Speak Sentence"
                  variant="primary"
                  sizeOverride="large"
                  onClick={() => handleSpeak()}
                  disabled={!sentenceState.text.trim()}
                  className="whitespace-nowrap"
                >
                  <Volume2 className="w-5 h-5" />
                  <span>{lang === 'hi' ? 'बोलें' : 'Speak'}</span>
                </GazeButton>

                {speechStatus === 'speaking' && (
                  <GazeButton
                    gazeId="comm_pause_speech"
                    gazeLabel="Pause Speech"
                    variant="subtle"
                    sizeOverride="large"
                    onClick={() => {
                      pauseSpeech();
                      setSpeechStatus('paused');
                    }}
                  >
                    <Pause className="w-5 h-5" />
                    <span>{lang === 'hi' ? 'रोकें' : 'Pause'}</span>
                  </GazeButton>
                )}

                {speechStatus === 'paused' && (
                  <GazeButton
                    gazeId="comm_resume_speech"
                    gazeLabel="Resume Speech"
                    variant="subtle"
                    sizeOverride="large"
                    onClick={() => {
                      resumeSpeech();
                      setSpeechStatus('speaking');
                    }}
                  >
                    <Play className="w-5 h-5" />
                    <span>{lang === 'hi' ? 'जारी रखें' : 'Resume'}</span>
                  </GazeButton>
                )}

                {(speechStatus === 'speaking' || speechStatus === 'paused') && (
                  <GazeButton
                    gazeId="comm_stop_speech"
                    gazeLabel="Stop Speech"
                    variant="subtle"
                    sizeOverride="large"
                    onClick={() => {
                      stopSpeech();
                      setSpeechStatus('idle');
                    }}
                  >
                    <Square className="w-5 h-5" />
                    <span>{lang === 'hi' ? 'बंद' : 'Stop'}</span>
                  </GazeButton>
                )}
              </div>
            </div>

            {/* Editing Actions Row */}
            <div className="flex flex-wrap items-center gap-2.5">
              <GazeButton
                gazeId="comm_undo"
                gazeLabel="Undo"
                variant="subtle"
                sizeOverride="standard"
                onClick={() => setSentenceState((prev) => undoSentence(prev))}
                disabled={sentenceState.history.length === 0}
                className="whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'hi' ? 'पूर्ववत' : 'Undo'}</span>
              </GazeButton>

              <GazeButton
                gazeId="comm_del_word"
                gazeLabel="Delete Word"
                variant="subtle"
                sizeOverride="standard"
                onClick={() => setSentenceState((prev) => deleteLastWord(prev))}
                disabled={!sentenceState.text}
                className="whitespace-nowrap"
              >
                <Delete className="w-4 h-4" />
                <span>{lang === 'hi' ? 'शब्द हटाएँ' : 'Delete Word'}</span>
              </GazeButton>

              <GazeButton
                gazeId="comm_clear"
                gazeLabel="Clear Message"
                variant="subtle"
                sizeOverride="standard"
                onClick={() => setSentenceState((prev) => clearSentence(prev))}
                disabled={!sentenceState.text}
                className="whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === 'hi' ? 'साफ़ करें' : 'Clear'}</span>
              </GazeButton>

              <GazeButton
                gazeId="comm_save_fav"
                gazeLabel="Save Phrase"
                variant="subtle"
                sizeOverride="standard"
                onClick={handleSaveFavoritePhrase}
                disabled={!sentenceState.text.trim()}
                className="whitespace-nowrap"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>{lang === 'hi' ? 'सहेजें' : 'Save Phrase'}</span>
              </GazeButton>
            </div>

            {voiceWarning && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {voiceWarning}
              </p>
            )}
            {savedNotice && (
              <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                {savedNotice}
              </p>
            )}
          </section>

          {/* 2. AI / Offline Suggested Sentences */}
          <section
            aria-label={lang === 'hi' ? 'सुझाए गए वाक्य' : 'Suggested sentences'}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>
                  {lang === 'hi'
                    ? 'सुझाए गए वाक्य (डालने के लिए चुनें)'
                    : 'AI Suggested Sentences (Select to insert)'}
                </span>
              </div>
              <span className="text-slate-500 dark:text-slate-400">
                {loadingSuggestions
                  ? 'Updating...'
                  : suggestionMode === 'gemini'
                    ? 'Gemini Assist'
                    : 'Offline Smart Suggestions'}
              </span>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 ${spacingClass}`}>
              {suggestions.map((sug, idx) => (
                <GazeButton
                  key={sug.id}
                  gazeId={`comm_sug_${idx}`}
                  gazeLabel={sug.text}
                  variant="default"
                  sizeOverride="standard"
                  onClick={() =>
                    setSentenceState((prev) => replaceSentenceWithSuggestion(prev, sug.text))
                  }
                  className="justify-start text-left"
                >
                  <span>{sug.text}</span>
                </GazeButton>
              ))}
            </div>
          </section>

          {/* 3. Main Communication Grid: Quick Phrases OR Virtual Keyboard OR Context Board */}
          {boardView === 'phrases' && (
            <section
              aria-label={lang === 'hi' ? 'त्वरित वाक्यांश' : 'Quick Phrases'}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
            >
              {/* 7 Organized Categories + Custom */}
              <div className="flex flex-wrap items-center gap-2">
                {orderedCategoryTabs.map((cat) => {
                  const visual = CATEGORY_VISUALS[cat.id];
                  const active = activeCategoryId === cat.id;
                  const label = lang === 'hi' ? cat.nameHi : cat.nameEn;
                  return (
                    <GazeButton
                      key={cat.id}
                      gazeId={`cat_${cat.id}`}
                      gazeLabel={label}
                      variant={active ? 'selected' : 'default'}
                      sizeOverride="standard"
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`whitespace-nowrap ${!active && visual ? visual.accentClass : ''}`}
                    >
                      {visual?.icon}
                      <span>{label}</span>
                    </GazeButton>
                  );
                })}
              </div>

              {/* Paginated Large Phrase Cards */}
              {categoryPhrases.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-300">
                  {activeCategoryId === 'favorites'
                    ? lang === 'hi'
                      ? 'अभी तक कोई पसंदीदा वाक्यांश नहीं है। जीवन केंद्र या वाक्य निर्माता से वाक्यांश सहेजें।'
                      : 'No favorite phrases yet. Star phrases in Life Hub → Gaze Diagnostics or save sentences above.'
                    : lang === 'hi'
                      ? 'इस श्रेणी में अभी तक कोई वाक्यांश नहीं है।'
                      : 'No phrases in this category yet.'}
                </div>
              ) : (
                <>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${spacingClass}`}>
                    {paginatedPhrases.items.map((phrase) => {
                      const text = lang === 'hi' ? phrase.textHi : phrase.textEn;
                      return (
                        <GazeButton
                          key={phrase.id}
                          gazeId={`phr_${phrase.id}`}
                          gazeLabel={text}
                          variant="default"
                          onClick={() =>
                            setSentenceState((prev) => appendPhraseToSentence(prev, text))
                          }
                          className="justify-start text-left"
                        >
                          <span>{text}</span>
                        </GazeButton>
                      );
                    })}
                  </div>

                  {/* Pagination Bar */}
                  {paginatedPhrases.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <GazeButton
                        gazeId="phr_page_prev"
                        gazeLabel="Previous Phrases"
                        variant="subtle"
                        sizeOverride="standard"
                        disabled={paginatedPhrases.page === 0}
                        onClick={() => setPhrasePage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>{lang === 'hi' ? 'पिछला' : 'Previous'}</span>
                      </GazeButton>

                      <span className="text-xs font-semibold font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {lang === 'hi' ? 'पृष्ठ' : 'Page'} {paginatedPhrases.page + 1} /{' '}
                        {paginatedPhrases.totalPages}
                      </span>

                      <GazeButton
                        gazeId="phr_page_next"
                        gazeLabel="Next Phrases"
                        variant="subtle"
                        sizeOverride="standard"
                        disabled={paginatedPhrases.page >= paginatedPhrases.totalPages - 1}
                        onClick={() =>
                          setPhrasePage((p) =>
                            Math.min(paginatedPhrases.totalPages - 1, p + 1)
                          )
                        }
                      >
                        <span>{lang === 'hi' ? 'अगला' : 'Next'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </GazeButton>
                    </div>
                  )}
                </>
              )}

              {/* Quick Words Strip */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'त्वरित शब्द (वाक्य जोड़ने के लिए चुनें)'
                    : 'Quick Words (Tap or dwell to combine words)'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickWords.map((word, idx) => (
                    <GazeButton
                      key={word}
                      gazeId={`qw_${idx}`}
                      gazeLabel={word}
                      variant="subtle"
                      sizeOverride="standard"
                      onClick={() =>
                        setSentenceState((prev) => appendPhraseToSentence(prev, word))
                      }
                    >
                      <span>{word}</span>
                    </GazeButton>
                  ))}
                </div>
              </div>
            </section>
          )}

          {boardView === 'keyboard' && (
            <section
              aria-label="Eye-controlled virtual keyboard"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-2.5"
            >
              {keyboardRows.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {row.map((keyObj) => (
                    <GazeButton
                      key={keyObj.id}
                      gazeId={keyObj.id}
                      gazeLabel={`Key ${keyObj.label}`}
                      variant="default"
                      sizeOverride={
                        settings.interface.buttonSize === 'standard' ? 'standard' : 'large'
                      }
                      onClick={() => handleVirtualKey(keyObj)}
                      className="px-2"
                    >
                      <span className="text-lg font-semibold">{keyObj.label}</span>
                    </GazeButton>
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
                {controlRow.map((keyObj) => (
                  <GazeButton
                    key={keyObj.id}
                    gazeId={keyObj.id}
                    gazeLabel={keyObj.label}
                    variant={keyObj.action === 'enter' ? 'primary' : 'subtle'}
                    sizeOverride="large"
                    onClick={() => handleVirtualKey(keyObj)}
                  >
                    <span>{keyObj.label}</span>
                  </GazeButton>
                ))}
              </div>
            </section>
          )}

          {boardView === 'contexts' && (
            <section
              aria-label={lang === 'hi' ? 'संदर्भ मोड शॉर्टकट' : 'Communication Context Shortcuts'}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi'
                    ? `संदर्भ बोर्ड: ${activeContextDef.labelHi}`
                    : `Context Board: ${activeContextDef.labelEn}`}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === 'hi'
                    ? activeContextDef.descriptionHi
                    : activeContextDef.descriptionEn}
                </p>
              </div>

              {/* 6 Context Mode Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {COMMUNICATION_CONTEXTS.map((ctx) => {
                  const selected = activeContext === ctx.id;
                  const label = lang === 'hi' ? ctx.labelHi : ctx.labelEn;
                  return (
                    <GazeButton
                      key={ctx.id}
                      gazeId={`ctx_board_${ctx.id}`}
                      gazeLabel={`Context ${label}`}
                      variant={selected ? 'selected' : 'default'}
                      sizeOverride="standard"
                      onClick={() => handleSelectContext(ctx.id)}
                      className="whitespace-nowrap"
                    >
                      {CONTEXT_ICONS[ctx.id]}
                      <span>{label}</span>
                    </GazeButton>
                  );
                })}
              </div>

              {contextShortcuts.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-300">
                  {lang === 'hi'
                    ? 'अभी तक कोई कस्टम वाक्यांश सहेजा नहीं गया है। ऊपर "सहेजें" या देखभालकर्ता पोर्टल का उपयोग करें।'
                    : 'No custom phrases saved yet. Use "Save Phrase" above or add custom phrases in the Caregiver Portal.'}
                </div>
              ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${spacingClass}`}>
                  {contextShortcuts.map((shortcut) => {
                    const text = lang === 'hi' ? shortcut.textHi : shortcut.textEn;
                    return (
                      <GazeButton
                        key={shortcut.id}
                        gazeId={`ctx_phrase_${shortcut.id}`}
                        gazeLabel={text}
                        variant="default"
                        onClick={() =>
                          setSentenceState((prev) => appendPhraseToSentence(prev, text))
                        }
                        className="justify-start text-left"
                      >
                        <span>{text}</span>
                      </GazeButton>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {boardView === 'autonomy' && (
            <section
              aria-label={lang === 'hi' ? 'मेरी आवाज़, मेरे नियम' : 'My Voice, My Rules'}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi'
                    ? 'मेरी आवाज़, मेरे नियम — सहमति और स्वायत्तता'
                    : 'My Voice, My Rules — Consent & Personal Autonomy'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'चुनने पर तुरंत बोलने और संदेश बनाने के लिए नीचे कोई विकल्प चुनें।'
                    : 'Select any statement below to speak aloud immediately and set clear boundaries.'}
                </p>
              </div>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${spacingClass}`}>
                {MY_VOICE_MY_RULES_PHRASES.map((item) => {
                  const text = lang === 'hi' ? item.textHi : item.textEn;
                  return (
                    <GazeButton
                      key={item.id}
                      gazeId={`comm_${item.id}`}
                      gazeLabel={text}
                      variant="default"
                      onClick={() => handleQuickAccessSpeak(text)}
                      className="justify-start text-left"
                    >
                      <Volume2 className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-400" />
                      <span>{text}</span>
                    </GazeButton>
                  );
                })}
              </div>
            </section>
          )}

          {/* Compact Context Shortcuts Strip (always handy below main board when not already in Contexts tab) */}
          {boardView !== 'contexts' && (
            <section
              aria-label={lang === 'hi' ? 'सक्रिय संदर्भ शॉर्टकट' : 'Active context shortcuts'}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {CONTEXT_ICONS[activeContext]}
                  <span>
                    {lang === 'hi'
                      ? `${activeContextDef.labelHi} शॉर्टकट`
                      : `${activeContextDef.labelEn} Context Shortcuts`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {COMMUNICATION_CONTEXTS.map((ctx) => {
                    const active = activeContext === ctx.id;
                    const label = lang === 'hi' ? ctx.labelHi : ctx.labelEn;
                    return (
                      <button
                        key={ctx.id}
                        type="button"
                        data-gaze-target={`ctx_strip_${ctx.id}`}
                        data-gaze-label={`Context ${label}`}
                        onClick={() => handleSelectContext(ctx.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-teal-600'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {contextShortcuts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {contextShortcuts.slice(0, 3).map((shortcut) => {
                    const text = lang === 'hi' ? shortcut.textHi : shortcut.textEn;
                    return (
                      <GazeButton
                        key={shortcut.id}
                        gazeId={`ctx_quick_${shortcut.id}`}
                        gazeLabel={text}
                        variant="subtle"
                        sizeOverride="standard"
                        onClick={() =>
                          setSentenceState((prev) => appendPhraseToSentence(prev, text))
                        }
                        className="justify-start text-left"
                      >
                        <span>{text}</span>
                      </GazeButton>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'hi'
                    ? 'कस्टम मोड में अपने सहेजे गए वाक्यांश देखने के लिए कोई वाक्यांश सहेजें।'
                    : 'Save phrases with "Save Phrase" above or add them in Caregiver Portal to appear here.'}
                </p>
              )}
            </section>
          )}
        </div>

        {/* RIGHT / SUPPORT AREA */}
        <aside
          aria-label={lang === 'hi' ? 'सहायता और स्थिति पैनल' : 'Support & Status Sidebar'}
          className="lg:col-span-4 space-y-4 min-w-0"
        >
          {/* 1. Quick-Access Daily Needs */}
          <section
            aria-label={lang === 'hi' ? 'त्वरित दैनिक ज़रूरतें' : 'Quick Access Daily Needs'}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'त्वरित दैनिक ज़रूरतें' : 'Quick Access'}
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'चुनने पर तुरंत बोलें' : 'Speaks immediately'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
              {QUICK_ACCESS_NEEDS.map((need) => {
                const label = lang === 'hi' ? need.labelHi : need.labelEn;
                const spoken = lang === 'hi' ? need.speakHi : need.speakEn;
                const toneClasses = QUICK_ACCESS_TONES[need.tone] || QUICK_ACCESS_TONES.slate;
                return (
                  <button
                    key={need.id}
                    type="button"
                    data-gaze-target={need.id}
                    data-gaze-label={label}
                    onClick={() => handleQuickAccessSpeak(spoken)}
                    className={`relative rounded-xl border min-h-[58px] px-3 py-2.5 text-sm font-semibold flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${toneClasses}`}
                  >
                    <Volume2 className="w-4 h-4 opacity-80 shrink-0" />
                    <span className="leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Collapsible Emergency Contact Shortcut */}
          <EmergencyContactPanel
            onNavigate={onNavigate}
            onOpenEmergencyModal={() => setEmergencyOpen(true)}
            currentSentence={sentenceState.text}
            defaultExpanded={false}
          />

          {/* 3. Current Communication Context Card */}
          <section
            aria-label={lang === 'hi' ? 'वर्तमान संवाद संदर्भ' : 'Current Communication Context'}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-teal-700 dark:text-teal-400">
                  {CONTEXT_ICONS[activeContext]}
                </span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'hi' ? 'संदर्भ मोड' : 'Current Context'}
                </h2>
              </div>
              <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                {lang === 'hi' ? activeContextDef.labelHi : activeContextDef.labelEn}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {COMMUNICATION_CONTEXTS.map((ctx) => {
                const selected = activeContext === ctx.id;
                const label = lang === 'hi' ? ctx.labelHi : ctx.labelEn;
                return (
                  <button
                    key={ctx.id}
                    type="button"
                    data-gaze-target={`side_ctx_${ctx.id}`}
                    data-gaze-label={`Context ${label}`}
                    onClick={() => handleSelectContext(ctx.id)}
                    className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      selected
                        ? 'bg-teal-700 text-white border-teal-800 dark:bg-teal-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800'
                    }`}
                  >
                    {CONTEXT_ICONS[ctx.id]}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Live Tracking Status Panel & Detailed Diagnostics Access */}
          <TrackingStatusPanel onNavigate={onNavigate} />
        </aside>
      </div>

      <EmergencyModal
        open={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
