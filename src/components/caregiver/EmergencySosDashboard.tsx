import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FlaskConical,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Settings,
  ShieldAlert,
  User,
  UserCheck,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useEmergencyContacts } from '../../context/EmergencyContactContext';
import { useEmergencySos } from '../../context/EmergencySosContext';
import { useLifeHub } from '../../context/LifeHubContext';
import {
  buildSmsHandoffUri,
  buildTelUri,
  buildWhatsAppHandoffUrl,
} from '../../features/contacts/contact-utils';
import { createDefaultClientEmergencySettings } from '../../features/emergency/emergency-api';
import type {
  EmergencyAlert,
  EmergencyConfirmationMode,
  EmergencyNotificationPriority,
} from '../../types';

export const EmergencySosDashboard: React.FC = () => {
  const { activePatientId, profile } = useAppState();
  const { contacts } = useEmergencyContacts();
  const { photosMap, activeActor, state: lifeHub } = useLifeHub();
  const {
    activeAlert,
    alerts,
    sosSettings,
    providers,
    locationPermission,
    isTriggering,
    triggerError,
    updateSosSettings,
    requestLocationPermission,
    triggerSos,
    acknowledgeAlert,
    markInProgress,
    resolveAlert,
    retryAlert,
  } = useEmergencySos();

  const [showConfig, setShowConfig] = useState(false);
  const [showOtherContacts, setShowOtherContacts] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const actorName = useMemo(() => {
    if (activeActor.type === 'caregiver' && activeActor.caregiverId) {
      const cg = lifeHub.caregivers.find((c) => c.id === activeActor.caregiverId);
      if (cg) return `${cg.name} (${cg.role})`;
    }
    return profile.caregiverName || 'Authorized Caregiver';
  }, [activeActor, lifeHub.caregivers, profile.caregiverName]);

  const patientName = profile.preferredName || profile.name || 'Patient';
  const patientPhoto =
    activeAlert?.patientPhotoUrl ||
    (profile.photoAssetId ? photosMap[profile.photoAssetId] : undefined);

  const displayAlerts = useMemo(() => {
    if (!activeAlert) return alerts.slice(0, 8);
    return [activeAlert, ...alerts.filter((a) => a.id !== activeAlert.id)].slice(0, 8);
  }, [activeAlert, alerts]);

  const handleAcknowledge = async (alert: EmergencyAlert) => {
    const ok = await acknowledgeAlert(alert.id, actorName);
    setActionNotice(
      ok ? `Alert ${alert.id.slice(0, 8)} acknowledged by ${actorName}.` : 'Could not acknowledge alert.'
    );
  };

  const handleInProgress = async (alert: EmergencyAlert) => {
    const ok = await markInProgress(alert.id, actorName);
    setActionNotice(
      ok ? `Alert ${alert.id.slice(0, 8)} marked Assistance In Progress.` : 'Failed to update status.'
    );
  };

  const handleResolve = async (alert: EmergencyAlert) => {
    const ok = await resolveAlert(alert.id, actorName);
    setActionNotice(
      ok ? `Alert ${alert.id.slice(0, 8)} resolved.` : 'Failed to resolve alert.'
    );
  };

  const handleRetry = async (alert: EmergencyAlert) => {
    const ok = await retryAlert(alert.id);
    setActionNotice(
      ok ? `Re-dispatched notifications for alert ${alert.id.slice(0, 8)}.` : 'Retry failed.'
    );
  };

  const handleSendTestAlert = async () => {
    setActionNotice(null);
    const res = await triggerSos({
      alertType: 'test',
      simulateTest: sosSettings.testSimulationMode,
      customMessage: sosSettings.customMessageEn,
    });
    if (res.alert) {
      setActionNotice(
        sosSettings.testSimulationMode
          ? `Test Simulation completed (Alert ${res.alert.id.slice(0, 8)}). Marked as Simulated — no real WhatsApp/SMS sent.`
          : `Test Alert ${res.alert.id.slice(0, 8)} submitted (${res.alert.currentStatus}).`
      );
    } else if (res.error) {
      setActionNotice(res.error);
    }
  };

  const handleRequestLocation = async () => {
    const res = await requestLocationPermission();
    setLocationNotice(res.message);
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setActionNotice(`Copied ${label} (${value}).`);
    } catch {
      setActionNotice(`${label}: ${value}`);
    }
  };

  const defaults = createDefaultClientEmergencySettings(activePatientId);

  return (
    <section
      aria-label="Emergency SOS Alerts & Notification Configuration"
      className={`rounded-2xl border-2 p-6 space-y-5 ${
        activeAlert
          ? 'border-red-600 bg-red-50/40 dark:bg-red-950/20'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              activeAlert
                ? 'bg-red-700 text-white'
                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Emergency SOS Alerts & Dispatch Center</span>
              {activeAlert && (
                <span className="px-2 py-0.5 rounded bg-red-700 text-white text-xs font-bold uppercase">
                  ACTIVE SOS
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Real-time SOS monitoring, delivery logs, caregiver acknowledgment, escalation policy, and test-alert diagnostics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isTriggering}
            onClick={handleSendTestAlert}
            className="px-3.5 py-2 rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className="w-4 h-4" />
            <span>
              {isTriggering
                ? 'Running Test...'
                : sosSettings.testSimulationMode
                  ? 'Send Test Alert (Simulation)'
                  : 'Send Test Alert (Live Test Mode)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfig((p) => !p)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>{showConfig ? 'Hide SOS Settings' : 'SOS Rules, Templates & Escalation'}</span>
          </button>
        </div>
      </div>

      {(actionNotice || triggerError) && (
        <div
          role="status"
          className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-800 text-xs font-medium text-teal-900 dark:text-teal-200"
        >
          {actionNotice || triggerError}
        </div>
      )}

      {/* Provider Readiness Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <span className="text-slate-500 block">WhatsApp Cloud API</span>
          <span
            className={`font-bold ${
              providers.whatsappConfigured
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {providers.whatsappConfigured
              ? `Configured (${providers.whatsappTemplateName})`
              : 'Not configured (.env)'}
          </span>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <span className="text-slate-500 block">SMS Fallback ({providers.smsProvider})</span>
          <span
            className={`font-bold ${
              providers.smsConfigured
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {providers.smsConfigured ? 'Configured' : 'Not configured (.env)'}
          </span>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <span className="text-slate-500 block">Escalation Worker</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {sosSettings.escalationEnabled
              ? `Every ${sosSettings.escalationIntervalSec}s to secondary`
              : 'Disabled'}
          </span>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <span className="text-slate-500 block">Location Permission</span>
          <span className="font-bold text-slate-900 dark:text-white capitalize">
            {sosSettings.locationSharingEnabled ? `${locationPermission} (SOS-only)` : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Active & Recent Emergency Alerts */}
      {displayAlerts.length === 0 ? (
        <div className="p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-3">
          <span>
            No Emergency SOS or Test alerts triggered yet for {patientName}. Use “Send Test Alert” above after marking at least one contact Active, Consented, and Verified.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {displayAlerts.map((alert) => {
            const safeMapLink =
              alert.mapLink && alert.mapLink.startsWith('https://maps.google.com/?q=')
                ? alert.mapLink
                : null;
            const isActiveSos = alert.currentStatus !== 'resolved';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  alert.alertType === 'sos' && isActiveSos
                    ? 'border-red-600 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {patientPhoto ? (
                      <img
                        src={patientPhoto}
                        alt={alert.patientName}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-teal-700 text-white flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {alert.patientName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            alert.alertType === 'test'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-red-700 text-white'
                          }`}
                        >
                          {alert.alertType === 'test' ? 'TEST ALERT' : 'EMERGENCY SOS'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold">
                          {alert.currentStatus.replace(/_/g, ' ')}
                        </span>
                        {alert.isOfflineQueued && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-semibold">
                            Offline Local Queue
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-500 tabular-nums mt-0.5">
                        ID: {alert.id.slice(0, 12)} · {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Location Pill */}
                  <div className="text-xs">
                    {alert.locationShared && safeMapLink ? (
                      <a
                        href={safeMapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 font-semibold"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Location unavailable</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  {alert.messageText}
                </p>

                {alert.acknowledgedBy && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>
                      Acknowledged by {alert.acknowledgedBy}
                      {alert.acknowledgedAt
                        ? ` at ${new Date(alert.acknowledgedAt).toLocaleTimeString()}`
                        : ''}
                    </span>
                  </p>
                )}

                {/* Per-Recipient Delivery Log Summary */}
                {alert.notificationLogs.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 block">
                      Per-Recipient Notification Attempts ({alert.notificationLogs.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {alert.notificationLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold">
                            <span>
                              {log.recipientName} · {log.channel.toUpperCase()} ({log.destination})
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : log.deliveryStatus === 'failed'
                                    ? 'bg-red-100 text-red-900'
                                    : log.deliveryStatus === 'simulated'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-teal-100 text-teal-900'
                              }`}
                            >
                              {log.deliveryStatus}
                            </span>
                          </div>
                          <p className="text-slate-500">
                            {log.provider}
                            {log.providerMessageId ? ` · MsgID: ${log.providerMessageId}` : ''}
                            {` · Attempt #${log.attemptNumber}`}
                          </p>
                          {log.failureReason && (
                            <p className="text-red-700 dark:text-red-400">{log.failureReason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caregiver Response Actions */}
                {isActiveSos && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {!alert.acknowledgedAt && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(alert)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledge Alert</span>
                      </button>
                    )}

                    {alert.currentStatus !== 'assistance_in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleInProgress(alert)}
                        className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Mark Assistance In Progress</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleResolve(alert)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Resolved
                    </button>

                    {!alert.isOfflineQueued &&
                      (alert.currentStatus === 'failed' ||
                        alert.notificationLogs.some((l) => l.deliveryStatus === 'failed')) && (
                        <button
                          type="button"
                          onClick={() => handleRetry(alert)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Dispatch</span>
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setShowOtherContacts((p) => !p)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Patient / Contact Another Caregiver</span>
                    </button>
                  </div>
                )}

                {isActiveSos && showOtherContacts && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 block">
                      Direct Contact & Handoff Directory ({contacts.length} registered)
                    </span>
                    {contacts.length === 0 ? (
                      <p className="text-slate-500">
                        Add emergency contacts in the Emergency Contact Configuration section below.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {contacts.map((c) => {
                          const tel = buildTelUri(c.phone);
                          const sms = buildSmsHandoffUri(
                            c.phone,
                            `SOS Follow-up for ${alert.patientName}: ${alert.messageText}`
                          );
                          const wa = buildWhatsAppHandoffUrl(
                            c.whatsappNumber || c.phone,
                            `SOS Follow-up for ${alert.patientName}: ${alert.messageText}`
                          );
                          return (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                                <p className="font-mono text-slate-500">{c.phone}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tel && (
                                  <a
                                    href={tel}
                                    className="px-2 py-1 rounded bg-red-700 text-white font-semibold inline-flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>Call</span>
                                  </a>
                                )}
                                {sms && (
                                  <a
                                    href={sms}
                                    className="px-2 py-1 rounded bg-slate-800 text-white font-semibold inline-flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>SMS</span>
                                  </a>
                                )}
                                {wa && (
                                  <a
                                    href={wa}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded bg-emerald-700 text-white font-semibold"
                                  >
                                    WA
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCopy(c.phone, c.name)}
                                  className="p-1 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                                  title="Copy number"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsible SOS Configuration, Escalation & Message Customization */}
      {showConfig && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Emergency Activation Mode
              </span>
              <select
                value={sosSettings.confirmationMode}
                onChange={(e) =>
                  void updateSosSettings({
                    confirmationMode: e.target.value as EmergencyConfirmationMode,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="two_step">Two-Step Confirmation + CANCEL (Recommended for Gaze)</option>
                <option value="single_step">Single-Step Immediate SOS Trigger</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Channel Priority & Fallback
              </span>
              <select
                value={sosSettings.notificationPriority}
                onChange={(e) =>
                  void updateSosSettings({
                    notificationPriority: e.target.value as EmergencyNotificationPriority,
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                <option value="whatsapp_first">WhatsApp First → SMS Fallback</option>
                <option value="sms_first">SMS First → WhatsApp Fallback</option>
                <option value="parallel">Parallel (Send WhatsApp & SMS together)</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Escalation Delay (seconds)
              </span>
              <input
                type="number"
                min={30}
                max={900}
                step={15}
                value={sosSettings.escalationIntervalSec}
                onChange={(e) =>
                  void updateSosSettings({
                    escalationIntervalSec: Math.min(900, Math.max(30, Number(e.target.value) || 120)),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sosSettings.whatsappEnabled}
                onChange={(e) => void updateSosSettings({ whatsappEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600"
              />
              <span>Enable WhatsApp Business API</span>
            </label>

            <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sosSettings.smsEnabled}
                onChange={(e) => void updateSosSettings({ smsEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600"
              />
              <span>Enable SMS Fallback Provider</span>
            </label>

            <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sosSettings.escalationEnabled}
                onChange={(e) => void updateSosSettings({ escalationEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-600"
              />
              <span>Auto-Escalate to Secondary Contacts if Unacknowledged</span>
            </label>

            <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sosSettings.testSimulationMode}
                onChange={(e) => void updateSosSettings({ testSimulationMode: e.target.checked })}
                className="w-4 h-4 accent-amber-600"
              />
              <span>Test Simulation Mode (Never sends real messages during Test Alerts)</span>
            </label>
          </div>

          {/* Location Sharing Pre-Check */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-1 max-w-2xl">
              <label className="inline-flex items-center gap-2 font-bold text-slate-900 dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={sosSettings.locationSharingEnabled}
                  onChange={(e) =>
                    void updateSosSettings({ locationSharingEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-teal-600"
                />
                <span>Include one-shot GPS location coordinates in Emergency SOS alerts</span>
              </label>
              <p className="text-slate-600 dark:text-slate-400">
                Privacy guarantee: NayanSathi never runs continuous background location tracking. Coordinates are requested once only when SOS is triggered; if unavailable or denied, alerts send immediately with “Location unavailable”.
              </p>
              {locationNotice && (
                <p className="font-semibold text-teal-700 dark:text-teal-400">{locationNotice}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Check / Request Location Permission</span>
            </button>
          </div>

          {/* Bilingual Message Customization + Optional Indian DLT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Emergency Message Template (English)
              </span>
              <textarea
                rows={2}
                value={sosSettings.customMessageEn}
                onChange={(e) => {
                  setSavingSettings(true);
                  void updateSosSettings({ customMessageEn: e.target.value }).finally(() =>
                    setSavingSettings(false)
                  );
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Emergency Message Template (Hindi / हिंदी)
              </span>
              <textarea
                rows={2}
                value={sosSettings.customMessageHi}
                onChange={(e) => {
                  setSavingSettings(true);
                  void updateSosSettings({ customMessageHi: e.target.value }).finally(() =>
                    setSavingSettings(false)
                  );
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Indian DLT Template ID (Optional, overrides server env)
              </span>
              <input
                type="text"
                placeholder="e.g. 1107168000000000001"
                value={sosSettings.smsDltTemplateId || ''}
                onChange={(e) =>
                  void updateSosSettings({ smsDltTemplateId: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Indian DLT Entity / PE ID (Optional)
              </span>
              <input
                type="text"
                placeholder="e.g. 1101500000000000001"
                value={sosSettings.smsDltEntityId || ''}
                onChange={(e) =>
                  void updateSosSettings({ smsDltEntityId: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {savingSettings ? 'Saving settings...' : 'Settings sync automatically to the SOS backend.'}
            </span>
            <button
              type="button"
              onClick={() =>
                void updateSosSettings({
                  customMessageEn: defaults.customMessageEn,
                  customMessageHi: defaults.customMessageHi,
                })
              }
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
            >
              Reset Default Messages
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
