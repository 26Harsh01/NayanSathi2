import { dispatchWaveToContacts, partitionAuthorizedRecipients } from './dispatcher';
import {
  addAuditLog,
  broadcastPatientEvent,
  getAllAlertsPendingEscalation,
  getPatientContacts,
  getPatientEmergencySettings,
  saveAlert,
} from './store';

let workerTimer: ReturnType<typeof setInterval> | null = null;
const inFlightAlerts = new Set<string>();

export async function processDueEscalations(): Promise<void> {
  const dueAlerts = getAllAlertsPendingEscalation(Date.now());
  for (const alert of dueAlerts) {
    if (inFlightAlerts.has(alert.id)) continue;
    inFlightAlerts.add(alert.id);
    try {
      const settings = getPatientEmergencySettings(alert.patientId);
      const contacts = getPatientContacts(alert.patientId);
      const { secondaryRecipients } = partitionAuthorizedRecipients(contacts);

      // Advance escalation stage immediately so it never repeats indefinitely
      const escalatedBase = {
        ...alert,
        escalationStage: 1,
        nextEscalationAt: undefined,
      };
      saveAlert(escalatedBase);

      if (!settings.escalationEnabled || secondaryRecipients.length === 0) {
        addAuditLog(
          alert.patientId,
          'emergency_escalation_skipped',
          'escalation_worker',
          secondaryRecipients.length === 0
            ? 'No eligible secondary contacts configured for escalation.'
            : 'Escalation disabled in settings.'
        );
        broadcastPatientEvent(alert.patientId, 'alert:updated', escalatedBase);
        continue;
      }

      addAuditLog(
        alert.patientId,
        'emergency_escalation_triggered',
        'escalation_worker',
        `Escalating unacknowledged alert ${alert.id} to ${secondaryRecipients.length} secondary contact(s).`
      );

      await dispatchWaveToContacts({
        alert: escalatedBase,
        contacts: secondaryRecipients,
        settings,
        simulateExplicitly: false,
        waveLabel: 'escalation_secondary',
      });
    } catch (err) {
      console.error(`Escalation worker error for alert ${alert.id}:`, err);
    } finally {
      inFlightAlerts.delete(alert.id);
    }
  }
}

export function startEscalationWorker(pollIntervalMs = 5000): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    void processDueEscalations();
  }, pollIntervalMs);
  if (typeof workerTimer.unref === 'function') {
    workerTimer.unref();
  }
}

export function stopEscalationWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
