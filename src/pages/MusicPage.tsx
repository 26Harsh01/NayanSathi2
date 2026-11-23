import React from 'react';
import type { AppRoute } from '../components/layout/AppShell';
import { MusicDashboard } from '../components/music/MusicDashboard';

export const MusicPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          My Music
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Listen to the music you love.
        </p>
      </header>

      <MusicDashboard onNavigate={onNavigate} />
    </div>
  );
};
