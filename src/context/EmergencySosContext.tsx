import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppState } from './AppStateContext';
import { useEmergencyContacts } from './EmergencyContactContext';
import { useLifeHub } from './LifeHubContext';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import type {
  EmergencyAlert,
  EmergencyProviderStatus,
  EmergencySettings,
} from '../types';
import {
  acknowledgeEmergencyAlertApi,
  createDefaultClientEmergencySettings,
  fetchEmergencyStatus,
  markEmergencyInProgressApi,
  readLocalEmergencySettings,
  readOfflineEmergencyAlerts,
  resolveEmergencyAlertApi,
  retryEmergencyAlertApi,
  saveEmergencySettingsOnServer,
  subscribeToEmergencyStream,
  syncContactsToServer,
  triggerEmergencySosApi,
  writeLocalEmergencySettings,
  writeOfflineEmergencyAlerts,
  type TriggerSosPayload,
  type TriggerSosResult,
} from '../features/emergency/emergency-api';
import {
  captureEmergencyLocationOnce,
  queryGeolocationPermission,
  requestLocationPermissionPrecheck,
  type GeolocationPermissionState,
} from '../features/emergency/location-service';

interface EmergencySosContextValue {
  activeAlert: EmergencyAlert | null;
  alerts: EmergencyAlert[];
  lastTestAlert: EmergencyAlert | null;
  sosSettings: EmergencySettings;
  providers: EmergencyProviderStatus;
  locationPermission: GeolocationPermissionState;
  isOnline: boolean;
  isTriggering: boolean;
  triggerError: string | null;
  skippedContactsNotice: Array<{ contactId: string; name: string; reason: string }>;
  refreshSosState: () => Promise<void>;
  updateSosSettings: (patch: Partial<EmergencySettings>) => Promise<void>;
  requestLocationPermission: () => Promise<{ ok: boolean; message: string }>;
  triggerSos: (options?: {
    customMessage?: string;
    alertType?: 'sos' | 'test';
    targetContactId?: string;
    simulateTest?: boolean;
  }) => Promise<TriggerSosResult>;
  acknowledgeAlert: (alertId: string, caregiverName: string) => Promise<boolean>;
  markInProgress: (alertId: string, caregiverName: string) => Promise<boolean>;
  resolveAlert: (alertId: string, resolvedBy: string) => Promise<boolean>;
  retryAlert: (alertId: string) => Promise<boolean>;
  clearTriggerFeedback: () => void;
}

const DEFAULT_PROVIDERS: EmergencyProviderStatus = {
  whatsappConfigured: false,
  whatsappTemplateName: 'nayansathi_emergency_alert',
  smsConfigured: false,
  smsProvider: 'twilio',
  supabaseConfigured: isSupabaseConfigured,
  webhookVerifyConfigured: false,
};

const EmergencySosContext = createContext<EmergencySosContextValue | null>(null);

export const EmergencySosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activePatientId, profile, settings } = useAppState();
  const { contacts } = useEmergencyContacts();
  const { photosMap } = useLifeHub();

  const [alerts, setAlerts] = useState<EmergencyAlert[]>(() =>
    readOfflineEmergencyAlerts(activePatientId)
  );
  const [sosSettings, setSosSettings] = useState<EmergencySettings>(() =>
    readLocalEmergencySettings(activePatientId)
  );
  const [providers, setProviders] = useState<EmergencyProviderStatus>(DEFAULT_PROVIDERS);
  const [locationPermission, setLocationPermission] =
    useState<GeolocationPermissionState>('prompt');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [skippedContactsNotice, setSkippedContactsNotice] = useState<
    Array<{ contactId: string; name: string; reason: string }>
  >([]);

  const triggeringLockRef = useRef(false);

  const upsertAlertInList = useCallback(
    (incoming: EmergencyAlert) => {
      setAlerts((prev) => {
        const idx = prev.findIndex((a) => a.id === incoming.id);
        const next =
          idx >= 0
            ? prev.map((a) => (a.id === incoming.id ? incoming : a))
            : [incoming, ...prev].slice(0, 30);
        writeOfflineEmergencyAlerts(activePatientId, next);
        return next;
      });
    },
    [activePatientId]
  );

  const refreshSosState = useCallback(async () => {
    const status = await fetchEmergencyStatus(activePatientId);
    if (!status) return;
    setProviders(status.providers);
    setSosSettings((prev) => {
      const merged = { ...prev, ...status.settings };
      writeLocalEmergencySettings(activePatientId, merged);
      return merged;
    });
    setAlerts((prev) => {
      // Keep any unsynced offline alerts alongside server alerts
      const offlinePending = prev.filter(
        (a) => a.isOfflineQueued && a.currentStatus !== 'resolved'
      );
      const serverIds = new Set(status.alerts.map((a) => a.id));
      const merged = [
        ...status.alerts,
        ...offlinePending.filter((o) => !serverIds.has(o.id)),
      ];
      writeOfflineEmergencyAlerts(activePatientId, merged);
      return merged;
    });
  }, [activePatientId]);

  // Reload on activePatientId switch + sync contacts to server
  useEffect(() => {
    setAlerts(readOfflineEmergencyAlerts(activePatientId));
    setSosSettings(readLocalEmergencySettings(activePatientId));
    setTriggerError(null);
    setSkippedContactsNotice([]);

    void syncContactsToServer(activePatientId, contacts).then(() => refreshSosState());
    void queryGeolocationPermission().then(setLocationPermission);
  }, [activePatientId, contacts, refreshSosState]);

  // Real-time Server-Sent Events subscription
  useEffect(() => {
    const unsubscribeSse = subscribeToEmergencyStream(activePatientId, {
      onInit: (data) => {
        setAlerts((prev) => {
          const offlinePending = prev.filter(
            (a) => a.isOfflineQueued && a.currentStatus !== 'resolved'
          );
          const merged = [...data.alerts, ...offlinePending];
          writeOfflineEmergencyAlerts(activePatientId, merged);
          return merged;
        });
      },
      onAlert: (alert) => {
        upsertAlertInList(alert);
      },
      onSettings: (nextSettings) => {
        setSosSettings(nextSettings);
        writeLocalEmergencySettings(activePatientId, nextSettings);
      },
    });

    return () => {
      unsubscribeSse();
    };
  }, [activePatientId, upsertAlertInList]);

  // Optional Supabase Realtime subscription when configured
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel(`emergency_${activePatientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_alerts',
          filter: `patient_id=eq.${activePatientId}`,
        },
        () => {
          void refreshSosState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_notification_logs',
          filter: `patient_id=eq.${activePatientId}`,
        },
        () => {
          void refreshSosState();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [activePatientId, refreshSosState]);

  // Connectivity tracking + safe retry of unresolved offline-queued alerts ONLY when connectivity returns
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = async () => {
      setIsOnline(true);
      await syncContactsToServer(activePatientId, contacts);
      const currentAlerts = readOfflineEmergencyAlerts(activePatientId);
      const pendingOffline = currentAlerts.find(
        (a) =>
          a.isOfflineQueued &&
          a.alertType === 'sos' &&
          a.currentStatus !== 'resolved'
      );
      if (pendingOffline) {
        const res = await triggerEmergencySosApi({
          patientId: activePatientId,
          patientName: pendingOffline.patientName,
          patientPhotoUrl: pendingOffline.patientPhotoUrl,
          alertType: 'sos',
          language: settings.communication.language,
          messageText: pendingOffline.messageText,
          latitude: pendingOffline.latitude,
          longitude: pendingOffline.longitude,
          locationShared: pendingOffline.locationShared,
          locationStatus: pendingOffline.locationStatus,
          idempotencyKey: pendingOffline.idempotencyKey,
          contacts,
        });
        if (res.alert) {
          setAlerts((prev) => {
            const withoutOld = prev.filter((a) => a.id !== pendingOffline.id);
            const next = [res.alert!, ...withoutOld];
            writeOfflineEmergencyAlerts(activePatientId, next);
            return next;
          });
        }
      }
      await refreshSosState();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [activePatientId, contacts, refreshSosState, settings.communication.language]);

  const activeAlert = useMemo(
    () =>
      alerts.find((a) => a.alertType === 'sos' && a.currentStatus !== 'resolved') ?? null,
    [alerts]
  );

  const lastTestAlert = useMemo(
    () => alerts.find((a) => a.alertType === 'test') ?? null,
    [alerts]
  );

  const updateSosSettings = useCallback(
    async (patch: Partial<EmergencySettings>) => {
      const nextLocal: EmergencySettings = {
        ...createDefaultClientEmergencySettings(activePatientId),
        ...sosSettings,
        ...patch,
        patientId: activePatientId,
        updatedAt: new Date().toISOString(),
      };
      setSosSettings(nextLocal);
      writeLocalEmergencySettings(activePatientId, nextLocal);

      const saved = await saveEmergencySettingsOnServer(activePatientId, patch);
      if (saved) {
        setSosSettings(saved);
        writeLocalEmergencySettings(activePatientId, saved);
      }
    },
    [activePatientId, sosSettings]
  );

  const requestLocationPermission = useCallback(async () => {
    const res = await requestLocationPermissionPrecheck();
    setLocationPermission(res.state);
    if (res.ok) {
      await updateSosSettings({ locationSharingEnabled: true });
    }
    return { ok: res.ok, message: res.message };
  }, [updateSosSettings]);

  const triggerSos = useCallback(
    async (options?: {
      customMessage?: string;
      alertType?: 'sos' | 'test';
      targetContactId?: string;
      simulateTest?: boolean;
    }): Promise<TriggerSosResult> => {
      const alertType = options?.alertType ?? 'sos';

      if (triggeringLockRef.current) {
        return { ok: false, error: 'Emergency alert dispatch is already in progress.' };
      }

      if (alertType === 'sos' && activeAlert) {
        return {
          ok: true,
          duplicatePrevented: true,
          alert: activeAlert,
        };
      }

      triggeringLockRef.current = true;
      setIsTriggering(true);
      setTriggerError(null);
      setSkippedContactsNotice([]);

      try {
        // Sync latest contacts first so server always sees latest consent/verification edits
        await syncContactsToServer(activePatientId, contacts);

        const loc = await captureEmergencyLocationOnce(sosSettings.locationSharingEnabled);
        if (loc.locationStatus === 'denied') {
          setLocationPermission('denied');
        } else if (loc.locationStatus === 'shared') {
          setLocationPermission('granted');
        }

        const photoUrl = profile.photoAssetId ? photosMap[profile.photoAssetId] : undefined;
        const payload: TriggerSosPayload = {
          patientId: activePatientId,
          patientName: profile.preferredName || profile.name || 'Patient',
          patientPhotoUrl: photoUrl && photoUrl.startsWith('data:image/') ? photoUrl : undefined,
          alertType,
          language: settings.communication.language,
          messageText: options?.customMessage,
          latitude: loc.latitude,
          longitude: loc.longitude,
          locationShared: loc.locationShared,
          locationStatus: loc.locationStatus,
          idempotencyKey: `sos_${activePatientId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          contacts,
          targetContactId: options?.targetContactId,
          simulateTest: options?.simulateTest,
        };

        const result = await triggerEmergencySosApi(payload);
        if (result.alert) {
          upsertAlertInList(result.alert);
        }
        if (result.skippedContacts) {
          setSkippedContactsNotice(result.skippedContacts);
        }
        if (result.warning) {
          setTriggerError(result.warning);
        } else if (!result.ok && result.error) {
          setTriggerError(result.error);
        }

        return result;
      } finally {
        triggeringLockRef.current = false;
        setIsTriggering(false);
      }
    },
    [
      activeAlert,
      activePatientId,
      contacts,
      photosMap,
      profile.name,
      profile.photoAssetId,
      profile.preferredName,
      settings.communication.language,
      sosSettings.locationSharingEnabled,
      upsertAlertInList,
    ]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string, caregiverName: string): Promise<boolean> => {
      const updated = await acknowledgeEmergencyAlertApi(activePatientId, alertId, caregiverName);
      if (updated) {
        upsertAlertInList(updated);
        return true;
      }
      return false;
    },
    [activePatientId, upsertAlertInList]
  );

  const markInProgress = useCallback(
    async (alertId: string, caregiverName: string): Promise<boolean> => {
      const updated = await markEmergencyInProgressApi(activePatientId, alertId, caregiverName);
      if (updated) {
        upsertAlertInList(updated);
        return true;
      }
      return false;
    },
    [activePatientId, upsertAlertInList]
  );

  const resolveAlert = useCallback(
    async (alertId: string, resolvedBy: string): Promise<boolean> => {
      const target = alerts.find((a) => a.id === alertId);
      if (target?.isOfflineQueued) {
        upsertAlertInList({
          ...target,
          currentStatus: 'resolved',
          resolvedBy,
          resolvedAt: new Date().toISOString(),
        });
        return true;
      }
      const updated = await resolveEmergencyAlertApi(activePatientId, alertId, resolvedBy);
      if (updated) {
        upsertAlertInList(updated);
        return true;
      }
      return false;
    },
    [activePatientId, alerts, upsertAlertInList]
  );

  const retryAlert = useCallback(
    async (alertId: string): Promise<boolean> => {
      const updated = await retryEmergencyAlertApi(activePatientId, alertId);
      if (updated) {
        upsertAlertInList(updated);
        return true;
      }
      return false;
    },
    [activePatientId, upsertAlertInList]
  );

  const clearTriggerFeedback = useCallback(() => {
    setTriggerError(null);
    setSkippedContactsNotice([]);
  }, []);

  return (
    <EmergencySosContext.Provider
      value={{
        activeAlert,
        alerts,
        lastTestAlert,
        sosSettings,
        providers,
        locationPermission,
        isOnline,
        isTriggering,
        triggerError,
        skippedContactsNotice,
        refreshSosState,
        updateSosSettings,
        requestLocationPermission,
        triggerSos,
        acknowledgeAlert,
        markInProgress,
        resolveAlert,
        retryAlert,
        clearTriggerFeedback,
      }}
    >
      {children}
    </EmergencySosContext.Provider>
  );
};

export function useEmergencySos(): EmergencySosContextValue {
  const ctx = useContext(EmergencySosContext);
  if (!ctx) {
    throw new Error('useEmergencySos must be used within EmergencySosProvider');
  }
  return ctx;
}
