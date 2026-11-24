import type { LightState } from '../ble/protocol';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  getDungeonById,
  type DungeonDefinition,
  type EnemyKind,
} from './dungeons';
import {
  ARMORS,
  RELICS,
  WEAPONS,
  createInitialInventory,
  type ArmorId,
  type InventoryState,
  type RelicId,
  type WeaponId,
} from './items';
import {
  BIOME_PALETTES,
  drawBrazier,
  drawChestTile,
  drawDoorTile,
  drawEnemy,
  drawHero,
  drawPortalTile,
  getBiomeTileset,
  getGlowStamp,
  getLightHoleStamp,
} from './pixelSprites';
import type { MultiplayerMode, RemoteHeroState } from '../net/multiplayerClient';
import { soundEngine } from './sound';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Projectile {
  owner: 'player' | 'enemy' | 'remote';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  coreColor: string;
  damage: number;
  life: number;
  slowsEnemy?: boolean;
  piercing?: boolean;
  hitIds?: Set<string>;
}

interface DashGhost {
  x: number;
  y: number;
  aimAngle: number;
  alpha: number;
}

interface ActiveEnemy {
  id: string;
  kind: EnemyKind;
  name: string;
  isBoss: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireRateMs: number;
  alive: boolean;
  hurtMs: number;
  frozenMs: number;
  touchCdMs: number;
  shootCdMs: number;
  strafePhase: number;
}

export interface GameSnapshot {
  dungeonId: 1 | 2 | 3;
  dungeonName: string;
  room: 1 | 2 | 3;
  totalRooms: 3;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  playerMaxShield: number;
  enemiesRemaining: number;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  portalUnlocked: boolean;
  status: 'idle' | 'playing' | 'victory' | 'defeat';
  elapsedSec: number;
  hintText: string;
  inventory: InventoryState;
  mpMode: MultiplayerMode | 'solo';
  pvpScores: { p1: number; p2: number };
}

export interface InputState {
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  dashPressed: boolean;
}

interface EntityBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EngineCallbacks {
  onVictory: (dungeonId: number, elapsedSec: number) => void;
  onDamage: (hpRemaining: number) => void;
  onStateChange: (snapshot: GameSnapshot) => void;
  onLocalStateBroadcast?: (state: Omit<RemoteHeroState, 'attackFlashMs' | 'lastSeenMs' | 'name' | 'slot'>) => void;
  onLocalAttackBroadcast?: (data: { x: number; y: number; aimAngle: number; weaponId: WeaponId; armorId: ArmorId; room: number }) => void;
  onEnemyHitBroadcast?: (enemyId: string, damage: number) => void;
  onPvpHitBroadcast?: (damage: number, kx: number, ky: number) => void;
  onPvpLocalDefeated?: () => void;
  onRoomChangeBroadcast?: (dungeonId: 1 | 2 | 3, room: 1 | 2 | 3) => void;
}

export class DungeonGameEngine {
  public dungeon: DungeonDefinition = getDungeonById(1);
  public room: 1 | 2 | 3 = 1;
  public light: LightState = 'bright';
  public status: 'idle' | 'playing' | 'victory' | 'defeat' = 'playing';

  private mpMode: MultiplayerMode | 'solo' = 'solo';
  private localSlot: 1 | 2 = 1;
  private pvpScores = { p1: 0, p2: 0 };
  private remoteHero: RemoteHeroState | null = null;
  private lastNetSyncMs = 0;
  private pvpRespawnTimerMs = 0;

  private inventory: InventoryState = createInitialInventory();
  private openedChestRooms = new Set<number>();

  private player = {
    x: 64,
    y: 128,
    w: 20,
    h: 20,
    vx: 0,
    vy: 0,
    hp: 6,
    maxHp: 6,
    shield: 2,
    maxShield: 2,
    shieldRegenDelayMs: 0,
    shieldRegenTickMs: 0,
    aimAngle: 0,
    moving: false,
    invulnMs: 0,
    hurtMs: 0,
    dashMs: 0,
    dashCdMs: 0,
    dashMaxCdMs: 650,
    dashDirX: 1,
    dashDirY: 0,
    stepDustTimer: 0,
  };

  private enemies: ActiveEnemy[] = [];
  private attackTimerMs = 0;
  private attackDurationMs = 175;
  private attackCooldownMs = 0;
  private hitstopMs = 0;
  private shakeTimerMs = 0;
  private shakeIntensity = 0;
  private roomFlashAlpha = 0;
  private lightLerp = 0;

  private portalUnlocked = false;
  private startTimeMs = Date.now();
  private elapsedSec = 0;
  private animTime = 0;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private projectiles: Projectile[] = [];
  private dashGhosts: DashGhost[] = [];
  private ambientMotes: Array<{ x: number; y: number; speed: number; phase: number; size: number }> = [];

  // Cache offscreen para o mapa estatico (1 drawImage por frame -> 60fps liso no Android!)
  private roomLayerCanvas: HTMLCanvasElement | null = null;
  private roomLayerDirty = true;
  private lightCanvas: HTMLCanvasElement | null = null;
  private lightCtx: CanvasRenderingContext2D | null = null;
  private hintText = 'Sala 1/3: Derrote os guardas e abra o baú dourado!';

  constructor(private readonly callbacks: EngineCallbacks) {
    for (let i = 0; i < 14; i++) {
      this.ambientMotes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 8 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() > 0.65 ? 3 : 2,
      });
    }
    this.syncGearStats(true);
    this.loadDungeon(1, 'bright', false);
  }

  setLightState(light: LightState): void {
    this.light = light;
  }

  setMultiplayerSession(mode: MultiplayerMode | 'solo', slot: 1 | 2, dungeonId?: 1 | 2 | 3, scores?: { p1: number; p2: number }): void {
    this.mpMode = mode;
    this.localSlot = slot;
    if (scores) this.pvpScores = { ...scores };
    if (mode === 'solo') {
      this.remoteHero = null;
    }
    this.loadDungeon(dungeonId ?? this.dungeon.id, this.light, true);
  }

  updatePvpScores(winnerSlot: 1 | 2, scores: { p1: number; p2: number }): void {
    this.pvpScores = { ...scores };
    const iWon = winnerSlot === this.localSlot;
    this.spawnFloatingText(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 - 20,
      iWon ? 'VITÓRIA NO X1!' : 'VOCÊ CAIU NO X1!',
      iWon ? '#63e6be' : '#ff6b6b',
    );
    this.pvpRespawnTimerMs = 1800;
    this.emitSnapshot();
  }

  clearRemoteHero(): void {
    this.remoteHero = null;
  }

  updateRemoteHero(patch: Partial<RemoteHeroState>, peerName = 'Aliado', peerSlot: 1 | 2 = 2): void {
    if (!this.remoteHero) {
      this.remoteHero = {
        x: Number(patch.x ?? 96),
        y: Number(patch.y ?? 128),
        aimAngle: Number(patch.aimAngle ?? 0),
        moving: Boolean(patch.moving),
        dashActive: Boolean(patch.dashActive),
        hp: Number(patch.hp ?? 6),
        maxHp: Number(patch.maxHp ?? 6),
        shield: Number(patch.shield ?? 2),
        maxShield: Number(patch.maxShield ?? 2),
        weaponId: (patch.weaponId as WeaponId) || 'rune_sword',
        armorId: (patch.armorId as ArmorId) || 'iron_mail',
        room: ([1, 2, 3].includes(Number(patch.room)) ? Number(patch.room) : 1) as 1 | 2 | 3,
        name: peerName,
        slot: peerSlot,
        attackFlashMs: 0,
        lastSeenMs: Date.now(),
      };
    } else {
      Object.assign(this.remoteHero, patch, { name: peerName, slot: peerSlot, lastSeenMs: Date.now() });
    }
  }

  receiveRemoteAttack(data: { x: number; y: number; aimAngle: number; weaponId: WeaponId; armorId: ArmorId; room: number }): void {
    if (this.mpMode === 'coop' && data.room !== this.room) return;
    if (this.remoteHero) {
      this.remoteHero.attackFlashMs = 175;
    }
    const weapon = WEAPONS[data.weaponId] || WEAPONS.rune_sword;
    const armor = ARMORS[data.armorId] || ARMORS.iron_mail;
    const count = weapon.projCount;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * weapon.spreadRad;
      const ang = data.aimAngle + offset;
      this.projectiles.push({
        owner: 'remote',
        x: data.x + 10 + Math.cos(ang) * 14,
        y: data.y + 10 + Math.sin(ang) * 14,
        vx: Math.cos(ang) * weapon.projSpeed,
        vy: Math.sin(ang) * weapon.projSpeed,
        radius: weapon.id === 'flame_staff' ? 6 : 4.6,
        color: this.mpMode === 'pvp' ? '#ff8787' : weapon.color,
        coreColor: '#ffffff',
        damage: weapon.projDamage + armor.bonusDamage,
        life: 0.9,
      });
    }
  }

  applyRemoteEnemyHit(enemyId: string, damage: number): void {
    const target = this.enemies.find((e) => e.id === enemyId && e.alive);
    if (!target) return;
    this.damageEnemy(target, damage, 0, 0, false, false);
  }

  applyPvpHitReceived(damage: number, kx: number, ky: number): void {
    if (this.mpMode !== 'pvp') return;
    this.moveWithSlide(this.player, kx, ky);
    this.damagePlayer(damage);
  }

  syncToRoomFromPeer(dungeonId: 1 | 2 | 3, room: 1 | 2 | 3): void {
    if (this.mpMode !== 'coop') return;
    if (dungeonId !== this.dungeon.id) {
      this.loadDungeon(dungeonId, this.light, true);
    }
    if (room !== this.room) {
      this.setupRoom(room);
      this.emitSnapshot();
    }
  }

  private syncGearStats(refillShield = false): void {
    const armor = ARMORS[this.inventory.equippedArmor];
    this.player.maxShield = armor.maxShield;
    this.player.dashMaxCdMs = armor.dashCdMs;
    if (refillShield) {
      this.player.shield = armor.maxShield;
    } else {
      this.player.shield = Math.min(this.player.shield, armor.maxShield);
    }
  }

  buyOrEquipWeapon(id: WeaponId): { ok: boolean; msg: string } {
    const def = WEAPONS[id];
    if (this.inventory.unlockedWeapons.includes(id)) {
      this.inventory.equippedWeapon = id;
      soundEngine.equip();
      this.spawnFloatingText(this.player.x + 10, this.player.y - 10, `${def.name}!`, def.color);
      this.emitSnapshot();
      return { ok: true, msg: `${def.name} equipada!` };
    }
    if (this.inventory.gold < def.cost) {
      return { ok: false, msg: `Ouro insuficiente (precisa de ${def.cost}).` };
    }
    this.inventory.gold -= def.cost;
    this.inventory.unlockedWeapons = [...this.inventory.unlockedWeapons, id];
    this.inventory.equippedWeapon = id;
    soundEngine.chestOpen();
    this.emitSnapshot();
    return { ok: true, msg: `${def.name} forjada e equipada!` };
  }

  buyOrEquipArmor(id: ArmorId): { ok: boolean; msg: string } {
    const def = ARMORS[id];
    if (this.inventory.unlockedArmors.includes(id)) {
      this.inventory.equippedArmor = id;
      this.syncGearStats(true);
      soundEngine.equip();
      this.emitSnapshot();
      return { ok: true, msg: `${def.name} equipada!` };
    }
    if (this.inventory.gold < def.cost) {
      return { ok: false, msg: `Ouro insuficiente (precisa de ${def.cost}).` };
    }
    this.inventory.gold -= def.cost;
    this.inventory.unlockedArmors = [...this.inventory.unlockedArmors, id];
    this.inventory.equippedArmor = id;
    this.syncGearStats(true);
    soundEngine.chestOpen();
    this.emitSnapshot();
    return { ok: true, msg: `${def.name} forjada e equipada!` };
  }

  buyOrEquipRelic(id: RelicId): { ok: boolean; msg: string } {
    const def = RELICS[id];
    if (this.inventory.unlockedRelics.includes(id)) {
      this.inventory.equippedRelic = id;
      soundEngine.equip();
      this.emitSnapshot();
      return { ok: true, msg: `${def.name} equipada!` };
    }
    if (this.inventory.gold < def.cost) {
      return { ok: false, msg: `Ouro insuficiente (precisa de ${def.cost}).` };
    }
    this.inventory.gold -= def.cost;
    this.inventory.unlockedRelics = [...this.inventory.unlockedRelics, id];
    this.inventory.equippedRelic = id;
    soundEngine.chestOpen();
    this.emitSnapshot();
    return { ok: true, msg: `${def.name} obtida e equipada!` };
  }

  buyPotion(): { ok: boolean; msg: string } {
    const cost = 12;
    if (this.inventory.gold < cost) {
      return { ok: false, msg: `Ouro insuficiente (poção custa ${cost}).` };
    }
    this.inventory.gold -= cost;
    this.inventory.potions += 1;
    soundEngine.equip();
    this.emitSnapshot();
    return { ok: true, msg: '+1 Poção de Vida comprada!' };
  }

  usePotion(): boolean {
    if (this.status !== 'playing' || this.inventory.potions <= 0 || this.player.hp >= this.player.maxHp) {
      return false;
    }
    this.inventory.potions -= 1;
    const healed = Math.min(2, this.player.maxHp - this.player.hp);
    this.player.hp += healed;
    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    this.spawnBurst(pCx, pCy, '#51cf66', 12, 95);
    this.spawnFloatingText(pCx, pCy - 14, `+${healed} HP`, '#69db7c');
    soundEngine.heal();
    this.emitSnapshot();
    return true;
  }

  loadDungeon(dungeonId: number, light: LightState, playChime = true): void {
    this.dungeon = getDungeonById(dungeonId);
    this.light = light;
    this.lightLerp = light === 'dark' ? 1 : 0;
    this.room = 1;
    this.status = 'playing';
    this.openedChestRooms.clear();
    this.player.hp = this.player.maxHp;
    this.syncGearStats(true);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invulnMs = 0;
    this.player.hurtMs = 0;
    this.player.dashMs = 0;
    this.player.dashCdMs = 0;
    this.player.aimAngle = this.localSlot === 2 && this.mpMode === 'pvp' ? Math.PI : 0;
    this.attackTimerMs = 0;
    this.attackCooldownMs = 0;
    this.hitstopMs = 0;
    this.shakeTimerMs = 0;
    this.pvpRespawnTimerMs = 0;
    this.roomFlashAlpha = 0.35;
    this.portalUnlocked = false;
    this.particles = [];
    this.floatingTexts = [];
    this.projectiles = [];
    this.dashGhosts = [];
    this.startTimeMs = Date.now();
    this.elapsedSec = 0;
    this.setupRoom(1);
    if (playChime) {
      soundEngine.dungeonLoaded();
    }
    this.emitSnapshot();
  }

  retryCurrentDungeon(): void {
    this.loadDungeon(this.dungeon.id, this.light, true);
  }

  getSnapshot(): GameSnapshot {
    const boss = this.enemies.find((e) => e.isBoss);
    const aliveCount = this.enemies.filter((e) => e.alive).length;
    return {
      dungeonId: this.dungeon.id,
      dungeonName: this.dungeon.name,
      room: this.room,
      totalRooms: 3,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      playerShield: this.player.shield,
      playerMaxShield: this.player.maxShield,
      enemiesRemaining: aliveCount,
      bossName: boss ? boss.name : this.dungeon.bossName,
      bossHp: boss && boss.alive ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : this.dungeon.bossMaxHp,
      portalUnlocked: this.portalUnlocked,
      status: this.status,
      elapsedSec: this.elapsedSec,
      hintText: this.hintText,
      inventory: {
        ...this.inventory,
        unlockedWeapons: [...this.inventory.unlockedWeapons],
        unlockedArmors: [...this.inventory.unlockedArmors],
        unlockedRelics: [...this.inventory.unlockedRelics],
      },
      mpMode: this.mpMode,
      pvpScores: { ...this.pvpScores },
    };
  }

  private getCurrentMap(): string[] {
    if (this.mpMode === 'pvp') return this.dungeon.pvpArena;
    return this.dungeon.rooms[this.room - 1];
  }

  private setupRoom(room: 1 | 2 | 3): void {
    this.room = room;
    this.projectiles = [];
    this.dashGhosts = [];
    this.enemies = [];
    this.roomFlashAlpha = 0.32;
    this.roomLayerDirty = true;

    const map = this.getCurrentMap();
    const spawnChar = this.localSlot === 2 && this.mpMode !== 'solo' ? 'Q' : 'P';
    let minionIdx = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        if (ch === spawnChar) {
          this.player.x = c * TILE_SIZE + 6;
          this.player.y = r * TILE_SIZE + 6;
        } else if (this.mpMode !== 'pvp' && ch === 'm') {
          minionIdx += 1;
          this.enemies.push({
            id: `r${room}_m${minionIdx}`,
            kind: this.dungeon.minionKind,
            name: this.dungeon.minionName,
            isBoss: false,
            x: c * TILE_SIZE + 6,
            y: r * TILE_SIZE + 6,
            w: 20,
            h: 20,
            hp: this.dungeon.minionMaxHp,
            maxHp: this.dungeon.minionMaxHp,
            speed: this.dungeon.enemySpeed * 0.92,
            fireRateMs: this.dungeon.enemyFireRateMs + 450 + minionIdx * 180,
            alive: true,
            hurtMs: 0,
            frozenMs: 0,
            touchCdMs: 500,
            shootCdMs: 900 + minionIdx * 350,
            strafePhase: minionIdx * 1.3,
          });
        } else if (this.mpMode !== 'pvp' && ch === 'E') {
          this.enemies.push({
            id: `r${room}_boss`,
            kind: this.dungeon.bossKind,
            name: this.dungeon.bossName,
            isBoss: true,
            x: c * TILE_SIZE + 4,
            y: r * TILE_SIZE + 4,
            w: 24,
            h: 24,
            hp: this.dungeon.bossMaxHp,
            maxHp: this.dungeon.bossMaxHp,
            speed: this.dungeon.enemySpeed,
            fireRateMs: this.dungeon.enemyFireRateMs,
            alive: true,
            hurtMs: 0,
            frozenMs: 0,
            touchCdMs: 500,
            shootCdMs: 1100,
            strafePhase: 0,
          });
        }
      }
    }

    this.portalUnlocked = false;
    if (this.mpMode === 'pvp') {
      this.hintText = `ARENA X1 · Placar P1 ${this.pvpScores.p1} × ${this.pvpScores.p2} P2 · Derrote seu oponente!`;
    } else if (room === 1) {
      this.hintText = `Sala 1/3: Derrote os ${this.dungeon.minionName}s e abra o baú dourado!`;
    } else if (room === 2) {
      this.hintText = `Sala 2/3: Limpe a emboscada para avançar ao Chefe!`;
    } else {
      this.hintText = `Sala 3/3: Derrote ${this.dungeon.bossName} para abrir o Portal!`;
    }
  }

  private bakeStaticRoomLayer(): void {
    if (!this.roomLayerCanvas) {
      this.roomLayerCanvas = document.createElement('canvas');
      this.roomLayerCanvas.width = CANVAS_WIDTH;
      this.roomLayerCanvas.height = CANVAS_HEIGHT;
    }
    const rctx = this.roomLayerCanvas.getContext('2d')!;
    rctx.imageSmoothingEnabled = false;

    const pal = BIOME_PALETTES[this.dungeon.biome];
    const tiles = getBiomeTileset(this.dungeon.biome);
    const map = this.getCurrentMap();

    rctx.fillStyle = pal.bg;
    rctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (ch === '#') {
          rctx.drawImage(tiles.wall, x, y);
        } else {
          if (ch === ',') {
            rctx.drawImage(tiles.carpet, x, y);
          } else {
            const hash = (r * 31 + c * 17 + this.dungeon.id * 7) % 11;
            const variant = hash === 0 ? 1 : hash === 3 ? 2 : hash === 6 ? 3 : (r + c) % 2;
            rctx.drawImage(tiles.floors[variant], x, y);
          }
          if (r > 0 && map[r - 1][c] === '#') {
            rctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            rctx.fillRect(x, y, TILE_SIZE, 6);
          }
          if (ch === 'T') {
            rctx.drawImage(tiles.prop, x, y);
          }
        }
      }
    }
    this.roomLayerDirty = false;
  }

  private isSolidTile(col: number, row: number): boolean {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
    const ch = this.getCurrentMap()[row][col];
    return ch === '#' || ch === 'T' || ch === 'B';
  }

  private collidesWithMap(x: number, y: number, w: number, h: number): boolean {
    const left = Math.floor(x / TILE_SIZE);
    const right = Math.floor((x + w - 1) / TILE_SIZE);
    const top = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + h - 1) / TILE_SIZE);
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (this.isSolidTile(c, r)) return true;
      }
    }
    return false;
  }

  private moveWithSlide(box: EntityBox, dx: number, dy: number): void {
    if (this.collidesWithMap(box.x, box.y, box.w, box.h)) {
      const baseC = Math.max(1, Math.min(GRID_COLS - 2, Math.floor((box.x + box.w / 2) / TILE_SIZE)));
      const baseR = Math.max(1, Math.min(GRID_ROWS - 2, Math.floor((box.y + box.h / 2) / TILE_SIZE)));
      for (let rad = 0; rad <= 3; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            const tx = (baseC + dc) * TILE_SIZE + 6;
            const ty = (baseR + dr) * TILE_SIZE + 6;
            if (!this.collidesWithMap(tx, ty, box.w, box.h)) {
              box.x = tx;
              box.y = ty;
              rad = 99;
              dr = 99;
              break;
            }
          }
        }
      }
    }

    if (dx !== 0) {
      const nx = box.x + dx;
      if (!this.collidesWithMap(nx, box.y, box.w, box.h)) {
        box.x = nx;
      } else {
        for (let nudge = 1; nudge <= 6; nudge++) {
          const step = Math.min(nudge, Math.abs(dx) * 0.85);
          if (!this.collidesWithMap(nx, box.y - nudge, box.w, box.h) && !this.collidesWithMap(box.x, box.y - step, box.w, box.h)) {
            box.y -= step;
            break;
          }
          if (!this.collidesWithMap(nx, box.y + nudge, box.w, box.h) && !this.collidesWithMap(box.x, box.y + step, box.w, box.h)) {
            box.y += step;
            break;
          }
        }
      }
    }

    if (dy !== 0) {
      const ny = box.y + dy;
      if (!this.collidesWithMap(box.x, ny, box.w, box.h)) {
        box.y = ny;
      } else {
        for (let nudge = 1; nudge <= 6; nudge++) {
          const step = Math.min(nudge, Math.abs(dy) * 0.85);
          if (!this.collidesWithMap(box.x - nudge, ny, box.w, box.h) && !this.collidesWithMap(box.x - step, box.y, box.w, box.h)) {
            box.x -= step;
            break;
          }
          if (!this.collidesWithMap(box.x + nudge, ny, box.w, box.h) && !this.collidesWithMap(box.x + step, box.y, box.w, box.h)) {
            box.x += step;
            break;
          }
        }
      }
    }
  }

  private awardGold(base: number): number {
    const mult = this.inventory.equippedRelic === 'gold_charm' ? 1.5 : 1;
    const gain = Math.round(base * mult);
    this.inventory.gold += gain;
    return gain;
  }

  private openDungeonChest(cx: number, cy: number): void {
    this.openedChestRooms.add(this.room);
    soundEngine.chestOpen();
    this.spawnBurst(cx, cy, '#ffd43b', 16, 125);
    this.addShake(3, 90);

    const goldGain = this.awardGold(14 + this.dungeon.id * 4);
    let rewardLabel = `+${goldGain} OURO!`;

    const poolWeapons: WeaponId[] = ['twin_daggers', 'frost_wand', 'flame_staff', 'thunder_spear', 'forge_axe'];
    const poolArmors: ArmorId[] = ['ranger_vest', 'shadow_cloak', 'frost_aegis', 'magma_plate'];
    const nextW = poolWeapons.find((w) => !this.inventory.unlockedWeapons.includes(w));
    const nextA = poolArmors.find((a) => !this.inventory.unlockedArmors.includes(a));

    if (this.room === 1 && nextW) {
      this.inventory.unlockedWeapons = [...this.inventory.unlockedWeapons, nextW];
      rewardLabel = `${WEAPONS[nextW].name.toUpperCase()}!`;
    } else if (this.room === 2 && nextA) {
      this.inventory.unlockedArmors = [...this.inventory.unlockedArmors, nextA];
      rewardLabel = `${ARMORS[nextA].name.toUpperCase()}!`;
    } else {
      this.inventory.potions += 1;
      rewardLabel = `+${goldGain} OURO + POÇÃO!`;
    }

    this.spawnFloatingText(cx, cy - 16, rewardLabel, '#ffd43b');
    this.hintText = `Tesouro: ${rewardLabel} Abra a Mochila para equipar!`;
    this.emitSnapshot();
  }

  private addShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimerMs = Math.max(this.shakeTimerMs, durationMs);
  }

  private spawnBurst(cx: number, cy: number, color: string, count = 8, speedMax = 105): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 26 + Math.random() * speedMax;
      const life = 0.22 + Math.random() * 0.22;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size: 2 + Math.floor(Math.random() * 2),
      });
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -34,
      text,
      color,
      life: 0.78,
      maxLife: 0.78,
    });
  }

  private damageEnemy(
    enemy: ActiveEnemy,
    amount: number,
    knockX: number,
    knockY: number,
    slow = false,
    broadcast = true,
  ): void {
    if (!enemy.alive) return;
    enemy.hp -= amount;
    enemy.hurtMs = 140;
    if (slow) enemy.frozenMs = 2400;
    this.moveWithSlide(enemy, knockX, knockY);

    const eCx = enemy.x + enemy.w / 2;
    const eCy = enemy.y + enemy.h / 2;
    this.spawnBurst(eCx, eCy, slow ? '#66d9e8' : this.dungeon.accentColor, 9, 110);
    this.spawnFloatingText(eCx, eCy - 14, `-${amount}`, slow ? '#66d9e8' : amount >= 3 ? '#ff922b' : '#ffd43b');
    this.addShake(amount >= 2 ? 4 : 2.2, 95);
    this.hitstopMs = amount >= 3 ? 24 : 12;
    soundEngine.hitEnemy();

    if (broadcast && this.mpMode === 'coop') {
      this.callbacks.onEnemyHitBroadcast?.(enemy.id, amount);
    }

    if (enemy.hp <= 0) {
      enemy.alive = false;
      const goldGain = this.awardGold(enemy.isBoss ? 25 : 6);
      this.spawnBurst(eCx, eCy, '#ffd43b', enemy.isBoss ? 20 : 12, 130);
      this.spawnFloatingText(eCx, eCy - 16, `+${goldGain} OURO`, '#ffd43b');

      if (this.inventory.equippedRelic === 'vamp_ring' && this.player.hp < this.player.maxHp) {
        this.player.hp += 1;
        this.spawnFloatingText(this.player.x + 10, this.player.y - 12, '+1 HP', '#ff8787');
      }

      const remaining = this.enemies.filter((e) => e.alive).length;
      if (remaining === 0) {
        this.projectiles = this.projectiles.filter((p) => p.owner !== 'enemy');
        if (this.room === 3) {
          this.portalUnlocked = true;
          this.inventory.potions += 1;
          this.hintText = 'Sala limpa (+1 Poção)! Entre no Portal Rúnico à direita!';
          this.spawnFloatingText(eCx, eCy - 28, 'PORTAL ABERTO!', '#63e6be');
          soundEngine.portalUnlock();
        } else {
          this.hintText = `Sala ${this.room}/3 limpa! Avance pela Porta Dourada →`;
          this.spawnFloatingText(eCx, eCy - 24, 'PORTA ABERTA!', '#ffd43b');
          soundEngine.doorEnter();
        }
      }
    }
    this.emitSnapshot();
  }

  private damagePlayer(amount = 1): void {
    if (this.player.invulnMs > 0 || this.player.dashMs > 0 || this.status !== 'playing') return;
    this.player.invulnMs = this.mpMode === 'pvp' ? 520 : 880;
    this.player.hurtMs = 200;
    const isSwift = this.inventory.equippedRelic === 'swift_boots';
    this.player.shieldRegenDelayMs = isSwift ? 2200 : 4000;
    this.player.shieldRegenTickMs = 0;

    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;

    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, amount);
      this.player.shield -= absorbed;
      const leftover = amount - absorbed;
      this.spawnBurst(pCx, pCy, '#4dabf7', 10, 100);
      this.spawnFloatingText(pCx, pCy - 14, 'ESCUDO!', '#74c0fc');
      this.addShake(3.5, 110);
      soundEngine.parry();
      if (leftover > 0) this.player.hp -= leftover;
    } else {
      this.player.hp -= amount;
      this.spawnBurst(pCx, pCy, '#ff6b6b', 10, 105);
      this.spawnFloatingText(pCx, pCy - 14, `-${amount}`, '#ff6b6b');
      this.addShake(5, 145);
      soundEngine.hurtPlayer();
    }

    if (this.player.hp <= 0) {
      if (this.mpMode === 'pvp') {
        this.player.hp = 0;
        this.callbacks.onPvpLocalDefeated?.();
      } else {
        this.status = 'defeat';
        this.hintText = 'Você caiu na masmorra! Equipe itens na Mochila e tente de novo.';
      }
    } else {
      this.callbacks.onDamage(this.player.hp);
    }
    this.emitSnapshot();
  }

  triggerDash(dirX: number, dirY: number): void {
    if (this.status !== 'playing' || this.player.dashCdMs > 0 || this.player.dashMs > 0) return;
    const len = Math.hypot(dirX, dirY);
    if (len > 0.1) {
      this.player.dashDirX = dirX / len;
      this.player.dashDirY = dirY / len;
    } else {
      this.player.dashDirX = Math.cos(this.player.aimAngle);
      this.player.dashDirY = Math.sin(this.player.aimAngle);
    }
    this.player.dashMs = 155;
    this.player.dashCdMs = this.player.dashMaxCdMs;
    this.player.invulnMs = Math.max(this.player.invulnMs, 210);
    this.spawnBurst(this.player.x + 10, this.player.y + 18, '#74c0fc', 7, 70);
    soundEngine.dash();
  }

  triggerAttack(): void {
    if (this.status !== 'playing' || this.attackCooldownMs > 0) return;
    const weapon = WEAPONS[this.inventory.equippedWeapon];
    const armor = ARMORS[this.inventory.equippedArmor];

    this.attackTimerMs = this.attackDurationMs;
    this.attackCooldownMs = weapon.cooldownMs;
    soundEngine.slash();

    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    const ax = Math.cos(this.player.aimAngle);
    const ay = Math.sin(this.player.aimAngle);

    if (this.mpMode !== 'solo') {
      this.callbacks.onLocalAttackBroadcast?.({
        x: this.player.x,
        y: this.player.y,
        aimAngle: this.player.aimAngle,
        weaponId: weapon.id,
        armorId: armor.id,
        room: this.room,
      });
    }

    const count = weapon.projCount;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * weapon.spreadRad;
      const ang = this.player.aimAngle + offset;
      this.projectiles.push({
        owner: 'player',
        x: pCx + Math.cos(ang) * 14,
        y: pCy + Math.sin(ang) * 14,
        vx: Math.cos(ang) * weapon.projSpeed,
        vy: Math.sin(ang) * weapon.projSpeed,
        radius: weapon.id === 'flame_staff' ? 6.5 : 4.6,
        color: weapon.color,
        coreColor: weapon.coreColor,
        damage: weapon.projDamage + armor.bonusDamage,
        life: weapon.id === 'elf_bow' || weapon.id === 'thunder_spear' ? 1.15 : 0.78,
        slowsEnemy: weapon.slowsEnemy,
        piercing: weapon.piercing,
        hitIds: weapon.piercing ? new Set<string>() : undefined,
      });
    }

    // Rebate tiros inimigos/oponente
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.owner === 'player') continue;
      if (this.mpMode === 'coop' && proj.owner === 'remote') continue;
      const d = Math.hypot(proj.x - (pCx + ax * 16), proj.y - (pCy + ay * 16));
      if (d <= weapon.parryRadius) {
        this.spawnBurst(proj.x, proj.y, '#ffd43b', 6, 85);
        this.spawnFloatingText(proj.x, proj.y - 10, 'DEFESA!', '#ffd43b');
        this.projectiles.splice(i, 1);
        soundEngine.parry();
      }
    }

    // Dano corpo a corpo em todos inimigos no alcance
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const eCx = enemy.x + enemy.w / 2;
      const eCy = enemy.y + enemy.h / 2;
      const dist = Math.hypot(eCx - pCx, eCy - pCy);
      if (dist <= weapon.meleeRange) {
        const nx = dist > 0.1 ? (eCx - pCx) / dist : ax;
        const ny = dist > 0.1 ? (eCy - pCy) / dist : ay;
        this.damageEnemy(enemy, weapon.meleeDamage + armor.bonusDamage, nx * 14, ny * 14, Boolean(weapon.slowsEnemy), true);
      }
    }

    // Dano corpo a corpo PvP (X1)
    if (this.mpMode === 'pvp' && this.remoteHero) {
      const rCx = this.remoteHero.x + 10;
      const rCy = this.remoteHero.y + 10;
      const dist = Math.hypot(rCx - pCx, rCy - pCy);
      if (dist <= weapon.meleeRange) {
        const nx = dist > 0.1 ? (rCx - pCx) / dist : ax;
        const ny = dist > 0.1 ? (rCy - pCy) / dist : ay;
        const dmg = weapon.meleeDamage + armor.bonusDamage;
        this.spawnBurst(rCx, rCy, weapon.color, 10, 110);
        this.spawnFloatingText(rCx, rCy - 14, `-${dmg}`, '#ffd43b');
        this.callbacks.onPvpHitBroadcast?.(dmg, nx * 16, ny * 16);
      }
    }
  }

  private fireEnemyPattern(enemy: ActiveEnemy): void {
    const eCx = enemy.x + enemy.w / 2;
    const eCy = enemy.y + enemy.h / 2;
    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    const baseAngle = Math.atan2(pCy - eCy, pCx - eCx);

    soundEngine.enemyShoot();

    if (!enemy.isBoss) {
      const color = enemy.kind === 'goblin' ? '#8ce99a' : enemy.kind === 'bat' ? '#b197fc' : '#ff922b';
      this.projectiles.push({
        owner: 'enemy',
        x: eCx,
        y: eCy,
        vx: Math.cos(baseAngle) * 130,
        vy: Math.sin(baseAngle) * 130,
        radius: 4.5,
        color,
        coreColor: '#ffffff',
        damage: 1,
        life: 2.0,
      });
      return;
    }

    if (enemy.kind === 'slime') {
      [-0.22, 0.22].forEach((off) => {
        const a = baseAngle + off;
        this.projectiles.push({
          owner: 'enemy',
          x: eCx,
          y: eCy,
          vx: Math.cos(a) * 140,
          vy: Math.sin(a) * 140,
          radius: 5.5,
          color: '#20c997',
          coreColor: '#c3fae8',
          damage: 1,
          life: 2.4,
        });
      });
    } else if (enemy.kind === 'skeleton') {
      [-0.2, 0, 0.2].forEach((off) => {
        const a = baseAngle + off;
        this.projectiles.push({
          owner: 'enemy',
          x: eCx,
          y: eCy,
          vx: Math.cos(a) * 155,
          vy: Math.sin(a) * 155,
          radius: 5,
          color: '#cc5de8',
          coreColor: '#f8f0fc',
          damage: 1,
          life: 2.2,
        });
      });
    } else {
      [-0.36, -0.12, 0.12, 0.36].forEach((off) => {
        const a = baseAngle + off;
        this.projectiles.push({
          owner: 'enemy',
          x: eCx,
          y: eCy,
          vx: Math.cos(a) * 165,
          vy: Math.sin(a) * 165,
          radius: 5.2,
          color: '#ff6b6b',
          coreColor: '#fff3bf',
          damage: 1,
          life: 2.1,
        });
      });
    }
  }

  update(dtSec: number, input: InputState): void {
    const dt = Math.min(0.045, Math.max(0.001, dtSec));
    this.animTime += dt;

    const targetLight = this.light === 'dark' ? 1 : 0;
    this.lightLerp += (targetLight - this.lightLerp) * Math.min(1, dt * 6.5);

    if (this.roomFlashAlpha > 0) this.roomFlashAlpha = Math.max(0, this.roomFlashAlpha - dt * 1.6);
    if (this.remoteHero && this.remoteHero.attackFlashMs > 0) {
      this.remoteHero.attackFlashMs = Math.max(0, this.remoteHero.attackFlashMs - dt * 1000);
    }

    // Respawn automatico de rodada no X1 PvP
    if (this.pvpRespawnTimerMs > 0) {
      this.pvpRespawnTimerMs = Math.max(0, this.pvpRespawnTimerMs - dt * 1000);
      if (this.pvpRespawnTimerMs === 0 && this.mpMode === 'pvp') {
        this.loadDungeon(this.dungeon.id, this.light, true);
      }
      return;
    }

    for (const m of this.ambientMotes) {
      m.y -= m.speed * dt;
      m.x += Math.sin(this.animTime * 1.8 + m.phase) * 7 * dt;
      if (m.y < 16) {
        m.y = CANVAS_HEIGHT - 16;
        m.x = 24 + Math.random() * (CANVAS_WIDTH - 48);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }

    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      this.dashGhosts[i].alpha -= dt * 4.8;
      if (this.dashGhosts[i].alpha <= 0) this.dashGhosts.splice(i, 1);
    }

    if (this.shakeTimerMs > 0) {
      this.shakeTimerMs = Math.max(0, this.shakeTimerMs - dt * 1000);
      if (this.shakeTimerMs === 0) this.shakeIntensity = 0;
    }

    if (this.status !== 'playing') return;

    if (this.hitstopMs > 0) {
      this.hitstopMs = Math.max(0, this.hitstopMs - dt * 1000);
      return;
    }

    this.elapsedSec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    if (this.player.invulnMs > 0) this.player.invulnMs = Math.max(0, this.player.invulnMs - dt * 1000);
    if (this.player.hurtMs > 0) this.player.hurtMs = Math.max(0, this.player.hurtMs - dt * 1000);
    if (this.player.dashCdMs > 0) this.player.dashCdMs = Math.max(0, this.player.dashCdMs - dt * 1000);
    if (this.attackTimerMs > 0) this.attackTimerMs = Math.max(0, this.attackTimerMs - dt * 1000);
    if (this.attackCooldownMs > 0) this.attackCooldownMs = Math.max(0, this.attackCooldownMs - dt * 1000);

    // Regeneracao automatica de Escudo
    if (this.player.shield < this.player.maxShield) {
      if (this.player.shieldRegenDelayMs > 0) {
        this.player.shieldRegenDelayMs = Math.max(0, this.player.shieldRegenDelayMs - dt * 1000);
      } else {
        const regenStep = this.inventory.equippedRelic === 'swift_boots' ? 750 : 1300;
        this.player.shieldRegenTickMs += dt * 1000;
        if (this.player.shieldRegenTickMs >= regenStep) {
          this.player.shieldRegenTickMs = 0;
          this.player.shield += 1;
          this.spawnFloatingText(this.player.x + 10, this.player.y - 10, '+1 ESCUDO', '#74c0fc');
          this.emitSnapshot();
        }
      }
    }

    let ix = input.moveX;
    let iy = input.moveY;
    const ilen = Math.hypot(ix, iy);
    if (ilen > 1) {
      ix /= ilen;
      iy /= ilen;
    }

    if (input.dashPressed) {
      this.triggerDash(ix, iy);
    }

    const armor = ARMORS[this.inventory.equippedArmor];
    const relicSpd = this.inventory.equippedRelic === 'swift_boots' ? 1.16 : 1.0;

    if (this.player.dashMs > 0) {
      this.player.dashMs = Math.max(0, this.player.dashMs - dt * 1000);
      this.player.vx = this.player.dashDirX * 340;
      this.player.vy = this.player.dashDirY * 340;
      this.player.moving = true;
      if (Math.random() < 0.65) {
        this.dashGhosts.push({ x: this.player.x, y: this.player.y, aimAngle: this.player.aimAngle, alpha: 0.48 });
      }
    } else {
      const maxSpd = 154 * armor.speedMult * relicSpd;
      const accel = Math.min(1, dt * 15);
      this.player.vx += (ix * maxSpd - this.player.vx) * accel;
      this.player.vy += (iy * maxSpd - this.player.vy) * accel;
      if (Math.abs(this.player.vx) < 2) this.player.vx = 0;
      if (Math.abs(this.player.vy) < 2) this.player.vy = 0;
      this.player.moving = Math.hypot(this.player.vx, this.player.vy) > 12;
    }

    this.moveWithSlide(this.player, this.player.vx * dt, this.player.vy * dt);

    // Mira inteligente: trava no oponente (X1) ou no inimigo mais proximo (Solo/Co-op)
    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    if (this.mpMode === 'pvp' && this.remoteHero) {
      this.player.aimAngle = Math.atan2(this.remoteHero.y + 10 - pCy, this.remoteHero.x + 10 - pCx);
    } else {
      let nearest: ActiveEnemy | null = null;
      let bestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x + e.w / 2 - pCx, e.y + e.h / 2 - pCy);
        if (d < bestDist) {
          bestDist = d;
          nearest = e;
        }
      }
      if (nearest && bestDist < 240) {
        this.player.aimAngle = Math.atan2(nearest.y + nearest.h / 2 - pCy, nearest.x + nearest.w / 2 - pCx);
      } else if (ilen > 0.15) {
        this.player.aimAngle = Math.atan2(iy, ix);
      }
    }

    if (input.attackPressed) {
      this.triggerAttack();
    }

    // IA de todos os inimigos da sala (intermediarios + chefe)
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.hurtMs > 0) enemy.hurtMs = Math.max(0, enemy.hurtMs - dt * 1000);
      if (enemy.frozenMs > 0) enemy.frozenMs = Math.max(0, enemy.frozenMs - dt * 1000);
      if (enemy.touchCdMs > 0) enemy.touchCdMs = Math.max(0, enemy.touchCdMs - dt * 1000);

      const eCx = enemy.x + enemy.w / 2;
      const eCy = enemy.y + enemy.h / 2;
      const dx = pCx - eCx;
      const dy = pCy - eCy;
      const dist = Math.hypot(dx, dy);
      const speedFactor = enemy.frozenMs > 0 ? 0.45 : 1.0;

      enemy.strafePhase += dt * (enemy.isBoss ? 1.9 : 2.5);
      if (dist > 8) {
        const approach = dist > 95 ? 1 : dist < 52 ? -0.35 : 0.25;
        const strafe = Math.sin(enemy.strafePhase) * 0.6;
        const nx = dx / dist;
        const ny = dy / dist;
        const vx = (nx * approach - ny * strafe) * enemy.speed * speedFactor;
        const vy = (ny * approach + nx * strafe) * enemy.speed * speedFactor;
        this.moveWithSlide(enemy, vx * dt, vy * dt);
      }

      if (dist < (enemy.isBoss ? 24 : 20) && enemy.touchCdMs <= 0) {
        enemy.touchCdMs = 750;
        this.damagePlayer(1);
      }

      enemy.shootCdMs -= dt * 1000 * speedFactor;
      if (enemy.shootCdMs <= 0) {
        enemy.shootCdMs = enemy.fireRateMs;
        this.fireEnemyPattern(enemy);
      }
    }

    // Atualiza projeteis
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      const col = Math.floor(pr.x / TILE_SIZE);
      const row = Math.floor(pr.y / TILE_SIZE);
      if (pr.life <= 0 || this.isSolidTile(col, row)) {
        this.spawnBurst(pr.x, pr.y, pr.color, 4, 60);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.owner === 'player') {
        let consumed = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (pr.hitIds?.has(enemy.id)) continue;
          const eCx = enemy.x + enemy.w / 2;
          const eCy = enemy.y + enemy.h / 2;
          if (Math.hypot(pr.x - eCx, pr.y - eCy) <= pr.radius + (enemy.isBoss ? 14 : 11)) {
            const sp = Math.hypot(pr.vx, pr.vy) || 1;
            this.damageEnemy(enemy, pr.damage, (pr.vx / sp) * 7, (pr.vy / sp) * 7, Boolean(pr.slowsEnemy), true);
            if (pr.piercing && pr.hitIds) {
              pr.hitIds.add(enemy.id);
            } else {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
          continue;
        }
        if (this.mpMode === 'pvp' && this.remoteHero) {
          const rCx = this.remoteHero.x + 10;
          const rCy = this.remoteHero.y + 10;
          if (Math.hypot(pr.x - rCx, pr.y - rCy) <= pr.radius + 11) {
            const sp = Math.hypot(pr.vx, pr.vy) || 1;
            this.spawnBurst(pr.x, pr.y, pr.color, 7, 90);
            this.spawnFloatingText(rCx, rCy - 14, `-${pr.damage}`, '#ffd43b');
            this.callbacks.onPvpHitBroadcast?.(pr.damage, (pr.vx / sp) * 10, (pr.vy / sp) * 10);
            this.projectiles.splice(i, 1);
            continue;
          }
        }
      } else if (pr.owner === 'enemy') {
        if (Math.hypot(pr.x - pCx, pr.y - pCy) <= pr.radius + 10) {
          this.damagePlayer(pr.damage);
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    // Checa bau ('C'), porta ('D') e portal ('O')
    if (this.mpMode !== 'pvp') {
      const centerCol = Math.floor(pCx / TILE_SIZE);
      const centerRow = Math.floor(pCy / TILE_SIZE);
      const tile = this.getCurrentMap()[centerRow]?.[centerCol];
      const roomClear = this.enemies.every((e) => !e.alive);

      if (tile === 'C' && !this.openedChestRooms.has(this.room)) {
        this.openDungeonChest(centerCol * TILE_SIZE + 16, centerRow * TILE_SIZE + 16);
      } else if (tile === 'D' && roomClear && this.room < 3) {
        soundEngine.doorEnter();
        const nextRoom = (this.room + 1) as 1 | 2 | 3;
        this.setupRoom(nextRoom);
        if (this.mpMode === 'coop') {
          this.callbacks.onRoomChangeBroadcast?.(this.dungeon.id, nextRoom);
        }
        this.emitSnapshot();
      } else if (this.room === 3 && tile === 'O' && this.portalUnlocked) {
        this.status = 'victory';
        this.hintText = `Vitória em ${this.elapsedSec}s! LED físico confirmando conclusão.`;
        soundEngine.victory();
        this.spawnBurst(pCx, pCy, '#63e6be', 22, 145);
        this.callbacks.onVictory(this.dungeon.id, this.elapsedSec);
        this.emitSnapshot();
      }
    }

    // Sincroniza posicao no Multiplayer (~20 Hz)
    if (this.mpMode !== 'solo' && this.callbacks.onLocalStateBroadcast) {
      const nowMs = performance.now();
      if (nowMs - this.lastNetSyncMs >= 50) {
        this.lastNetSyncMs = nowMs;
        this.callbacks.onLocalStateBroadcast({
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          aimAngle: Number(this.player.aimAngle.toFixed(2)),
          moving: this.player.moving,
          dashActive: this.player.dashMs > 0,
          hp: this.player.hp,
          maxHp: this.player.maxHp,
          shield: this.player.shield,
          maxShield: this.player.maxShield,
          weaponId: this.inventory.equippedWeapon,
          armorId: this.inventory.equippedArmor,
          room: this.room,
        });
      }
    }
  }

  private ensureLightCanvas(): CanvasRenderingContext2D {
    if (!this.lightCanvas) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = CANVAS_WIDTH;
      this.lightCanvas.height = CANVAS_HEIGHT;
      this.lightCtx = this.lightCanvas.getContext('2d')!;
    }
    return this.lightCtx!;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.roomLayerDirty || !this.roomLayerCanvas) {
      this.bakeStaticRoomLayer();
    }
    const pal = BIOME_PALETTES[this.dungeon.biome];
    const map = this.getCurrentMap();
    const weapon = WEAPONS[this.inventory.equippedWeapon];
    const armor = ARMORS[this.inventory.equippedArmor];
    const roomClear = this.enemies.every((e) => !e.alive);

    ctx.save();
    if (this.shakeTimerMs > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    // 1. UNICO drawImage para todo o chao + paredes + pilares (zero engasgo no Android!)
    ctx.drawImage(this.roomLayerCanvas!, 0, 0);

    const lightSources: Array<{ x: number; y: number; r: number }> = [];

    // 2. Elementos dinamicos do mapa (braseiros, baus, portas e portal)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        if (ch !== 'B' && ch !== 'C' && ch !== 'D' && ch !== 'O') continue;
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        if (ch === 'B') {
          drawBrazier(ctx, x, y, pal, this.animTime);
          lightSources.push({ x: x + 16, y: y + 12, r: 66 });
        } else if (ch === 'C') {
          const opened = this.openedChestRooms.has(this.room);
          drawChestTile(ctx, x, y, opened, this.animTime);
          if (!opened) lightSources.push({ x: x + 16, y: y + 16, r: 52 });
        } else if (ch === 'D') {
          drawDoorTile(ctx, x, y, this.animTime, roomClear);
          if (roomClear) lightSources.push({ x: x + 16, y: y + 16, r: 58 });
        } else if (ch === 'O') {
          drawPortalTile(ctx, x, y, pal, this.portalUnlocked, this.animTime);
          if (this.portalUnlocked) lightSources.push({ x: x + 16, y: y + 16, r: 84 });
        }
      }
    }

    ctx.fillStyle = this.dungeon.biome === 'forge' ? 'rgba(255, 146, 43, 0.42)' : 'rgba(225, 240, 255, 0.2)';
    for (const m of this.ambientMotes) {
      ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
    }

    for (const g of this.dashGhosts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, g.alpha);
      drawHero(ctx, g.x, g.y, g.aimAngle, true, false, true, 0, this.animTime, weapon.id, armor.tint, false);
      ctx.restore();
    }

    // 3. Inimigos (intermediarios + chefe)
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      drawEnemy(ctx, enemy.kind, enemy.x, enemy.y, enemy.hurtMs > 0, this.animTime, enemy.frozenMs > 0);
      lightSources.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, r: enemy.isBoss ? 44 : 28 });

      const bw = enemy.isBoss ? 32 : 22;
      const bx = Math.round(enemy.x + (enemy.w - bw) / 2);
      const by = Math.round(enemy.y - 10);
      ctx.fillStyle = '#12101a';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = enemy.isBoss ? '#fa5252' : '#ff922b';
      ctx.fillRect(bx, by, Math.round((bw * Math.max(0, enemy.hp)) / enemy.maxHp), 3);
    }

    // 4. Jogador Remoto (Multiplayer CO-OP ou X1!)
    if (this.remoteHero && (this.mpMode === 'pvp' || this.remoteHero.room === this.room)) {
      const rh = this.remoteHero;
      const rArmor = ARMORS[rh.armorId] || ARMORS.iron_mail;
      const rAtkProg = rh.attackFlashMs > 0 ? 1 - rh.attackFlashMs / 175 : 0;
      drawHero(ctx, rh.x, rh.y, rh.aimAngle, rh.moving, false, rh.dashActive, rAtkProg, this.animTime, rh.weaponId, rArmor.tint, true);
      lightSources.push({ x: rh.x + 10, y: rh.y + 10, r: 92 });

      // Nome + barra de HP do jogador remoto
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#12101a';
      ctx.fillText(rh.name, Math.round(rh.x + 10) + 1, Math.round(rh.y - 13) + 1);
      ctx.fillStyle = this.mpMode === 'pvp' ? '#ff8787' : '#63e6be';
      ctx.fillText(rh.name, Math.round(rh.x + 10), Math.round(rh.y - 13));
      ctx.fillStyle = '#12101a';
      ctx.fillRect(Math.round(rh.x - 3), Math.round(rh.y - 10), 26, 4);
      ctx.fillStyle = this.mpMode === 'pvp' ? '#fa5252' : '#38d9a9';
      ctx.fillRect(Math.round(rh.x - 2), Math.round(rh.y - 9), Math.round((24 * Math.max(0, rh.hp)) / Math.max(1, rh.maxHp)), 2);
    }

    // 5. Heroi local
    const blinkHide = this.player.invulnMs > 0 && this.player.dashMs <= 0 && Math.floor(this.player.invulnMs / 65) % 2 === 1;
    const attackProg = this.attackTimerMs > 0 ? 1 - this.attackTimerMs / this.attackDurationMs : 0;
    if (!blinkHide) {
      drawHero(
        ctx,
        this.player.x,
        this.player.y,
        this.player.aimAngle,
        this.player.moving,
        this.player.hurtMs > 0,
        this.player.dashMs > 0,
        attackProg,
        this.animTime,
        weapon.id,
        armor.tint,
        false,
      );
    }

    if (this.player.dashCdMs > 0) {
      const ratio = 1 - this.player.dashCdMs / this.player.dashMaxCdMs;
      ctx.fillStyle = 'rgba(18, 16, 26, 0.75)';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), 20, 3);
      ctx.fillStyle = '#66d9e8';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), Math.round(20 * ratio), 3);
    }

    if (this.attackTimerMs > 0 && weapon.id !== 'elf_bow' && weapon.id !== 'frost_wand') {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const alpha = this.attackTimerMs / this.attackDurationMs;
      const arcR = weapon.id === 'forge_axe' ? 32 : 25;
      ctx.save();
      ctx.translate(pCx, pCy);
      ctx.rotate(this.player.aimAngle);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = weapon.id === 'forge_axe' ? 12 : 8;
      ctx.beginPath();
      ctx.arc(4, 0, arcR, -1.0, 1.0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(6, 0, arcR, -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }

    for (const pr of this.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius + 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pr.coreColor;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, Math.max(1.5, pr.radius - 1), 0, Math.PI * 2);
      ctx.fill();
      lightSources.push({ x: pr.x, y: pr.y, r: 26 });
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Iluminacao dinamica ultra-leve no modo escuro
    if (this.lightLerp > 0.02) {
      const lctx = this.ensureLightCanvas();
      const hole = getLightHoleStamp();
      const heroCx = this.player.x + this.player.w / 2;
      const heroCy = this.player.y + this.player.h / 2;
      const heroR = (weapon.id === 'flame_staff' ? 138 : 114) + Math.sin(this.animTime * 10) * 3;

      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      lctx.fillStyle = `rgba(6, 7, 16, ${(0.84 * this.lightLerp).toFixed(3)})`;
      lctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      lctx.globalCompositeOperation = 'destination-out';
      lctx.drawImage(hole, heroCx - heroR, heroCy - heroR, heroR * 2, heroR * 2);
      for (const ls of lightSources) {
        lctx.drawImage(hole, ls.x - ls.r, ls.y - ls.r, ls.r * 2, ls.r * 2);
      }

      ctx.drawImage(this.lightCanvas!, 0, 0);
      const warm = getGlowStamp('rgba(255, 190, 92, 0.22)');
      ctx.save();
      ctx.globalAlpha = this.lightLerp;
      ctx.drawImage(warm, heroCx - heroR * 0.85, heroCy - heroR * 0.85, heroR * 1.7, heroR * 1.7);
      ctx.restore();
    }

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (const f of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = '#12101a';
      ctx.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.globalAlpha = 1;

    // Barra de Chefe na Sala 3
    const liveBoss = this.enemies.find((e) => e.isBoss && e.alive);
    if (liveBoss) {
      const barW = 196;
      const barX = (CANVAS_WIDTH - barW) / 2;
      const barY = CANVAS_HEIGHT - 22;
      ctx.fillStyle = 'rgba(12, 14, 24, 0.85)';
      ctx.fillRect(barX - 4, barY - 14, barW + 8, 22);
      ctx.strokeStyle = this.dungeon.accentColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX - 4, barY - 14, barW + 8, 22);
      ctx.fillStyle = '#edf2ff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(liveBoss.name.toUpperCase(), CANVAS_WIDTH / 2, barY - 4);
      ctx.fillStyle = '#2b2f3d';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(barX, barY, Math.round((barW * liveBoss.hp) / liveBoss.maxHp), 5);
    }

    if (this.roomFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.roomFlashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
  }

  private emitSnapshot(): void {
    this.callbacks.onStateChange(this.getSnapshot());
  }
}
