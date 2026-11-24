import type { ArmorId, WeaponId } from '../game/items';

export type MultiplayerMode = 'coop' | 'pvp';

export interface MpPlayerMeta {
  id: string;
  slot: 1 | 2;
  name: string;
  isHost: boolean;
}

export interface MpRoomInfo {
  code: string;
  mode: MultiplayerMode;
  dungeonId: 1 | 2 | 3;
  scores: { p1: number; p2: number };
  players: MpPlayerMeta[];
}

export interface RemoteHeroState {
  x: number;
  y: number;
  aimAngle: number;
  moving: boolean;
  dashActive: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  weaponId: WeaponId;
  armorId: ArmorId;
  room: 1 | 2 | 3;
  name: string;
  slot: 1 | 2;
  attackFlashMs: number;
  lastSeenMs: number;
}

export interface MpClientCallbacks {
  onStatusChange: (status: 'offline' | 'connecting' | 'in_room', room: MpRoomInfo | null, slot: 1 | 2 | null, error?: string) => void;
  onRemoteState: (state: Partial<RemoteHeroState>) => void;
  onRemoteAttack: (data: { x: number; y: number; aimAngle: number; weaponId: WeaponId; armorId: ArmorId; room: number }) => void;
  onRemoteEnemyHit: (data: { enemyId: string; damage: number }) => void;
  onPvpHitReceived: (data: { damage: number; kx: number; ky: number }) => void;
  onMatchReset: (room: MpRoomInfo) => void;
  onPvpScore: (winnerSlot: 1 | 2, scores: { p1: number; p2: number }) => void;
  onRoomSync: (data: { dungeonId: 1 | 2 | 3; room: 1 | 2 | 3 }) => void;
  onPeerLeft: () => void;
}

export const DEFAULT_VPN_MP_URL = 'ws://100.100.204.22:4175';

export class DungeonMultiplayerClient {
  private ws: WebSocket | null = null;
  public room: MpRoomInfo | null = null;
  public slot: 1 | 2 | null = null;
  public playerId: string | null = null;
  public serverUrl = DEFAULT_VPN_MP_URL;

  constructor(private readonly callbacks: MpClientCallbacks) {}

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.room !== null;
  }

  private openAndSend(url: string, firstMsg: Record<string, unknown>): void {
    this.disconnect();
    const cleanUrl = url.trim().startsWith('ws') ? url.trim() : `ws://${url.trim()}`;
    this.serverUrl = cleanUrl;
    this.callbacks.onStatusChange('connecting', null, null);

    try {
      const ws = new WebSocket(cleanUrl);
      this.ws = ws;

      const timer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          this.callbacks.onStatusChange(
            'offline',
            null,
            null,
            `Tempo esgotado em ${cleanUrl}. Confira se o servidor MP está rodando e o Tailscale conectado.`,
          );
        }
      }, 6000);

      ws.onopen = () => {
        clearTimeout(timer);
        ws.send(JSON.stringify(firstMsg));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data));
          this.handleMessage(msg);
        } catch {
          // Ignora mensagem invalida
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        this.callbacks.onStatusChange(
          'offline',
          null,
          null,
          `Falha ao conectar em ${cleanUrl}. Verifique o IP VPN Tailscale ou Wi-Fi.`,
        );
      };

      ws.onclose = () => {
        clearTimeout(timer);
        if (this.ws === ws) {
          this.ws = null;
          this.room = null;
          this.slot = null;
          this.playerId = null;
          this.callbacks.onPeerLeft();
          this.callbacks.onStatusChange('offline', null, null);
        }
      };
    } catch (err) {
      this.callbacks.onStatusChange(
        'offline',
        null,
        null,
        err instanceof Error ? err.message : 'URL WebSocket inválida.',
      );
    }
  }

  createRoom(url: string, name: string, mode: MultiplayerMode, dungeonId: 1 | 2 | 3): void {
    this.openAndSend(url, { type: 'create_room', name, mode, dungeonId });
  }

  joinRoom(url: string, code: string, name: string): void {
    this.openAndSend(url, { type: 'join_room', code: code.trim().toUpperCase(), name });
  }

  switchMode(mode: MultiplayerMode, dungeonId: 1 | 2 | 3): void {
    this.send({ type: 'set_mode', mode, dungeonId });
  }

  sendState(state: Omit<RemoteHeroState, 'attackFlashMs' | 'lastSeenMs' | 'name' | 'slot'>): void {
    this.send({ type: 'state', ...state });
  }

  sendAttack(data: { x: number; y: number; aimAngle: number; weaponId: WeaponId; armorId: ArmorId; room: number }): void {
    this.send({ type: 'attack', ...data });
  }

  sendEnemyHit(enemyId: string, damage: number): void {
    this.send({ type: 'enemy_hit', enemyId, damage });
  }

  sendPvpHit(damage: number, kx: number, ky: number): void {
    this.send({ type: 'pvp_hit', damage, kx, ky });
  }

  sendPvpKo(winnerSlot: 1 | 2): void {
    this.send({ type: 'pvp_ko', winnerSlot });
  }

  sendRoomSync(dungeonId: 1 | 2 | 3, room: 1 | 2 | 3): void {
    this.send({ type: 'room_sync', dungeonId, room });
  }

  disconnect(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'leave_room' }));
        }
        this.ws.close();
      } catch {
        // Ignora
      }
      this.ws = null;
    }
    this.room = null;
    this.slot = null;
    this.playerId = null;
    this.callbacks.onPeerLeft();
    this.callbacks.onStatusChange('offline', null, null);
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // Ignora
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = String(msg.type || '');
    if (type === 'mp_error') {
      this.callbacks.onStatusChange('offline', null, null, String(msg.msg || 'Erro na sala'));
      return;
    }
    if (type === 'room_joined') {
      this.playerId = String(msg.playerId || '');
      this.slot = Number(msg.slot) === 2 ? 2 : 1;
      this.room = msg.room as MpRoomInfo;
      this.callbacks.onStatusChange('in_room', this.room, this.slot);
      this.callbacks.onMatchReset(this.room);
      return;
    }
    if (type === 'room_update') {
      this.room = msg.room as MpRoomInfo;
      this.callbacks.onStatusChange('in_room', this.room, this.slot);
      return;
    }
    if (type === 'match_reset') {
      this.room = msg.room as MpRoomInfo;
      this.callbacks.onStatusChange('in_room', this.room, this.slot);
      this.callbacks.onMatchReset(this.room);
      return;
    }
    if (type === 'pvp_score') {
      const winnerSlot = Number(msg.winnerSlot) === 2 ? 2 : 1;
      const scores = msg.scores as { p1: number; p2: number };
      if (this.room) {
        this.room = { ...this.room, scores };
        this.callbacks.onStatusChange('in_room', this.room, this.slot);
      }
      this.callbacks.onPvpScore(winnerSlot, scores);
      return;
    }
    if (type === 'state') {
      this.callbacks.onRemoteState(msg as unknown as Partial<RemoteHeroState>);
      return;
    }
    if (type === 'attack') {
      this.callbacks.onRemoteAttack(
        msg as unknown as { x: number; y: number; aimAngle: number; weaponId: WeaponId; armorId: ArmorId; room: number },
      );
      return;
    }
    if (type === 'enemy_hit') {
      this.callbacks.onRemoteEnemyHit({
        enemyId: String(msg.enemyId || ''),
        damage: Number(msg.damage || 1),
      });
      return;
    }
    if (type === 'pvp_hit') {
      this.callbacks.onPvpHitReceived({
        damage: Number(msg.damage || 1),
        kx: Number(msg.kx || 0),
        ky: Number(msg.ky || 0),
      });
      return;
    }
    if (type === 'room_sync') {
      this.callbacks.onRoomSync({
        dungeonId: ([1, 2, 3].includes(Number(msg.dungeonId)) ? Number(msg.dungeonId) : 1) as 1 | 2 | 3,
        room: ([1, 2, 3].includes(Number(msg.room)) ? Number(msg.room) : 1) as 1 | 2 | 3,
      });
      return;
    }
    if (type === 'peer_left') {
      this.callbacks.onPeerLeft();
    }
  }
}
