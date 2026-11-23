import React, { useMemo, useState } from 'react';
import { Cake, CalendarHeart, Plus, Trash2, Volume2 } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import { speakText } from '../../features/communication/text-to-speech';
import {
  daysUntilMonthDay,
  sortUpcomingBirthdays,
  UPCOMING_FESTIVALS_AND_DAYS,
} from '../../features/entertainment/content-library';
import { GazeButton } from '../gaze/GazeButton';

export const FestivalsSection: React.FC = () => {
  const { settings } = useAppState();
  const { hubPrefs, addBirthdayReminder, removeBirthdayReminder } = useHubPreferences();
  const lang = settings.communication.language;

  const [bdayName, setBdayName] = useState('');
  const [bdayRelation, setBdayRelation] = useState('');
  const [bdayDate, setBdayDate] = useState(''); // MM-DD
  const [bdayMsg, setBdayMsg] = useState<string | null>(null);

  const sortedFestivals = useMemo(() => {
    const now = new Date();
    return [...UPCOMING_FESTIVALS_AND_DAYS]
      .map((item) => ({
        ...item,
        daysAway: daysUntilMonthDay(item.month, item.day, now),
      }))
      .sort((a, b) => a.daysAway - b.daysAway);
  }, []);

  const upcomingBirthdays = useMemo(
    () => sortUpcomingBirthdays(hubPrefs.birthdays),
    [hubPrefs.birthdays]
  );

  const speakGreeting = (text: string) => {
    speakText(text, {
      language: lang,
      rate: settings.communication.speechRate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Personal Birthday Reminders (Patient-Configured) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cake className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Personal Birthday Reminders ({upcomingBirthdays.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-sm">
          <input
            type="text"
            placeholder="Person's name *"
            value={bdayName}
            onChange={(e) => setBdayName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
          <input
            type="text"
            placeholder="Relationship (e.g. Sister)"
            value={bdayRelation}
            onChange={(e) => setBdayRelation(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
          <input
            type="text"
            placeholder="Date MM-DD (e.g. 11-28) *"
            value={bdayDate}
            onChange={(e) => setBdayDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
          <button
            type="button"
            onClick={() => {
              const res = addBirthdayReminder({
                personName: bdayName,
                relationship: bdayRelation,
                monthDay: bdayDate,
              });
              if (!res.ok) {
                setBdayMsg(res.error || 'Could not add birthday.');
                return;
              }
              setBdayName('');
              setBdayRelation('');
              setBdayDate('');
              setBdayMsg('Birthday reminder added.');
            }}
            className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Birthday</span>
          </button>
        </div>

        {bdayMsg && (
          <p className="text-xs font-medium text-teal-700 dark:text-teal-400">{bdayMsg}</p>
        )}

        {upcomingBirthdays.length === 0 ? (
          <p className="text-xs text-slate-500">
            No personal birthday reminders added yet. Add family or friends’ birthdays above or in My Profile.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingBirthdays.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {b.personName} ({b.relationship})
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {b.monthDay} ·{' '}
                    {b.daysAway === 0
                      ? 'Today!'
                      : b.daysAway === 1
                        ? 'Tomorrow'
                        : `In ${b.daysAway} days`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <GazeButton
                    gazeId={`bday_wish_${b.id}`}
                    sizeOverride="standard"
                    variant="primary"
                    onClick={() =>
                      speakGreeting(
                        lang === 'hi'
                          ? `${b.personName} को जन्मदिन की हार्दिक शुभकामनाएँ!`
                          : `Happy Birthday, ${b.personName}! Wishing you happiness and good health.`
                      )
                    }
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Wish</span>
                  </GazeButton>
                  <button
                    type="button"
                    onClick={() => removeBirthdayReminder(b.id)}
                    aria-label={`Remove ${b.personName}`}
                    className="p-2 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Festivals, Holidays & Special Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedFestivals.map((fest) => {
          const title = lang === 'hi' ? fest.nameHi : fest.nameEn;
          const greeting = lang === 'hi' ? fest.greetingHi : fest.greetingEn;
          return (
            <div
              key={fest.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold uppercase text-teal-700 dark:text-teal-400">
                    <CalendarHeart className="w-4 h-4" />
                    <span>{fest.kind.replace('_', ' ')}</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {fest.dateStr} ·{' '}
                    {fest.daysAway === 0 ? 'Today' : `In ${fest.daysAway} days`}
                  </span>
                </div>

                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {fest.description}
                </p>
              </div>

              <GazeButton
                gazeId={`fest_greet_${fest.id}`}
                variant="subtle"
                sizeOverride="standard"
                onClick={() => speakGreeting(greeting)}
                className="justify-start text-left"
              >
                <Volume2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                <span>Speak Greeting: &ldquo;{greeting}&rdquo;</span>
              </GazeButton>
            </div>
          );
        })}
      </div>
    </div>
  );
};
