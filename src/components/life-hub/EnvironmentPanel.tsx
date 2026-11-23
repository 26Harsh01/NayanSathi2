import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Fan,
  Lightbulb,
  Sliders,
  Thermometer,
  Tv,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useLifeHub } from '../../context/LifeHubContext';
import { GazeButton } from '../gaze/GazeButton';
import { speakText } from '../../features/communication/text-to-speech';
import type { RoomDeviceType } from '../../types';

interface DeviceControlDef {
  deviceType: RoomDeviceType;
  label: string;
  commands: string[];
  icon: React.ReactNode;
}

const ROOM_DEVICES: DeviceControlDef[] = [
  {
    deviceType: 'lights',
    label: 'Lights',
    commands: ['Turn On', 'Turn Off', 'Dim Lights'],
    icon: <Lightbulb className="w-4 h-4" />,
  },
  {
    deviceType: 'fan',
    label: 'Fan',
    commands: ['Turn On', 'Turn Off', 'Increase Speed', 'Slow Down'],
    icon: <Fan className="w-4 h-4" />,
  },
  {
    deviceType: 'tv',
    label: 'Television',
    commands: ['Turn On', 'Turn Off', 'Volume Up', 'Volume Down', 'Change Channel'],
    icon: <Tv className="w-4 h-4" />,
  },
  {
    deviceType: 'curtains',
    label: 'Curtains',
    commands: ['Open Curtains', 'Close Curtains'],
    icon: <Sliders className="w-4 h-4" />,
  },
  {
    deviceType: 'temperature',
    label: 'Temperature / AC',
    commands: ['Cooler', 'Warmer', 'Turn Off AC'],
    icon: <Thermometer className="w-4 h-4" />,
  },
];

export const EnvironmentPanel: React.FC = () => {
  const { settings } = useAppState();
  const { state, updateSmartHomeConfig, triggerRoomControl } = useLifeHub();
  const lang = settings.communication.language;

  const [mode, setMode] = useState<'smart_device' | 'caregiver'>('caregiver');
  const [serverBridgeConnected, setServerBridgeConnected] = useState(false);
  const [customDeviceLabel, setCustomDeviceLabel] = useState('');
  const [customDeviceCommand, setCustomDeviceCommand] = useState('');
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyCmd, setBusyCmd] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/smart-home/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { serverBridgeConfigured?: boolean } | null) => {
        if (data && typeof data.serverBridgeConfigured === 'boolean') {
          setServerBridgeConnected(data.serverBridgeConfigured);
        }
      })
      .catch(() => setServerBridgeConnected(false));
  }, []);

  const handleCommand = async (
    deviceType: RoomDeviceType,
    deviceLabel: string,
    command: string
  ) => {
    const key = `${deviceType}_${command}`;
    setBusyCmd(key);
    const res = await triggerRoomControl({ deviceType, deviceLabel, command, mode });
    setLastResult(res);
    setBusyCmd(null);

    if (mode === 'caregiver') {
      speakText(`${deviceLabel}: ${command}`, {
        language: lang,
        rate: settings.communication.speechRate,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector: Mode A Real Smart Home vs Mode B Caregiver Assistance */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Control Mode
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Mode A sends authenticated smart-device commands and reports confirmation/failure honestly. Mode B sends a Caregiver Assistance request tracked in real time.
            </p>
          </div>
          <span className="text-xs font-semibold inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            {serverBridgeConnected ? (
              <>
                <Wifi className="w-4 h-4 text-teal-600" />
                <span>Server Smart-Home Bridge Configured</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-amber-600" />
                <span>Smart-Home Bridge Not Connected</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <GazeButton
            gazeId="room_mode_caregiver"
            variant={mode === 'caregiver' ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => setMode('caregiver')}
          >
            <span>Mode B: Caregiver Assistance Request</span>
          </GazeButton>

          <GazeButton
            gazeId="room_mode_smart"
            variant={mode === 'smart_device' ? 'selected' : 'default'}
            sizeOverride="standard"
            onClick={() => setMode('smart_device')}
          >
            <span>Mode A: Connected Smart Device API</span>
          </GazeButton>
        </div>

        {mode === 'smart_device' && !serverBridgeConnected && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              No server-side Home Assistant bridge (`HOME_ASSISTANT_URL` & `HOME_ASSISTANT_TOKEN`) is currently configured. Mode A commands will honestly report failure rather than faking device state. Use Mode B for caregiver assistance.
            </span>
          </div>
        )}
      </div>

      {lastResult && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
            lastResult.ok
              ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-300 dark:border-teal-800 text-teal-900 dark:text-teal-200'
              : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {lastResult.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{lastResult.message}</span>
        </div>
      )}

      {/* Room Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ROOM_DEVICES.map((dev) => (
          <div
            key={dev.deviceType}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span className="text-teal-700 dark:text-teal-400">{dev.icon}</span>
                <span>{dev.label}</span>
              </div>
              {mode === 'smart_device' && (
                <input
                  type="text"
                  placeholder="HA entity_id (e.g. light.bedroom)"
                  value={state.smartHomeConfig.entityMap?.[dev.deviceType] || ''}
                  onChange={(e) =>
                    updateSmartHomeConfig({
                      ...state.smartHomeConfig,
                      entityMap: {
                        ...state.smartHomeConfig.entityMap,
                        [dev.deviceType]: e.target.value,
                      },
                    })
                  }
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs w-48"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {dev.commands.map((cmd) => {
                const key = `${dev.deviceType}_${cmd}`;
                return (
                  <GazeButton
                    key={cmd}
                    gazeId={`room_${dev.deviceType}_${cmd.replace(/\s+/g, '_')}`}
                    variant="default"
                    sizeOverride="standard"
                    disabled={busyCmd === key}
                    onClick={() => void handleCommand(dev.deviceType, dev.label, cmd)}
                  >
                    <span>{busyCmd === key ? 'Sending...' : cmd}</span>
                  </GazeButton>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom Room Device */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Custom Device Request</h3>
          <input
            type="text"
            placeholder="Device name (e.g. Bed Lamp, Door)"
            value={customDeviceLabel}
            onChange={(e) => setCustomDeviceLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <input
            type="text"
            placeholder="Action (e.g. Switch off, Open slightly)"
            value={customDeviceCommand}
            onChange={(e) => setCustomDeviceCommand(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
          <GazeButton
            gazeId="room_custom_send"
            variant="primary"
            sizeOverride="standard"
            onClick={() => {
              if (!customDeviceLabel.trim() || !customDeviceCommand.trim()) return;
              void handleCommand('other', customDeviceLabel.trim(), customDeviceCommand.trim());
              setCustomDeviceLabel('');
              setCustomDeviceCommand('');
            }}
          >
            <span>Send Device Control Request</span>
          </GazeButton>
        </div>
      </div>

      {/* Log */}
      {state.roomControlLogs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Room Control Log
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
            {state.roomControlLogs.slice(0, 12).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  <strong>{log.deviceLabel}</strong> · {log.command} ·{' '}
                  <span className="capitalize">{log.status.replace('_', ' ')}</span>
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
