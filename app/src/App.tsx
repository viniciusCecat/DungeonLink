import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DungeonBleService,
  type ConnectionMode,
  type PacketLogEntry,
} from './ble/bleService';
import type { IncomingEsp32Payload, LedMode, LightState } from './ble/protocol';
import { ControlPanel } from './components/ControlPanel';
import { GameCanvas } from './components/GameCanvas';
import { MultiplayerPanel } from './components/MultiplayerPanel';
import { TelemetryPanel, type TelemetryRecord } from './components/TelemetryPanel';
import { DungeonGameEngine, type GameSnapshot } from './game/engine';
import {
  DungeonMultiplayerClient,
  type MpRoomInfo,
  type MultiplayerMode,
} from './net/multiplayerClient';

type OptionsTab = 'hardware' | 'telemetry' | 'multiplayer';

function formatNow(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

export const App: React.FC = () => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsTab, setOptionsTab] = useState<OptionsTab>('hardware');

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('disconnected');
  const [deviceLabel, setDeviceLabel] = useState('Nenhum dispositivo');
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [light, setLight] = useState<LightState>('bright');
  const [ldrPct, setLdrPct] = useState<number>(60);
  const [ledState, setLedState] = useState<0 | 1>(0);
  const [ledMode, setLedMode] = useState<LedMode>('auto');
  const [simLdrRaw, setSimLdrRaw] = useState<number>(2450);

  const [mpStatus, setMpStatus] = useState<'offline' | 'connecting' | 'in_room'>('offline');
  const [mpRoom, setMpRoom] = useState<MpRoomInfo | null>(null);
  const [mpSlot, setMpSlot] = useState<1 | 2 | null>(null);
  const [mpError, setMpError] = useState('');

  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryRecord[]>([]);
  const [packetLogs, setPacketLogs] = useState<PacketLogEntry[]>([]);
  const recordCounterRef = useRef(0);
  const bleServiceRef = useRef<DungeonBleService | null>(null);
  const mpClientRef = useRef<DungeonMultiplayerClient | null>(null);
  const onStateChangeRef = useRef<(snap: GameSnapshot) => void>(() => {});
  const mpRoomRef = useRef<MpRoomInfo | null>(null);
  const mpSlotRef = useRef<1 | 2 | null>(null);
  mpRoomRef.current = mpRoom;
  mpSlotRef.current = mpSlot;

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
        onLocalStateBroadcast: (state) => {
          mpClientRef.current?.sendState(state);
        },
        onLocalAttackBroadcast: (data) => {
          mpClientRef.current?.sendAttack(data);
        },
        onEnemyHitBroadcast: (enemyId, damage) => {
          mpClientRef.current?.sendEnemyHit(enemyId, damage);
        },
        onPvpHitBroadcast: (damage, kx, ky) => {
          mpClientRef.current?.sendPvpHit(damage, kx, ky);
        },
        onPvpLocalDefeated: () => {
          const winnerSlot: 1 | 2 = mpSlotRef.current === 1 ? 2 : 1;
          mpClientRef.current?.sendPvpKo(winnerSlot);
        },
        onRoomChangeBroadcast: (dungeonId, room) => {
          mpClientRef.current?.sendRoomSync(dungeonId, room);
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
    const mp = new DungeonMultiplayerClient({
      onStatusChange: (status, room, slot, err) => {
        setMpStatus(status);
        setMpRoom(room);
        setMpSlot(slot);
        setMpError(err || '');
        if (status === 'offline') {
          engine.setMultiplayerSession('solo', 1);
        }
      },
      onRemoteState: (patch) => {
        const room = mpRoomRef.current;
        const mySlot = mpSlotRef.current;
        const peer = room?.players.find((p) => p.slot !== mySlot);
        engine.updateRemoteHero(patch, peer?.name || 'Jogador 2', peer?.slot || 2);
      },
      onRemoteAttack: (data) => {
        engine.receiveRemoteAttack(data);
      },
      onRemoteEnemyHit: ({ enemyId, damage }) => {
        engine.applyRemoteEnemyHit(enemyId, damage);
      },
      onPvpHitReceived: ({ damage, kx, ky }) => {
        engine.applyPvpHitReceived(damage, kx, ky);
      },
      onMatchReset: (room) => {
        const mySlot = mpClientRef.current?.slot ?? 1;
        engine.setMultiplayerSession(room.mode, mySlot, room.dungeonId, room.scores);
        setOptionsOpen(false);
        showToast(
          room.mode === 'pvp'
            ? `Sala X1 ${room.code} pronta! Duelo 1v1 iniciado!`
            : `Sala CO-OP ${room.code} conectada!`,
        );
      },
      onPvpScore: (winnerSlot, scores) => {
        engine.updatePvpScores(winnerSlot, scores);
      },
      onRoomSync: ({ dungeonId, room }) => {
        engine.syncToRoomFromPeer(dungeonId, room);
      },
      onPeerLeft: () => {
        engine.clearRemoteHero();
      },
    });
    mpClientRef.current = mp;

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
          showToast('Pacote descartado: assinatura HMAC inválida!');
          return;
        }
        if (payload.type === 'err') {
          showToast(`[${payload.code}] ${payload.msg}`);
          return;
        }
        if (payload.type === 'joy') {
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
      mp.disconnect();
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
      const nextId = ((gameSnapshot.dungeonId % 3) + 1) as 1 | 2 | 3;
      engine.loadDungeon(nextId, light, true);
      if (mpRoom?.mode === 'coop') {
        mpClientRef.current?.sendRoomSync(nextId, 1);
      }
      showToast(`Dungeon #${nextId} carregada!`);
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
    <div className="fs-root">
      <GameCanvas
        engine={engine}
        snapshot={gameSnapshot}
        light={light}
        ldrPct={ldrPct}
        ledState={ledState}
        connectionMode={connectionMode}
        connected={isConnected}
        errorMsg={errorMsg}
        toastMsg={toastMsg}
        optionsOpen={optionsOpen}
        mpRoom={mpRoom}
        onConnectBle={handleConnectBle}
        onOpenOptions={(tab = 'hardware') => {
          setOptionsTab(tab);
          setOptionsOpen(true);
        }}
        onRequestNewDungeon={handleRequestNewDungeon}
        onRetryDungeon={handleRetryDungeon}
      />

      {/* Menu de Opcoes (Bluetooth, Multiplayer CO-OP/X1, Telemetria e Seguranca) */}
      {optionsOpen && (
        <div className="options-backdrop" onClick={() => setOptionsOpen(false)}>
          <div className="options-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="options-header">
              <div>
                <h2>Opções, Multiplayer &amp; Painel IoT</h2>
                <span className="inv-sub">
                  BLE ESP32, Salas Online CO-OP/X1 (Tailscale VPN), Telemetria LDR e Segurança HMAC
                </span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setOptionsOpen(false)}>
                Voltar ao Jogo ✕
              </button>
            </div>

            <div className="options-tabs options-tabs-3">
              <button
                type="button"
                className={`tab-btn ${optionsTab === 'hardware' ? 'active' : ''}`}
                onClick={() => setOptionsTab('hardware')}
              >
                BLE &amp; Segurança
              </button>
              <button
                type="button"
                className={`tab-btn ${optionsTab === 'multiplayer' ? 'active' : ''}`}
                onClick={() => setOptionsTab('multiplayer')}
              >
                Multiplayer {mpRoom ? `(${mpRoom.code})` : '(CO-OP / X1)'}
              </button>
              <button
                type="button"
                className={`tab-btn ${optionsTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setOptionsTab('telemetry')}
              >
                Telemetria ({telemetryHistory.length})
              </button>
            </div>

            {optionsTab === 'hardware' && (
              <div className="options-body">
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

            {optionsTab === 'multiplayer' && (
              <div className="options-body">
                <MultiplayerPanel
                  status={mpStatus}
                  room={mpRoom}
                  slot={mpSlot}
                  errorMsg={mpError}
                  currentDungeonId={gameSnapshot.dungeonId}
                  onCreateRoom={(url, name, mode, dungeonId) =>
                    mpClientRef.current?.createRoom(url, name, mode, dungeonId)
                  }
                  onJoinRoom={(url, code, name) => mpClientRef.current?.joinRoom(url, code, name)}
                  onSwitchMode={(mode: MultiplayerMode, dungeonId: 1 | 2 | 3) =>
                    mpClientRef.current?.switchMode(mode, dungeonId)
                  }
                  onDisconnect={() => mpClientRef.current?.disconnect()}
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
