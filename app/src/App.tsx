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

type OptionsTab = 'hardware' | 'telemetry';
type PhysicalButtonMode = 'dungeon' | 'attack';

function formatNow(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

export const App: React.FC = () => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsTab, setOptionsTab] = useState<OptionsTab>('hardware');
  const [buttonMode, setButtonMode] = useState<PhysicalButtonMode>('dungeon');
  const buttonModeRef = useRef<PhysicalButtonMode>('dungeon');
  buttonModeRef.current = buttonMode;

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
  const hwJoyRef = useRef({ x: 0, y: 0, active: false });
  const initialHandshakeDoneRef = useRef(false);

  const engine = useMemo(
    () =>
      new DungeonGameEngine({
        onVictory: (dungeonId) => {
          bleServiceRef.current?.sendAck('victory', String(dungeonId)).catch(() => {});
          setToastMsg(`Vitória na Dungeon #${dungeonId}! Confirmação enviada ao ESP32.`);
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
        if (mode === 'disconnected') {
          hwJoyRef.current = { x: 0, y: 0, active: false };
          initialHandshakeDoneRef.current = false;
        }
      },
      onLog: (entry) => {
        setPacketLogs((prev) => [entry, ...prev].slice(0, 60));
      },
      onPayload: (payload: IncomingEsp32Payload, _rawJson: string, hmacValid: boolean) => {
        if (!hmacValid && payload.type !== 'err') {
          showToast('Pacote descartado: assinatura HMAC inválida!');
          return;
        }
        if (payload.type === 'err') {
          showToast(`[${payload.code}] ${payload.msg}`);
          return;
        }
        if (payload.type === 'joy') {
          hwJoyRef.current.x = Math.max(-1, Math.min(1, payload.x / 100));
          hwJoyRef.current.y = Math.max(-1, Math.min(1, payload.y / 100));
          hwJoyRef.current.active = true;
          if (payload.btn === 1) {
            engine.triggerAttack();
          }
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
          // Se o usuario configurou o botao D27 como "Atacar" em Opcoes (apos o handshake inicial)
          if (initialHandshakeDoneRef.current && buttonModeRef.current === 'attack') {
            engine.triggerAttack();
            engine.triggerDash(hwJoyRef.current.x, hwJoyRef.current.y);
            service.sendAck('loaded', String(payload.dungeon_id)).catch(() => {});
            return;
          }
          initialHandshakeDoneRef.current = true;
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
      setOptionsOpen(false);
    } else if (demo === 'dark') {
      setSimLdrRaw(320);
      service.connectSimulator(320);
      engine.loadDungeon(2, 'dark', false);
      setOptionsOpen(false);
    } else if (demo === 'telemetry' || demo === 'control') {
      const sampleRaws = [1650, 1480, 1290, 1080, 860, 540, 320, 180, 290, 510, 720, 980, 1210, 1420];
      const synthetic: TelemetryRecord[] = sampleRaws.map((raw, idx) => {
        const dark = raw < 620;
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

      setOptionsOpen(true);
      if (demo === 'telemetry') {
        setOptionsTab('telemetry');
      } else {
        setOptionsTab('hardware');
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
      initialHandshakeDoneRef.current = false;
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
    <div className="app-shell game-shell">
      {/* Barra superior estilo Jogo Arcade / Soul Knight */}
      <header className="game-topbar">
        <div className="game-brand">
          <div className="brand-crest" aria-hidden="true">⚔</div>
          <div>
            <h1>DUNGEONLINK</h1>
            <small>IoT Pixel Roguelike</small>
          </div>
        </div>

        {/* R5: Estado do hardware sempre visivel de forma compacta sem poluir o jogo */}
        <div className="game-topbar-right">
          <span className={`badge ${connectionMode}`}>
            {connectionMode === 'ble'
              ? '● BLE'
              : connectionMode === 'simulator'
                ? '● SIM'
                : connectionMode === 'connecting'
                  ? '◌ BLE...'
                  : '○ Offline'}
          </span>
          <span className={`badge ${light === 'dark' ? 'dark-pill' : 'bright-pill'}`}>
            {light === 'dark' ? `🌙 ${ldrPct}%` : `☀ ${ldrPct}%`}
          </span>
          <span className={`badge ${ledState === 1 ? 'led-on' : 'led-off'}`}>
            {ledState === 1 ? '🔴 LED' : '⚫ LED'}
          </span>
          {connectionMode === 'disconnected' && (
            <button type="button" className="btn btn-connect-mini" onClick={handleConnectBle}>
              🔌 Conectar
            </button>
          )}
          <button
            type="button"
            className={`btn options-trigger ${optionsOpen ? 'active' : ''}`}
            onClick={() => setOptionsOpen((v) => !v)}
          >
            ⚙ Opções
          </button>
        </div>
      </header>

      {errorMsg && !optionsOpen && (
        <div className="alert-box">
          <strong>BLE:</strong> {errorMsg}
        </div>
      )}

      {toastMsg && <div className="toast-banner">{toastMsg}</div>}

      {/* Tela principal = 100% JOGO */}
      <main className="main-content">
        <GameCanvas
          engine={engine}
          snapshot={gameSnapshot}
          light={light}
          connected={isConnected}
          hwJoyRef={hwJoyRef}
          onRequestNewDungeon={handleRequestNewDungeon}
          onRetryDungeon={handleRetryDungeon}
        />
      </main>

      {/* Menu de Opcoes (Bluetooth, Joystick Fisico, Telemetria, Seguranca) */}
      {optionsOpen && (
        <div className="options-backdrop" onClick={() => setOptionsOpen(false)}>
          <div className="options-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="options-header">
              <div>
                <h2>⚙ Opções &amp; Painel IoT</h2>
                <span className="inv-sub">
                  Conexão ESP32, Joystick Físico, Telemetria em Tempo Real e Segurança HMAC
                </span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setOptionsOpen(false)}>
                Voltar ao Jogo ✕
              </button>
            </div>

            <div className="options-tabs">
              <button
                type="button"
                className={`tab-btn ${optionsTab === 'hardware' ? 'active' : ''}`}
                onClick={() => setOptionsTab('hardware')}
              >
                🔌 Bluetooth, Hardware &amp; Segurança
              </button>
              <button
                type="button"
                className={`tab-btn ${optionsTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setOptionsTab('telemetry')}
              >
                📊 Telemetria &amp; Gráfico ({telemetryHistory.length})
              </button>
            </div>

            {optionsTab === 'hardware' && (
              <div className="options-body">
                {/* Configuracao do Botao/Joystick da Protoboard */}
                <div className="card hw-joy-card">
                  <h3>🕹 Controle Físico na Protoboard (Joystick / Botão D27)</h3>
                  <p className="muted">
                    Se usar módulo Joystick KY-023: ligue <code>VRx → D32</code>, <code>VRy → D33</code>,{' '}
                    <code>SW → D27</code>, <code>+5V → 3V3</code> e <code>GND → GND</code> para mover o herói
                    direto pela placa! Escolha abaixo o que o clique do botão <strong>D27</strong> faz:
                  </p>
                  <div className="btn-row">
                    <button
                      type="button"
                      className={`btn ${buttonMode === 'dungeon' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setButtonMode('dungeon')}
                    >
                      🎲 Trocar Dungeon (Padrão IoT)
                    </button>
                    <button
                      type="button"
                      className={`btn ${buttonMode === 'attack' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setButtonMode('attack')}
                    >
                      ⚔ Atacar + Dash no Jogo
                    </button>
                  </div>
                </div>

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
              </div>
            )}

            {optionsTab === 'telemetry' && (
              <div className="options-body">
                <TelemetryPanel history={telemetryHistory} latest={latestTelemetry} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
