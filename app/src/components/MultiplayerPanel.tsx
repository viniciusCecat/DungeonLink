import React, { useState } from 'react';
import {
  DEFAULT_VPN_MP_URL,
  type MpRoomInfo,
  type MultiplayerMode,
} from '../net/multiplayerClient';

interface MultiplayerPanelProps {
  status: 'offline' | 'connecting' | 'in_room';
  room: MpRoomInfo | null;
  slot: 1 | 2 | null;
  errorMsg: string;
  currentDungeonId: 1 | 2 | 3;
  onCreateRoom: (url: string, name: string, mode: MultiplayerMode, dungeonId: 1 | 2 | 3) => void;
  onJoinRoom: (url: string, code: string, name: string) => void;
  onSwitchMode: (mode: MultiplayerMode, dungeonId: 1 | 2 | 3) => void;
  onDisconnect: () => void;
}

export const MultiplayerPanel: React.FC<MultiplayerPanelProps> = ({
  status,
  room,
  slot,
  errorMsg,
  currentDungeonId,
  onCreateRoom,
  onJoinRoom,
  onSwitchMode,
  onDisconnect,
}) => {
  const [serverUrl, setServerUrl] = useState(DEFAULT_VPN_MP_URL);
  const [playerName, setPlayerName] = useState('Herói');
  const [joinCode, setJoinCode] = useState('');
  const [selectedMode, setSelectedMode] = useState<MultiplayerMode>('coop');

  const isHost = room?.players.some((p) => p.slot === slot && p.isHost) ?? false;

  return (
    <div className="panel-stack">
      <div className="card mp-card">
        <div className="card-header">
          <div>
            <h3>Multiplayer por Código (VPN Tailscale / Rede Local)</h3>
            <p className="muted">
              Mesma organização do Ruína Divina: crie uma sala com código de 4 letras e convide outro jogador pela VPN Tailscale ou Wi-Fi.
            </p>
          </div>
          <span className={`pill ${status === 'in_room' ? 'pill-ok' : ''}`}>
            {status === 'in_room'
              ? `SALA ${room?.code} (${room?.players.length}/2)`
              : status === 'connecting'
                ? 'CONECTANDO...'
                : 'OFFLINE'}
          </span>
        </div>

        {errorMsg && <div className="alert-box">{errorMsg}</div>}

        {status !== 'in_room' ? (
          <div className="mp-form">
            <div className="mp-grid-2">
              <label className="mp-field">
                <span>Servidor Relay (VPN Tailscale / LAN)</span>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="ws://100.100.204.22:4175"
                />
              </label>
              <label className="mp-field">
                <span>Seu Nome na Sala</span>
                <input
                  type="text"
                  value={playerName}
                  maxLength={16}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Ex: Vini"
                />
              </label>
            </div>

            <div className="mp-presets">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setServerUrl('ws://100.100.204.22:4175')}
              >
                Usar Tailscale VPN (100.100.204.22)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setServerUrl('ws://192.168.100.9:4175')}
              >
                Usar Wi-Fi Local (192.168.100.9)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setServerUrl('ws://127.0.0.1:4175')}
              >
                Localhost (PC)
              </button>
            </div>

            <div className="mp-split">
              <div className="control-box">
                <span className="hud-label">CRIAR SALA (MESTRE / HOST)</span>
                <div className="btn-row">
                  <button
                    type="button"
                    className={`btn ${selectedMode === 'coop' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedMode('coop')}
                  >
                    CO-OP (Masmorra Juntos)
                  </button>
                  <button
                    type="button"
                    className={`btn ${selectedMode === 'pvp' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setSelectedMode('pvp')}
                  >
                    X1 PvP (Arena 1v1)
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={status === 'connecting'}
                  onClick={() => onCreateRoom(serverUrl, playerName || 'Herói 1', selectedMode, currentDungeonId)}
                >
                  Criar Sala {selectedMode === 'pvp' ? 'X1' : 'CO-OP'}
                </button>
              </div>

              <div className="control-box">
                <span className="hud-label">ENTRAR POR CÓDIGO</span>
                <input
                  type="text"
                  className="mp-code-input"
                  value={joinCode}
                  maxLength={6}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO (EX: K7M2)"
                />
                <button
                  type="button"
                  className="btn bag-btn"
                  disabled={status === 'connecting' || joinCode.trim().length < 3}
                  onClick={() => onJoinRoom(serverUrl, joinCode, playerName || 'Herói 2')}
                >
                  Entrar na Sala
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mp-active-box">
            <div className="mp-room-banner">
              <div>
                <span className="hud-label">CÓDIGO DA SALA (PASSE PARA O OUTRO JOGADOR)</span>
                <div className="mp-code-big">{room?.code}</div>
              </div>
              <div>
                <span className="hud-label">MODO ATUAL</span>
                <strong style={{ color: room?.mode === 'pvp' ? '#ff8787' : '#63e6be', fontSize: '1rem' }}>
                  {room?.mode === 'pvp'
                    ? `X1 PvP · Placar ${room.scores.p1} × ${room.scores.p2}`
                    : 'CO-OP · Masmorra Compartilhada'}
                </strong>
              </div>
            </div>

            <div className="mp-players-list">
              {room?.players.map((p) => (
                <span key={p.id} className="badge ble">
                  P{p.slot}: {p.name} {p.isHost ? '(Host)' : ''} {p.slot === slot ? '· Você' : ''}
                </span>
              ))}
              {(room?.players.length || 0) < 2 && (
                <span className="badge simulator">Aguardando 2º jogador entrar com o código {room?.code}...</span>
              )}
            </div>

            <div className="btn-row">
              {isHost && (
                <>
                  <button
                    type="button"
                    className={`btn ${room?.mode === 'coop' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => onSwitchMode('coop', currentDungeonId)}
                  >
                    Trocar para CO-OP
                  </button>
                  <button
                    type="button"
                    className={`btn ${room?.mode === 'pvp' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => onSwitchMode('pvp', currentDungeonId)}
                  >
                    Trocar para X1 PvP
                  </button>
                </>
              )}
              <button type="button" className="btn btn-danger" onClick={onDisconnect}>
                Sair da Sala
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
