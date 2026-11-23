import React, { useEffect, useState } from 'react';
import { AppStateProvider } from './context/AppStateContext';
import { EmergencyContactProvider } from './context/EmergencyContactContext';
import { EmergencySosProvider } from './context/EmergencySosContext';
import { GamesProvider } from './context/GamesContext';
import { HubPreferencesProvider } from './context/HubPreferencesContext';
import { LifeHubProvider } from './context/LifeHubContext';
import { MusicProvider } from './context/MusicContext';
import { EyeTrackingProvider } from './hooks/useEyeTracking';
import { AppShell, type AppRoute } from './components/layout/AppShell';
import { GazeCursor } from './components/gaze/GazeCursor';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CommunicatePage } from './pages/CommunicatePage';
import { CalibrationPage } from './pages/CalibrationPage';
import { LifeHubPage } from './pages/LifeHubPage';
import { GamesPage } from './pages/GamesPage';
import { MusicPage } from './pages/MusicPage';
import { NewsPage } from './pages/NewsPage';
import { EntertainmentPage } from './pages/EntertainmentPage';
import { CaregiverDashboardPage } from './pages/CaregiverDashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { MyProfilePage } from './pages/MyProfilePage';

function routeFromPath(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/onboarding') return 'onboarding';
  if (clean === '/communicate') return 'communicate';
  if (clean === '/life-hub' || clean === '/dashboard') return 'life-hub';
  if (clean === '/games') return 'games';
  if (clean === '/music') return 'music';
  if (clean === '/news') return 'news';
  if (clean === '/entertainment') return 'entertainment';
  if (clean === '/calibration') return 'calibration';
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
          {route === 'games' && <GamesPage onNavigate={navigate} />}
          {route === 'music' && <MusicPage onNavigate={navigate} />}
          {route === 'news' && <NewsPage onNavigate={navigate} />}
          {route === 'entertainment' && <EntertainmentPage onNavigate={navigate} />}
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
          <GamesProvider>
            <MusicProvider>
              <HubPreferencesProvider>
                <EmergencySosProvider>
                  <EyeTrackingProvider>
                    <AppRouter />
                  </EyeTrackingProvider>
                </EmergencySosProvider>
              </HubPreferencesProvider>
            </MusicProvider>
          </GamesProvider>
        </LifeHubProvider>
      </EmergencyContactProvider>
    </AppStateProvider>
  );
}
