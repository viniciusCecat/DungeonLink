import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DungeonBleService,
  type ConnectionMode,
  type PacketLogEntry,
} from './ble/bleService';
import type { IncomingEsp32Payload, LedMode, LightState } from './ble/protocol';
import { ControlPanel } from './components/ControlPanel';
import { GameCanvas } from './components/GameCanvas';
import { TelemetryPanel, type TelemetryRecord } from './components/TelemetryPanel';
import { DungeonGameEngine, type GameSnapshot } from './game/engine';

type TabKey = 'game' | 'telemetry' | 'control';

function formatNow(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('game');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('disconnected');
  const [deviceLabel, setDeviceLabel] = useState('Nenhum dispositivo');
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [light, setLight] = useState<LightState>('bright');
  const [ldrPct, setLdrPct] = useState<number>(60);
  const [ledState, setLedState] = useState<0 | 1>(0);
  const [ledMode, setLedMode] = useState<LedMode>('auto');
  const [simLdrRaw, setSimLdrRaw] = useState<number>(2450);

  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryRecord[]>([]);
  const [packetLogs, setPacketLogs] = useState<PacketLogEntry[]>([]);
  const recordCounterRef = useRef(0);
  const bleServiceRef = useRef<DungeonBleService | null>(null);
  const onStateChangeRef = useRef<(snap: GameSnapshot) => void>(() => {});

  const engine = useMemo(
    () =>
      new DungeonGameEngine({
        onVictory: (dungeonId) => {
          bleServiceRef.current?.sendAck('victory', String(dungeonId)).catch(() => {});
          setToastMsg(`Vitoria na Dungeon #${dungeonId}! Confirmacao enviada ao ESP32.`);
        },
        onDamage: () => {
          bleServiceRef.current?.sendAck('damage', '1').catch(() => {});
        },
        onStateChange: (snap) => {
          onStateChangeRef.current(snap);
        },
      }),
    [],
  );

  const [gameSnapshot, setGameSnapshot] = useState<GameSnapshot>(() => engine.getSnapshot());
  onStateChangeRef.current = setGameSnapshot;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(''), 3800);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    const service = new DungeonBleService({
      onStatusChange: (mode, label, err) => {
        setConnectionMode(mode);
        setDeviceLabel(label);
        setErrorMsg(err || '');
      },
      onLog: (entry) => {
        setPacketLogs((prev) => [entry, ...prev].slice(0, 60));
      },
      onPayload: (payload: IncomingEsp32Payload, _rawJson: string, hmacValid: boolean) => {
        if (!hmacValid && payload.type !== 'err') {
          showToast('Pacote descartado: assinatura HMAC invalida!');
          return;
        }
        if (payload.type === 'err') {
          showToast(`[${payload.code}] ${payload.msg}`);
          return;
        }

        setLight(payload.light);
        setLdrPct(payload.ldr_pct);
        setLedState(payload.led);
        setLedMode(payload.mode);
        engine.setLightState(payload.light);

        recordCounterRef.current += 1;
        const rec: TelemetryRecord = {
          id: recordCounterRef.current,
          time: formatNow(),
          seq: payload.seq,
          type: payload.type,
          dungeonId: payload.dungeon_id,
          ldrRaw: payload.ldr_raw,
          ldrPct: payload.ldr_pct,
          light: payload.light,
          led: payload.led,
          mode: payload.mode,
        };
        setTelemetryHistory((prev) => [...prev, rec].slice(-120));

        if (payload.type === 'dungeon_req') {
          engine.loadDungeon(payload.dungeon_id, payload.light, true);
          service.sendAck('loaded', String(payload.dungeon_id)).catch(() => {});
          showToast(
            `Dungeon #${payload.dungeon_id} carregada (${payload.light === 'dark' ? 'Escuro' : 'Claro'})`,
          );
        }
      },
    });

    bleServiceRef.current = service;

    // Suporte a query param ?demo= para captura de evidencias e testes rapidos
    const demo = new URLSearchParams(window.location.search).get('demo');
    if (demo === 'bright') {
      setSimLdrRaw(2850);
      service.connectSimulator(2850);
      engine.loadDungeon(1, 'bright', false);
      setActiveTab('game');
    } else if (demo === 'dark') {
      setSimLdrRaw(490);
      service.connectSimulator(490);
      engine.loadDungeon(2, 'dark', false);
      setActiveTab('game');
    } else if (demo === 'telemetry' || demo === 'control') {
      const sampleRaws = [2100, 1950, 1730, 1520, 1290, 880, 620, 490, 510, 740, 1100, 1450, 1710, 1890];
      const synthetic: TelemetryRecord[] = sampleRaws.map((raw, idx) => {
        const dark = raw < 950;
        return {
          id: idx + 1,
          time: `19:4${Math.floor(idx / 6)}:${String((idx * 4) % 60).padStart(2, '0')}`,
          seq: idx + 1,
          type: idx === 0 || idx === 6 ? 'dungeon_req' : 'telemetry',
          dungeonId: idx >= 6 ? 2 : 1,
          ldrRaw: raw,
          ldrPct: Math.round((raw * 100) / 4095),
          light: dark ? 'dark' : 'bright',
          led: dark ? 1 : 0,
          mode: 'auto',
        };
      });
      recordCounterRef.current = synthetic.length;
      setTelemetryHistory(synthetic);
      setSimLdrRaw(2890);
      service.connectSimulator(2890);

      if (demo === 'telemetry') {
        setActiveTab('telemetry');
      } else {
        setActiveTab('control');
        setTimeout(() => {
          service.sendForgedSecurityTest().catch(() => {});
        }, 120);
      }
    }

    return () => {
      service.disconnect().catch(() => {});
    };
  }, [engine, showToast]);

  const handleConnectBle = () => {
    bleServiceRef.current?.connectRealBle().catch(() => {});
  };

  const handleStartSimulator = () => {
    bleServiceRef.current?.connectSimulator(simLdrRaw);
    showToast('Simulador local do ESP32 ativado.');
  };

  const handleDisconnect = () => {
    bleServiceRef.current?.disconnect().catch(() => {});
  };

  const handleSimLdrChange = (raw: number) => {
    setSimLdrRaw(raw);
    bleServiceRef.current?.mockDevice.setSimulatedLdr(raw);
  };

  const handleSimButtonPress = () => {
    bleServiceRef.current?.mockDevice.pressPhysicalButton();
  };

  const handleRequestNewDungeon = () => {
    if (connectionMode === 'ble' || connectionMode === 'simulator') {
      bleServiceRef.current?.sendNewDungeonCommand().catch(() => {});
    } else {
      const nextId = (gameSnapshot.dungeonId % 3) + 1;
      engine.loadDungeon(nextId, light, true);
      showToast(`Modo offline: Dungeon #${nextId} carregada localmente.`);
    }
  };

  const handleRetryDungeon = () => {
    engine.retryCurrentDungeon();
  };

  const handleSetMode = (mode: LedMode) => {
    bleServiceRef.current?.sendSetModeCommand(mode).catch(() => {});
  };

  const handleSetManualLed = (state: 0 | 1) => {
    bleServiceRef.current?.sendSetLedCommand(state).catch(() => {});
  };

  const handleSendForgedSecurityTest = () => {
    bleServiceRef.current?.sendForgedSecurityTest().catch(() => {});
  };

  const latestTelemetry =
    telemetryHistory.length > 0 ? telemetryHistory[telemetryHistory.length - 1] : null;
  const isConnected = connectionMode === 'ble' || connectionMode === 'simulator';

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <h1>DungeonLink</h1>
            <small>ESP32 · BLE · IoT Pixel Adventure</small>
          </div>
        </div>

        {/* R5: Estado do sistema visivel sem Monitor Serial */}
        <div className="status-pills">
          <span className={`badge ${connectionMode}`}>
            {connectionMode === 'ble'
              ? 'BLE Conectado'
              : connectionMode === 'simulator'
                ? 'Simulador Local'
                : connectionMode === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
          </span>
          <span className={`badge ${light === 'dark' ? 'dark-pill' : 'bright-pill'}`}>
            {light === 'dark' ? `🌙 ESCURO ${ldrPct}%` : `☀ CLARO ${ldrPct}%`}
          </span>
          <span className={`badge ${ledState === 1 ? 'led-on' : 'led-off'}`}>
            {ledState === 1 ? '🔴 LED ACESO' : '⚫ LED APAGADO'} ({ledMode.toUpperCase()})
          </span>
        </div>
      </header>

      {connectionMode === 'disconnected' && (
        <div className="quick-connect-banner">
          <span>Conecte ao ESP32 via Bluetooth ou teste no Simulador Local:</span>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={handleConnectBle}>
              Conectar ESP32
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleStartSimulator}>
              Simulador Local
            </button>
          </div>
        </div>
      )}

      {toastMsg && <div className="toast-banner">{toastMsg}</div>}

      <nav className="tab-bar" role="tablist">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
        >
          Jogo 2D
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          Telemetria &amp; Grafico
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'control' ? 'active' : ''}`}
          onClick={() => setActiveTab('control')}
        >
          BLE &amp; Seguranca
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'game' && (
          <GameCanvas
            engine={engine}
            snapshot={gameSnapshot}
            light={light}
            connected={isConnected}
            onRequestNewDungeon={handleRequestNewDungeon}
            onRetryDungeon={handleRetryDungeon}
          />
        )}

        {activeTab === 'telemetry' && (
          <TelemetryPanel history={telemetryHistory} latest={latestTelemetry} />
        )}

        {activeTab === 'control' && (
          <ControlPanel
            connectionMode={connectionMode}
            deviceLabel={deviceLabel}
            errorMsg={errorMsg}
            ledMode={ledMode}
            ledState={ledState}
            simLdrRaw={simLdrRaw}
            packetLogs={packetLogs}
            onConnectBle={handleConnectBle}
            onStartSimulator={handleStartSimulator}
            onDisconnect={handleDisconnect}
            onSimLdrChange={handleSimLdrChange}
            onSimButtonPress={handleSimButtonPress}
            onSetMode={handleSetMode}
            onSetManualLed={handleSetManualLed}
            onSendForgedSecurityTest={handleSendForgedSecurityTest}
          />
        )}
      </main>
    </div>
  );
};
