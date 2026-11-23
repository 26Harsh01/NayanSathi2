import React, { useEffect, useState } from 'react';
import { AppStateProvider } from './context/AppStateContext';
import { EmergencyContactProvider } from './context/EmergencyContactContext';
import { LifeHubProvider } from './context/LifeHubContext';
import { EyeTrackingProvider } from './hooks/useEyeTracking';
import { AppShell, type AppRoute } from './components/layout/AppShell';
import { GazeCursor } from './components/gaze/GazeCursor';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CommunicatePage } from './pages/CommunicatePage';
import { CalibrationPage } from './pages/CalibrationPage';
import { LifeHubPage } from './pages/LifeHubPage';
import { CaregiverDashboardPage } from './pages/CaregiverDashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { MyProfilePage } from './pages/MyProfilePage';

function routeFromPath(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/onboarding') return 'onboarding';
  if (clean === '/communicate') return 'communicate';
  if (clean === '/calibration') return 'calibration';
  if (clean === '/life-hub' || clean === '/dashboard') return 'life-hub';
  if (clean === '/caregiver') return 'caregiver';
  if (clean === '/settings') return 'settings';
  if (clean === '/profile') return 'profile';
  return 'landing';
}

function pathForRoute(route: AppRoute): string {
  return route === 'landing' ? '/' : `/${route}`;
}

function AppRouter() {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? routeFromPath(window.location.pathname) : 'landing'
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(routeFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    const targetPath = pathForRoute(nextRoute);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <>
      <GazeCursor />
      {route === 'landing' ? (
        <LandingPage onNavigate={navigate} />
      ) : (
        <AppShell
          currentRoute={route}
          onNavigate={navigate}
          minimalHeader={route === 'onboarding'}
        >
          {route === 'onboarding' && <OnboardingPage onNavigate={navigate} />}
          {route === 'communicate' && <CommunicatePage onNavigate={navigate} />}
          {route === 'life-hub' && <LifeHubPage onNavigate={navigate} />}
          {route === 'calibration' && <CalibrationPage onNavigate={navigate} />}
          {route === 'caregiver' && <CaregiverDashboardPage onNavigate={navigate} />}
          {route === 'settings' && <SettingsPage onNavigate={navigate} />}
          {route === 'profile' && <MyProfilePage onNavigate={navigate} />}
        </AppShell>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <EmergencyContactProvider>
        <LifeHubProvider>
          <EyeTrackingProvider>
            <AppRouter />
          </EyeTrackingProvider>
        </LifeHubProvider>
      </EmergencyContactProvider>
    </AppStateProvider>
  );
}
