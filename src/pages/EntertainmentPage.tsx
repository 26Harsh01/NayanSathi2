import React from 'react';
import { EntertainmentDashboard } from '../components/entertainment/EntertainmentDashboard';
import type { AppRoute } from '../components/layout/AppShell';

export const EntertainmentPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Fun &amp; Entertainment
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Discover something interesting every day.
        </p>
      </header>

      <EntertainmentDashboard onNavigate={onNavigate} />
    </div>
  );
};
