import React, { useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImagePlus,
  Minus,
  Plus,
  ShoppingBag,
  SkipForward,
  Trash2,
  Users,
  Utensils,
  Volume2,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { GazeButton } from '../gaze/GazeButton';
import {
  PUBLIC_CONTEXT_PHRASES,
  PUBLIC_INTERACTION_CORE,
  RESTAURANT_MENU_ITEMS,
} from '../../features/communication/personal-autonomy';
import { speakText } from '../../features/communication/text-to-speech';
import type { RoutineSection } from '../../types';

export type ActivitiesSubTab =
  | 'routine'
  | 'shopping'
  | 'restaurant'
  | 'public'
  | 'appointments';

interface ActivitiesPanelProps {
  initialTab?: ActivitiesSubTab;
}

const ROUTINE_SECTIONS: { id: RoutineSection; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'hygiene', label: 'Personal Hygiene' },
  { id: 'meals', label: 'Meals' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'medication', label: 'Medication' },
  { id: 'rest', label: 'Rest' },
  { id: 'evening', label: 'Evening' },
];

const RESTAURANT_PREFS = [
  'Mild spice',
  'No spicy',
  'Soft texture',
  'Warm temperature',
  'No sugar',
  'Small portion',
];

export const ActivitiesPanel: React.FC<ActivitiesPanelProps> = ({
  initialTab = 'routine',
}) => {
  const { settings } = useAppState();
  const {
    state,
    photosMap,
    uploadPhotoAsset,
    updateRoutineStatus,
    addRoutineItem,
    deleteRoutineItem,
    addShoppingCatalogItem,
    adjustShoppingListQuantity,
    clearShoppingList,
    toggleRestaurantDish,
    toggleRestaurantPreference,
    clearRestaurantSelections,
    addAppointment,
    respondToAppointment,
    deleteAppointment,
    createHelpRequest,
    getPersonalIntroText,
  } = useLifeHub();

  const lang = settings.communication.language;
  const [subTab, setSubTab] = useState<ActivitiesSubTab>(initialTab);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Routine step index (one activity at a time)
  const [routineIdx, setRoutineIdx] = useState(0);
  const [rtTitle, setRtTitle] = useState('');
  const [rtInstr, setRtInstr] = useState('');
  const [rtSection, setRtSection] = useState<RoutineSection>('morning');
  const [rtTime, setRtTime] = useState('10:00');

  // Shopping custom item
  const [shopNameEn, setShopNameEn] = useState('');
  const [shopCategory, setShopCategory] = useState('Groceries');
  const [shopPhotoId, setShopPhotoId] = useState<string | undefined>(undefined);
  const shopFileRef = useRef<HTMLInputElement>(null);

  // Public interaction context
  const [publicCtx, setPublicCtx] = useState<'transport' | 'shopping' | 'appointments' | 'everyday'>(
    'everyday'
  );

  // Appointments form
  const [apptTitle, setApptTitle] = useState('');
  const [apptDate, setApptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [apptTime, setApptTime] = useState('11:00');
  const [apptLoc, setApptLoc] = useState('');
  const [apptContact, setApptContact] = useState('');
  const [apptNotes, setApptNotes] = useState('');

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

  const currentRoutine =
    state.routines[Math.min(routineIdx, Math.max(0, state.routines.length - 1))] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2.5">
        <GazeButton
          gazeId="act_tab_routine"
          variant={subTab === 'routine' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('routine')}
        >
          <Clock className="w-4 h-4" />
          <span>Daily Routine Assistant</span>
        </GazeButton>

        <GazeButton
          gazeId="act_tab_shopping"
          variant={subTab === 'shopping' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('shopping')}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Shopping Mode</span>
        </GazeButton>

        <GazeButton
          gazeId="act_tab_restaurant"
          variant={subTab === 'restaurant' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('restaurant')}
        >
          <Utensils className="w-4 h-4" />
          <span>Restaurant Mode</span>
        </GazeButton>

        <GazeButton
          gazeId="act_tab_public"
          variant={subTab === 'public' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('public')}
        >
          <Users className="w-4 h-4" />
          <span>Public Interaction</span>
        </GazeButton>

        <GazeButton
          gazeId="act_tab_appts"
          variant={subTab === 'appointments' ? 'selected' : 'default'}
          sizeOverride="standard"
          onClick={() => setSubTab('appointments')}
        >
          <Calendar className="w-4 h-4" />
          <span>Appointment Companion</span>
        </GazeButton>
      </div>

      {feedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-sm font-medium text-teal-900 dark:text-teal-200"
        >
          {feedback}
        </div>
      )}

      {/* 10. DAILY ROUTINE ASSISTANT */}
      {subTab === 'routine' && (
        <div className="space-y-6">
          {currentRoutine ? (
            <div className="rounded-2xl border-2 border-teal-600/80 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase text-teal-700 dark:text-teal-400">
                  {currentRoutine.section} · Step {routineIdx + 1} of {state.routines.length}
                </span>
                <span className="font-mono tabular-nums">
                  {currentRoutine.scheduledTime || 'Flexible'} · Status: {currentRoutine.status}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? currentRoutine.titleHi : currentRoutine.titleEn}
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-300">
                  {lang === 'hi'
                    ? currentRoutine.instructionsHi
                    : currentRoutine.instructionsEn}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <GazeButton
                  gazeId="rt_speak"
                  variant="subtle"
                  sizeOverride="large"
                  onClick={() =>
                    speakPhrase(
                      `${lang === 'hi' ? currentRoutine.titleHi : currentRoutine.titleEn}. ${
                        lang === 'hi'
                          ? currentRoutine.instructionsHi
                          : currentRoutine.instructionsEn
                      }`
                    )
                  }
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Read Instructions</span>
                </GazeButton>

                <GazeButton
                  gazeId="rt_done"
                  variant="primary"
                  sizeOverride="large"
                  onClick={() => {
                    updateRoutineStatus(currentRoutine.id, 'done');
                    if (routineIdx < state.routines.length - 1) setRoutineIdx((i) => i + 1);
                    showMsg('Routine step marked Done.');
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done</span>
                </GazeButton>

                <GazeButton
                  gazeId="rt_skip"
                  variant="default"
                  sizeOverride="large"
                  onClick={() => {
                    updateRoutineStatus(currentRoutine.id, 'skipped');
                    if (routineIdx < state.routines.length - 1) setRoutineIdx((i) => i + 1);
                    showMsg('Routine step skipped.');
                  }}
                >
                  <SkipForward className="w-4 h-4" />
                  <span>Skip</span>
                </GazeButton>

                <GazeButton
                  gazeId="rt_help"
                  variant="danger"
                  sizeOverride="large"
                  onClick={() => {
                    updateRoutineStatus(currentRoutine.id, 'help');
                    speakPhrase(`I need help with: ${currentRoutine.titleEn}`);
                    showMsg('Routine assistance request sent.');
                  }}
                >
                  <span>Need help</span>
                </GazeButton>

                <GazeButton
                  gazeId="rt_later"
                  variant="subtle"
                  sizeOverride="large"
                  onClick={() => {
                    updateRoutineStatus(currentRoutine.id, 'later');
                    if (routineIdx < state.routines.length - 1) setRoutineIdx((i) => i + 1);
                    showMsg('Routine step deferred to later.');
                  }}
                >
                  <span>Remind me later</span>
                </GazeButton>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <GazeButton
                  gazeId="rt_prev"
                  variant="subtle"
                  sizeOverride="standard"
                  disabled={routineIdx === 0}
                  onClick={() => setRoutineIdx((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Step</span>
                </GazeButton>
                <GazeButton
                  gazeId="rt_next"
                  variant="subtle"
                  sizeOverride="standard"
                  disabled={routineIdx >= state.routines.length - 1}
                  onClick={() =>
                    setRoutineIdx((i) => Math.min(state.routines.length - 1, i + 1))
                  }
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </GazeButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No routine steps configured.</p>
          )}

          {/* Add / overview routine items */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add Routine Step & Today's Schedule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <select
                value={rtSection}
                onChange={(e) => setRtSection(e.target.value as RoutineSection)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {ROUTINE_SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Activity title *"
                value={rtTitle}
                onChange={(e) => setRtTitle(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Visual instructions"
                value={rtInstr}
                onChange={(e) => setRtInstr(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={rtTime}
                  onChange={(e) => setRtTime(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => {
                    const res = addRoutineItem({
                      section: rtSection,
                      titleEn: rtTitle,
                      titleHi: rtTitle,
                      instructionsEn: rtInstr || 'Complete comfortably at your own pace.',
                      instructionsHi: rtInstr || 'आराम से अपनी गति से पूरा करें।',
                      scheduledTime: rtTime,
                    });
                    if (!res.ok) {
                      showMsg(res.error || 'Could not add routine.');
                      return;
                    }
                    setRtTitle('');
                    setRtInstr('');
                    showMsg('Routine step added.');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
              {state.routines.map((rt, idx) => (
                <div
                  key={rt.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => setRoutineIdx(idx)}
                    className="text-left flex-1 cursor-pointer"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {rt.scheduledTime ? `${rt.scheduledTime} · ` : ''}
                      {lang === 'hi' ? rt.titleHi : rt.titleEn}
                    </p>
                    <p className="text-slate-500 capitalize">
                      {rt.section} · {rt.status}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRoutineItem(rt.id)}
                    aria-label="Delete routine step"
                    className="p-1 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 11A. SHOPPING MODE */}
      {subTab === 'shopping' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {state.shoppingCatalog.map((item) => {
                const name = lang === 'hi' ? item.nameHi : item.nameEn;
                const photoUrl = item.photoAssetId ? photosMap[item.photoAssetId] : undefined;
                const existing = state.shoppingList.find((e) => e.itemId === item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                  >
                    {photoUrl && (
                      <img
                        src={photoUrl}
                        alt={name}
                        className="w-full h-28 object-cover rounded-xl"
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">
                          {name}
                        </p>
                        <p className="text-xs text-slate-500">{item.category}</p>
                      </div>
                      <span className="font-mono font-bold text-sm tabular-nums">
                        {existing?.quantity ?? 0}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <GazeButton
                        gazeId={`shop_add_${item.id}`}
                        variant="primary"
                        sizeOverride="standard"
                        onClick={() => adjustShoppingListQuantity(item, 1)}
                        className="flex-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </GazeButton>
                      <GazeButton
                        gazeId={`shop_sub_${item.id}`}
                        variant="subtle"
                        sizeOverride="standard"
                        disabled={!existing}
                        onClick={() => adjustShoppingListQuantity(item, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </GazeButton>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Custom Shopping Item
              </h4>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Item name"
                  value={shopNameEn}
                  onChange={(e) => setShopNameEn(e.target.value)}
                  className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={shopCategory}
                  onChange={(e) => setShopCategory(e.target.value)}
                  className="w-36 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <input
                  ref={shopFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const id = await uploadPhotoAsset('shop', f);
                    setShopPhotoId(id);
                  }}
                />
                <button
                  type="button"
                  onClick={() => shopFileRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{shopPhotoId ? 'Photo Ready' : 'Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!shopNameEn.trim()) return;
                    addShoppingCatalogItem(shopNameEn, shopNameEn, shopCategory, shopPhotoId);
                    setShopNameEn('');
                    setShopPhotoId(undefined);
                    showMsg('Added custom shopping item.');
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>

          {/* Active Shopping List */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              My Shopping List ({state.shoppingList.length})
            </h3>
            {state.shoppingList.length === 0 ? (
              <p className="text-sm text-slate-500">
                Select items on the left using gaze or click to build your shopping list.
              </p>
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {state.shoppingList.map((entry) => (
                    <li
                      key={entry.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex justify-between"
                    >
                      <span className="font-medium">{entry.name}</span>
                      <span className="font-mono tabular-nums font-bold">× {entry.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2.5 pt-2">
                  <GazeButton
                    gazeId="shop_speak_list"
                    variant="primary"
                    sizeOverride="standard"
                    onClick={() => {
                      const summary = state.shoppingList
                        .map((i) => `${i.quantity} ${i.name}`)
                        .join(', ');
                      speakPhrase(`Here is my shopping list: ${summary}`);
                    }}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Speak List</span>
                  </GazeButton>
                  <GazeButton
                    gazeId="shop_send_cg"
                    variant="default"
                    sizeOverride="standard"
                    onClick={() => {
                      const summary = state.shoppingList
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(', ');
                      createHelpRequest('general', 'Shopping List Request', summary);
                      showMsg('Shopping list sent to Help Request Tracker.');
                    }}
                  >
                    <span>Send to Caregiver</span>
                  </GazeButton>
                  <GazeButton
                    gazeId="shop_clear"
                    variant="subtle"
                    sizeOverride="standard"
                    onClick={clearShoppingList}
                  >
                    <span>Clear</span>
                  </GazeButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 11B. RESTAURANT MODE */}
      {subTab === 'restaurant' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2.5">
            <GazeButton
              gazeId="rest_water"
              variant="primary"
              sizeOverride="standard"
              onClick={() => speakPhrase('Could I please have some water?')}
            >
              <Volume2 className="w-4 h-4" />
              <span>Ask for Water</span>
            </GazeButton>
            <GazeButton
              gazeId="rest_assist"
              variant="default"
              sizeOverride="standard"
              onClick={() => speakPhrase('Excuse me, I need some assistance with ordering.')}
            >
              <Volume2 className="w-4 h-4" />
              <span>Ask for Assistance</span>
            </GazeButton>
            <GazeButton
              gazeId="rest_done"
              variant="subtle"
              sizeOverride="standard"
              onClick={() => speakPhrase('Thank you, I have finished eating.')}
            >
              <Volume2 className="w-4 h-4" />
              <span>I Have Finished Eating</span>
            </GazeButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RESTAURANT_MENU_ITEMS.map((dish) => {
              const label = lang === 'hi' ? dish.nameHi : dish.nameEn;
              const selected = state.restaurantSelectedDishes.includes(dish.id);
              return (
                <GazeButton
                  key={dish.id}
                  gazeId={`rest_dish_${dish.id}`}
                  variant={selected ? 'selected' : 'default'}
                  sizeOverride="large"
                  onClick={() => toggleRestaurantDish(dish.id)}
                  className="justify-between text-left"
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-80 capitalize">{dish.category}</span>
                </GazeButton>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Dietary & Preparation Preferences
            </h3>
            <div className="flex flex-wrap gap-2">
              {RESTAURANT_PREFS.map((pref) => (
                <GazeButton
                  key={pref}
                  gazeId={`rest_pref_${pref.replace(/\s+/g, '_')}`}
                  variant={state.restaurantPreferences.includes(pref) ? 'selected' : 'subtle'}
                  sizeOverride="standard"
                  onClick={() => toggleRestaurantPreference(pref)}
                >
                  <span>{pref}</span>
                </GazeButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <GazeButton
                gazeId="rest_speak_order"
                variant="primary"
                sizeOverride="large"
                disabled={state.restaurantSelectedDishes.length === 0}
                onClick={() => {
                  const chosen = RESTAURANT_MENU_ITEMS.filter((d) =>
                    state.restaurantSelectedDishes.includes(d.id)
                  ).map((d) => (lang === 'hi' ? d.nameHi : d.nameEn));
                  const prefs = state.restaurantPreferences.join(', ');
                  const line = `I would like to order: ${chosen.join(', ')}.${prefs ? ` Preferences: ${prefs}.` : ''}`;
                  speakPhrase(line);
                }}
              >
                <Volume2 className="w-4 h-4" />
                <span>Speak Full Order Aloud</span>
              </GazeButton>

              <GazeButton
                gazeId="rest_clear"
                variant="subtle"
                sizeOverride="standard"
                onClick={clearRestaurantSelections}
              >
                <span>Clear Order</span>
              </GazeButton>
            </div>
          </div>
        </div>
      )}

      {/* 12. PUBLIC INTERACTION MODE */}
      {subTab === 'public' && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-teal-600/80 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                My Personal Introduction Card
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {getPersonalIntroText()}
              </p>
            </div>
            <GazeButton
              gazeId="pub_speak_intro"
              variant="primary"
              sizeOverride="large"
              onClick={() => speakPhrase(getPersonalIntroText())}
            >
              <Volume2 className="w-5 h-5" />
              <span>Speak Introduction</span>
            </GazeButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PUBLIC_INTERACTION_CORE.map((item) => {
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

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['everyday', 'transport', 'shopping', 'appointments'] as const).map((ctx) => (
                <GazeButton
                  key={ctx}
                  gazeId={`pub_ctx_${ctx}`}
                  variant={publicCtx === ctx ? 'selected' : 'subtle'}
                  sizeOverride="standard"
                  onClick={() => setPublicCtx(ctx)}
                >
                  <span className="capitalize">{ctx}</span>
                </GazeButton>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PUBLIC_CONTEXT_PHRASES[publicCtx].map((item) => {
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
        </div>
      )}

      {/* 13. APPOINTMENT COMPANION */}
      {subTab === 'appointments' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add Upcoming Appointment
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <input
                type="text"
                placeholder="Appointment title *"
                value={apptTitle}
                onChange={(e) => setApptTitle(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <input
                  type="time"
                  value={apptTime}
                  onChange={(e) => setApptTime(e.target.value)}
                  className="w-28 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <input
                type="text"
                placeholder="Location / Clinic"
                value={apptLoc}
                onChange={(e) => setApptLoc(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Contact phone / email"
                value={apptContact}
                onChange={(e) => setApptContact(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Notes"
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => {
                  const res = addAppointment({
                    title: apptTitle,
                    date: apptDate,
                    time: apptTime,
                    location: apptLoc,
                    contactInfo: apptContact,
                    notes: apptNotes,
                  });
                  if (!res.ok) {
                    showMsg(res.error || 'Could not add appointment.');
                    return;
                  }
                  setApptTitle('');
                  setApptLoc('');
                  setApptContact('');
                  setApptNotes('');
                  showMsg('Appointment saved.');
                }}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold cursor-pointer"
              >
                Save Appointment
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {state.appointments.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming appointments added yet.</p>
            ) : (
              state.appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {appt.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {appt.date} · {appt.time}
                        {appt.location ? ` · ${appt.location}` : ''}
                        {appt.contactInfo ? ` · ${appt.contactInfo}` : ''}
                      </p>
                      {appt.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {appt.notes}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-1 capitalize">
                        Status: {appt.patientStatus.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteAppointment(appt.id)}
                      className="p-1.5 text-red-600 cursor-pointer"
                      aria-label="Delete appointment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['ready', 'I am ready'],
                        ['need_more_time', 'I need more time'],
                        ['need_help_ready', 'I need help getting ready'],
                        ['contact_caregiver', 'Contact my caregiver'],
                        ['reschedule_requested', 'Reschedule'],
                      ] as const
                    ).map(([statusKey, btnLabel]) => (
                      <GazeButton
                        key={statusKey}
                        gazeId={`appt_${appt.id}_${statusKey}`}
                        variant={appt.patientStatus === statusKey ? 'selected' : 'default'}
                        sizeOverride="standard"
                        onClick={() => {
                          respondToAppointment(appt.id, statusKey);
                          speakPhrase(`${appt.title}: ${btnLabel}`);
                          showMsg(`Appointment response sent: ${btnLabel}`);
                        }}
                      >
                        <span>{btnLabel}</span>
                      </GazeButton>
                    ))}
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
