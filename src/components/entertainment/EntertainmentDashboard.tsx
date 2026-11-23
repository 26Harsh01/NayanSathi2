import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarHeart,
  Film,
  HelpCircle,
  Laugh,
  Lightbulb,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useHubPreferences } from '../../context/HubPreferencesContext';
import type { EntertainmentSectionId } from '../../types';
import type { AppRoute } from '../layout/AppShell';
import { GazeButton } from '../gaze/GazeButton';
import { FactsSection } from './FactsSection';
import { FestivalsSection } from './FestivalsSection';
import { JokesSection } from './JokesSection';
import { MoviesSection } from './MoviesSection';
import { QuizSection } from './QuizSection';
import { SportsUpdates } from './SportsUpdates';
import { StoriesSection } from './StoriesSection';

const SECTION_TABS: {
  id: EntertainmentSectionId;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'facts', label: 'Daily Facts', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'jokes', label: 'Daily Jokes', icon: <Laugh className="w-4 h-4" /> },
  { id: 'stories', label: 'Short Stories', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'quiz', label: 'Riddles & Quizzes', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'movies', label: 'Movies & Cinema', icon: <Film className="w-4 h-4" /> },
  { id: 'sports', label: 'Sports Updates', icon: <Trophy className="w-4 h-4" /> },
  { id: 'festivals', label: 'Festivals & Birthdays', icon: <CalendarHeart className="w-4 h-4" /> },
];

export const EntertainmentDashboard: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const { hubPrefs } = useHubPreferences();

  const visibleTabs = useMemo(() => {
    const enabled = SECTION_TABS.filter(
      (t) => !hubPrefs.disabledEntertainmentSections.includes(t.id)
    );
    return [...enabled].sort((a, b) => {
      const aFav = hubPrefs.favoriteEntertainmentSections.includes(a.id) ? 0 : 1;
      const bFav = hubPrefs.favoriteEntertainmentSections.includes(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [hubPrefs.disabledEntertainmentSections, hubPrefs.favoriteEntertainmentSections]);

  const [activeTab, setActiveTab] = useState<EntertainmentSectionId>(
    () => visibleTabs[0]?.id || 'facts'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <GazeButton
              key={tab.id}
              gazeId={`ent_tab_${tab.id}`}
              variant={activeTab === tab.id ? 'selected' : 'default'}
              sizeOverride="standard"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </GazeButton>
          ))}
        </div>

        <GazeButton
          gazeId="ent_profile_prefs"
          variant="subtle"
          sizeOverride="standard"
          onClick={() => onNavigate('profile')}
        >
          <Sparkles className="w-4 h-4" />
          <span>Personalize</span>
        </GazeButton>
      </div>

      {visibleTabs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
          <p className="text-sm font-semibold">
            All entertainment categories are hidden in your profile preferences.
          </p>
          <GazeButton
            gazeId="ent_restore_profile"
            variant="primary"
            onClick={() => onNavigate('profile')}
          >
            <span>Enable Sections in My Profile</span>
          </GazeButton>
        </div>
      ) : (
        <div>
          {activeTab === 'facts' && <FactsSection />}
          {activeTab === 'jokes' && <JokesSection />}
          {activeTab === 'stories' && <StoriesSection />}
          {activeTab === 'quiz' && <QuizSection />}
          {activeTab === 'movies' && <MoviesSection />}
          {activeTab === 'sports' && <SportsUpdates />}
          {activeTab === 'festivals' && <FestivalsSection />}
        </div>
      )}
    </div>
  );
};
