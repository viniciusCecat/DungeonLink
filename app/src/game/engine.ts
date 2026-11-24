import type { LightState } from '../ble/protocol';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  getDungeonById,
  type DungeonDefinition,
} from './dungeons';
import {
  ARMORS,
  WEAPONS,
  createInitialInventory,
  type ArmorId,
  type InventoryState,
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
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  coreColor: string;
  damage: number;
  life: number;
}

interface DashGhost {
  x: number;
  y: number;
  aimAngle: number;
  alpha: number;
}

export interface GameSnapshot {
  dungeonId: 1 | 2 | 3;
  dungeonName: string;
  room: 1 | 2;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  playerMaxShield: number;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  portalUnlocked: boolean;
  status: 'idle' | 'playing' | 'victory' | 'defeat';
  elapsedSec: number;
  hintText: string;
  inventory: InventoryState;
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

export class DungeonGameEngine {
  public dungeon: DungeonDefinition = getDungeonById(1);
  public room: 1 | 2 = 1;
  public light: LightState = 'bright';
  public status: 'idle' | 'playing' | 'victory' | 'defeat' = 'playing';

  private inventory: InventoryState = createInitialInventory();
  private chestOpenedInDungeon = false;

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
    dashMaxCdMs: 680,
    dashDirX: 1,
    dashDirY: 0,
    stepDustTimer: 0,
  };

  private enemy = {
    x: 320,
    y: 160,
    w: 24,
    h: 24,
    hp: 6,
    maxHp: 6,
    alive: false,
    hurtMs: 0,
    touchCdMs: 0,
    shootCdMs: 1200,
    strafePhase: 0,
  };

  private attackTimerMs = 0;
  private attackDurationMs = 190;
  private attackCooldownMs = 0;
  private hitstopMs = 0;
  private shakeTimerMs = 0;
  private shakeIntensity = 0;
  private roomFlashAlpha = 0;
  private lightLerp = 0; // 0 = bright, 1 = dark

  private portalUnlocked = false;
  private startTimeMs = Date.now();
  private elapsedSec = 0;
  private animTime = 0;
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private projectiles: Projectile[] = [];
  private dashGhosts: DashGhost[] = [];
  private ambientMotes: Array<{ x: number; y: number; speed: number; phase: number; size: number }> = [];
  private lightCanvas: HTMLCanvasElement | null = null;
  private lightCtx: CanvasRenderingContext2D | null = null;
  private hintText = 'Sala 1/2: Abra o baú dourado e avance até a porta →';

  constructor(
    private readonly callbacks: {
      onVictory: (dungeonId: number, elapsedSec: number) => void;
      onDamage: (hpRemaining: number) => void;
      onStateChange: (snapshot: GameSnapshot) => void;
    },
  ) {
    for (let i = 0; i < 18; i++) {
      this.ambientMotes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 8 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() > 0.65 ? 3 : 2,
      });
    }
    this.syncArmorStats(true);
    this.loadDungeon(1, 'bright', false);
  }

  setLightState(light: LightState): void {
    this.light = light;
  }

  private syncArmorStats(refillShield = false): void {
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
      this.spawnFloatingText(
        this.player.x + 10,
        this.player.y - 10,
        `${def.name}!`,
        def.color,
      );
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
      this.syncArmorStats(true);
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
    this.syncArmorStats(true);
    soundEngine.chestOpen();
    this.emitSnapshot();
    return { ok: true, msg: `${def.name} forjada e equipada!` };
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
    this.chestOpenedInDungeon = false;
    this.player.hp = this.player.maxHp;
    this.syncArmorStats(true);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invulnMs = 0;
    this.player.hurtMs = 0;
    this.player.dashMs = 0;
    this.player.dashCdMs = 0;
    this.player.aimAngle = 0;
    this.attackTimerMs = 0;
    this.attackCooldownMs = 0;
    this.hitstopMs = 0;
    this.shakeTimerMs = 0;
    this.roomFlashAlpha = 0.4;
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
    return {
      dungeonId: this.dungeon.id,
      dungeonName: this.dungeon.name,
      room: this.room,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      playerShield: this.player.shield,
      playerMaxShield: this.player.maxShield,
      enemyName: this.dungeon.enemyName,
      enemyHp: this.enemy.alive ? this.enemy.hp : 0,
      enemyMaxHp: this.dungeon.enemyMaxHp,
      portalUnlocked: this.portalUnlocked,
      status: this.status,
      elapsedSec: this.elapsedSec,
      hintText: this.hintText,
      inventory: {
        ...this.inventory,
        unlockedWeapons: [...this.inventory.unlockedWeapons],
        unlockedArmors: [...this.inventory.unlockedArmors],
      },
    };
  }

  private getCurrentMap(): string[] {
    return this.room === 1 ? this.dungeon.room1 : this.dungeon.room2;
  }

  private setupRoom(room: 1 | 2): void {
    this.room = room;
    this.projectiles = [];
    this.dashGhosts = [];
    this.roomFlashAlpha = 0.35;
    const map = this.getCurrentMap();
    this.enemy.alive = false;
    this.enemy.hp = this.dungeon.enemyMaxHp;
    this.enemy.maxHp = this.dungeon.enemyMaxHp;
    this.enemy.hurtMs = 0;
    this.enemy.touchCdMs = 500;
    this.enemy.shootCdMs = 950;
    this.enemy.strafePhase = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        if (ch === 'P') {
          this.player.x = c * TILE_SIZE + 6;
          this.player.y = r * TILE_SIZE + 6;
        } else if (ch === 'E' && room === 2) {
          this.enemy.x = c * TILE_SIZE + 4;
          this.enemy.y = r * TILE_SIZE + 4;
          this.enemy.alive = true;
        }
      }
    }

    if (room === 1) {
      this.portalUnlocked = false;
      this.hintText = 'Sala 1/2: Pegue o baú dourado e deslize até a porta →';
    } else {
      this.portalUnlocked = false;
      this.hintText = `Sala 2/2: Derrote ${this.dungeon.enemyName} (Espada rebate tiros!)`;
    }
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

  // Movimento seguro com corner-sliding (NUNCA prende ou atravessa quinas!)
  private moveWithSlide(box: EntityBox, dx: number, dy: number): void {
    // Seguranca extra: se por algum motivo estiver sobreposto a parede, centraliza no tile livre mais proximo
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
          if (
            !this.collidesWithMap(nx, box.y - nudge, box.w, box.h) &&
            !this.collidesWithMap(box.x, box.y - step, box.w, box.h)
          ) {
            box.y -= step;
            break;
          }
          if (
            !this.collidesWithMap(nx, box.y + nudge, box.w, box.h) &&
            !this.collidesWithMap(box.x, box.y + step, box.w, box.h)
          ) {
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
          if (
            !this.collidesWithMap(box.x - nudge, ny, box.w, box.h) &&
            !this.collidesWithMap(box.x - step, box.y, box.w, box.h)
          ) {
            box.x -= step;
            break;
          }
          if (
            !this.collidesWithMap(box.x + nudge, ny, box.w, box.h) &&
            !this.collidesWithMap(box.x + step, box.y, box.w, box.h)
          ) {
            box.x += step;
            break;
          }
        }
      }
    }
  }

  private openDungeonChest(cx: number, cy: number): void {
    this.chestOpenedInDungeon = true;
    soundEngine.chestOpen();
    this.spawnBurst(cx, cy, '#ffd43b', 18, 130);
    this.addShake(3, 100);

    const goldGain = 15 + this.dungeon.id * 5;
    this.inventory.gold += goldGain;

    // Desbloqueia automaticamente uma arma ou armadura se houver bloqueada na dungeon 2 ou 3
    let rewardLabel = `+${goldGain} OURO!`;
    if (this.dungeon.id === 1 && !this.inventory.unlockedWeapons.includes('flame_staff')) {
      this.inventory.unlockedWeapons = [...this.inventory.unlockedWeapons, 'flame_staff'];
      rewardLabel = 'CAJADO FLAMEJANTE!';
    } else if (this.dungeon.id === 2 && !this.inventory.unlockedArmors.includes('shadow_cloak')) {
      this.inventory.unlockedArmors = [...this.inventory.unlockedArmors, 'shadow_cloak'];
      rewardLabel = 'MANTO SOMBRIO!';
    } else if (this.dungeon.id === 3 && !this.inventory.unlockedWeapons.includes('forge_axe')) {
      this.inventory.unlockedWeapons = [...this.inventory.unlockedWeapons, 'forge_axe'];
      rewardLabel = 'MACHADO DA FORJA!';
    } else {
      this.inventory.potions += 1;
      rewardLabel = `+${goldGain} OURO + POÇÃO!`;
    }

    this.spawnFloatingText(cx, cy - 16, rewardLabel, '#ffd43b');
    this.hintText = `Tesouro coletado: ${rewardLabel} Abra a 🎒 Mochila para equipar!`;
    this.emitSnapshot();
  }

  private addShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimerMs = Math.max(this.shakeTimerMs, durationMs);
  }

  private spawnBurst(cx: number, cy: number, color: string, count = 10, speedMax = 110): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 28 + Math.random() * speedMax;
      const life = 0.25 + Math.random() * 0.26;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size: 2 + Math.floor(Math.random() * 3),
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

  private damageEnemy(amount: number, knockX: number, knockY: number): void {
    if (!this.enemy.alive) return;
    this.enemy.hp -= amount;
    this.enemy.hurtMs = 150;
    this.moveWithSlide(this.enemy, knockX, knockY);
    const eCx = this.enemy.x + this.enemy.w / 2;
    const eCy = this.enemy.y + this.enemy.h / 2;
    this.spawnBurst(eCx, eCy, this.dungeon.accentColor, 10, 115);
    this.spawnFloatingText(eCx, eCy - 14, `-${amount}`, amount >= 3 ? '#ff922b' : amount >= 2 ? '#ffd43b' : '#ffffff');
    this.addShake(amount >= 2 ? 4.5 : 2.5, 110);
    this.hitstopMs = amount >= 2 ? 28 : 14;
    soundEngine.hitEnemy();

    if (this.enemy.hp <= 0) {
      this.enemy.alive = false;
      this.portalUnlocked = true;
      this.projectiles = this.projectiles.filter((p) => p.fromPlayer);
      this.inventory.gold += 25;
      this.inventory.potions += 1;
      this.hintText = 'Chefe derrotado (+25 Ouro, +1 Poção)! Entre no Portal Rúnico!';
      this.spawnBurst(eCx, eCy, '#ffd43b', 22, 145);
      this.spawnBurst(eCx, eCy, '#63e6be', 14, 110);
      this.spawnFloatingText(eCx, eCy - 18, '+25 OURO! PORTAL ABERTO!', '#63e6be');
      this.addShake(6, 200);
      soundEngine.portalUnlock();
    }
    this.emitSnapshot();
  }

  private damagePlayer(amount = 1): void {
    if (this.player.invulnMs > 0 || this.player.dashMs > 0 || this.status !== 'playing') return;
    this.player.invulnMs = 950;
    this.player.hurtMs = 220;
    this.player.shieldRegenDelayMs = 4200;
    this.player.shieldRegenTickMs = 0;

    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;

    // Escudo estilo Soul Knight absorve o dano primeiro!
    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, amount);
      this.player.shield -= absorbed;
      const leftover = amount - absorbed;
      this.spawnBurst(pCx, pCy, '#4dabf7', 12, 105);
      this.spawnFloatingText(pCx, pCy - 14, 'ESCUDO!', '#74c0fc');
      this.addShake(4, 120);
      soundEngine.parry();
      if (leftover > 0) {
        this.player.hp -= leftover;
      }
    } else {
      this.player.hp -= amount;
      this.spawnBurst(pCx, pCy, '#ff6b6b', 12, 110);
      this.spawnFloatingText(pCx, pCy - 14, `-${amount}`, '#ff6b6b');
      this.addShake(5.5, 160);
      soundEngine.hurtPlayer();
    }

    if (this.player.hp <= 0) {
      this.status = 'defeat';
      this.hintText = 'Você caiu na masmorra! Tente novamente ou equipe itens na Mochila.';
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
    this.spawnBurst(
      this.player.x + this.player.w / 2,
      this.player.y + this.player.h,
      '#74c0fc',
      8,
      70,
    );
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

    // 1. Dispara projeteis conforme a arma equipada
    const count = weapon.projCount;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * weapon.spreadRad;
      const ang = this.player.aimAngle + offset;
      this.projectiles.push({
        fromPlayer: true,
        x: pCx + Math.cos(ang) * 14,
        y: pCy + Math.sin(ang) * 14,
        vx: Math.cos(ang) * weapon.projSpeed,
        vy: Math.sin(ang) * weapon.projSpeed,
        radius: weapon.id === 'flame_staff' ? 6.5 : 4.8,
        color: weapon.color,
        coreColor: weapon.coreColor,
        damage: weapon.projDamage + armor.bonusDamage,
        life: weapon.id === 'elf_bow' ? 1.15 : 0.78,
      });
    }

    // 2. Corte corpo a corpo bloqueia tiros inimigos
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.fromPlayer) continue;
      const d = Math.hypot(proj.x - (pCx + ax * 16), proj.y - (pCy + ay * 16));
      if (d <= weapon.parryRadius) {
        this.spawnBurst(proj.x, proj.y, '#ffd43b', 7, 90);
        this.spawnFloatingText(proj.x, proj.y - 10, 'DEFESA!', '#ffd43b');
        this.projectiles.splice(i, 1);
        soundEngine.parry();
      }
    }

    // 3. Dano corpo a corpo se inimigo estiver no alcance
    if (this.room === 2 && this.enemy.alive) {
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      const dist = Math.hypot(eCx - pCx, eCy - pCy);
      if (dist <= weapon.meleeRange) {
        const nx = dist > 0.1 ? (eCx - pCx) / dist : ax;
        const ny = dist > 0.1 ? (eCy - pCy) / dist : ay;
        this.damageEnemy(weapon.meleeDamage + armor.bonusDamage, nx * 16, ny * 16);
      }
    }
  }

  private fireEnemyPattern(): void {
    const eCx = this.enemy.x + this.enemy.w / 2;
    const eCy = this.enemy.y + this.enemy.h / 2;
    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    const baseAngle = Math.atan2(pCy - eCy, pCx - eCx);

    soundEngine.enemyShoot();

    if (this.dungeon.enemyKind === 'slime') {
      this.projectiles.push({
        fromPlayer: false,
        x: eCx,
        y: eCy,
        vx: Math.cos(baseAngle) * 135,
        vy: Math.sin(baseAngle) * 135,
        radius: 6,
        color: '#20c997',
        coreColor: '#c3fae8',
        damage: 1,
        life: 2.4,
      });
    } else if (this.dungeon.enemyKind === 'skeleton') {
      [-0.18, 0.18].forEach((offset) => {
        const a = baseAngle + offset;
        this.projectiles.push({
          fromPlayer: false,
          x: eCx,
          y: eCy,
          vx: Math.cos(a) * 160,
          vy: Math.sin(a) * 160,
          radius: 5,
          color: '#cc5de8',
          coreColor: '#f8f0fc',
          damage: 1,
          life: 2.2,
        });
      });
    } else {
      [-0.32, 0, 0.32].forEach((offset) => {
        const a = baseAngle + offset;
        this.projectiles.push({
          fromPlayer: false,
          x: eCx,
          y: eCy,
          vx: Math.cos(a) * 165,
          vy: Math.sin(a) * 165,
          radius: 5.5,
          color: '#ff6b6b',
          coreColor: '#fff3bf',
          damage: 1,
          life: 2.2,
        });
      });
    }
  }

  update(dtSec: number, input: InputState): void {
    const dt = Math.min(0.045, Math.max(0.001, dtSec));
    this.animTime += dt;

    const targetLight = this.light === 'dark' ? 1 : 0;
    this.lightLerp += (targetLight - this.lightLerp) * Math.min(1, dt * 6.5);

    if (this.roomFlashAlpha > 0) {
      this.roomFlashAlpha = Math.max(0, this.roomFlashAlpha - dt * 1.6);
    }

    for (const m of this.ambientMotes) {
      m.y -= m.speed * dt;
      m.x += Math.sin(this.animTime * 1.8 + m.phase) * 8 * dt;
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
      this.dashGhosts[i].alpha -= dt * 4.5;
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
    if (this.enemy.hurtMs > 0) this.enemy.hurtMs = Math.max(0, this.enemy.hurtMs - dt * 1000);
    if (this.enemy.touchCdMs > 0) this.enemy.touchCdMs = Math.max(0, this.enemy.touchCdMs - dt * 1000);
    if (this.attackTimerMs > 0) this.attackTimerMs = Math.max(0, this.attackTimerMs - dt * 1000);
    if (this.attackCooldownMs > 0) this.attackCooldownMs = Math.max(0, this.attackCooldownMs - dt * 1000);

    // Regeneracao automatica de Escudo estilo Soul Knight!
    if (this.player.shield < this.player.maxShield) {
      if (this.player.shieldRegenDelayMs > 0) {
        this.player.shieldRegenDelayMs = Math.max(0, this.player.shieldRegenDelayMs - dt * 1000);
      } else {
        this.player.shieldRegenTickMs += dt * 1000;
        if (this.player.shieldRegenTickMs >= 1300) {
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
    if (this.player.dashMs > 0) {
      this.player.dashMs = Math.max(0, this.player.dashMs - dt * 1000);
      this.player.vx = this.player.dashDirX * 335;
      this.player.vy = this.player.dashDirY * 335;
      this.player.moving = true;
      if (Math.random() < 0.7) {
        this.dashGhosts.push({
          x: this.player.x,
          y: this.player.y,
          aimAngle: this.player.aimAngle,
          alpha: 0.5,
        });
      }
    } else {
      const maxSpd = 152 * armor.speedMult;
      const targetVx = ix * maxSpd;
      const targetVy = iy * maxSpd;
      const accel = Math.min(1, dt * 14);
      this.player.vx += (targetVx - this.player.vx) * accel;
      this.player.vy += (targetVy - this.player.vy) * accel;
      if (Math.abs(this.player.vx) < 2) this.player.vx = 0;
      if (Math.abs(this.player.vy) < 2) this.player.vy = 0;
      this.player.moving = Math.hypot(this.player.vx, this.player.vy) > 12;
    }

    this.moveWithSlide(this.player, this.player.vx * dt, this.player.vy * dt);

    if (this.player.moving && this.player.dashMs <= 0) {
      this.player.stepDustTimer += dt;
      if (this.player.stepDustTimer >= 0.16) {
        this.player.stepDustTimer = 0;
        this.particles.push({
          x: this.player.x + this.player.w / 2,
          y: this.player.y + this.player.h,
          vx: (Math.random() - 0.5) * 20,
          vy: -8 - Math.random() * 10,
          life: 0.24,
          maxLife: 0.24,
          color: 'rgba(220, 230, 245, 0.5)',
          size: 3,
        });
      }
    }

    if (this.room === 2 && this.enemy.alive) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      this.player.aimAngle = Math.atan2(eCy - pCy, eCx - pCx);
    } else if (ilen > 0.15) {
      this.player.aimAngle = Math.atan2(iy, ix);
    }

    if (input.attackPressed) {
      this.triggerAttack();
    }

    if (this.room === 2 && this.enemy.alive) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      const dx = pCx - eCx;
      const dy = pCy - eCy;
      const dist = Math.hypot(dx, dy);

      this.enemy.strafePhase += dt * 1.9;
      if (dist > 8) {
        const approach = dist > 95 ? 1 : dist < 58 ? -0.4 : 0.25;
        const strafe = Math.sin(this.enemy.strafePhase) * 0.65;
        const nx = dx / dist;
        const ny = dy / dist;
        const vx = (nx * approach - ny * strafe) * this.dungeon.enemySpeed;
        const vy = (ny * approach + nx * strafe) * this.dungeon.enemySpeed;
        this.moveWithSlide(this.enemy, vx * dt, vy * dt);
      }

      if (dist < 24 && this.enemy.touchCdMs <= 0) {
        this.enemy.touchCdMs = 750;
        this.damagePlayer(1);
      }

      this.enemy.shootCdMs -= dt * 1000;
      if (this.enemy.shootCdMs <= 0) {
        this.enemy.shootCdMs = this.dungeon.enemyFireRateMs;
        this.fireEnemyPattern();
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      const col = Math.floor(pr.x / TILE_SIZE);
      const row = Math.floor(pr.y / TILE_SIZE);
      if (pr.life <= 0 || this.isSolidTile(col, row)) {
        this.spawnBurst(pr.x, pr.y, pr.color, 5, 65);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer && this.room === 2 && this.enemy.alive) {
        const eCx = this.enemy.x + this.enemy.w / 2;
        const eCy = this.enemy.y + this.enemy.h / 2;
        if (Math.hypot(pr.x - eCx, pr.y - eCy) <= pr.radius + 14) {
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          this.damageEnemy(pr.damage, (pr.vx / sp) * 8, (pr.vy / sp) * 8);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else if (!pr.fromPlayer) {
        const pCx = this.player.x + this.player.w / 2;
        const pCy = this.player.y + this.player.h / 2;
        if (Math.hypot(pr.x - pCx, pr.y - pCy) <= pr.radius + 10) {
          this.damagePlayer(pr.damage);
          this.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    // Checa bau ('C'), porta ('D') e portal ('O')
    const centerCol = Math.floor((this.player.x + this.player.w / 2) / TILE_SIZE);
    const centerRow = Math.floor((this.player.y + this.player.h / 2) / TILE_SIZE);
    const tile = this.getCurrentMap()[centerRow]?.[centerCol];

    if (this.room === 1 && tile === 'C' && !this.chestOpenedInDungeon) {
      this.openDungeonChest(centerCol * TILE_SIZE + 16, centerRow * TILE_SIZE + 16);
    } else if (this.room === 1 && tile === 'D') {
      soundEngine.doorEnter();
      this.setupRoom(2);
      this.emitSnapshot();
    } else if (this.room === 2 && tile === 'O' && this.portalUnlocked) {
      this.status = 'victory';
      this.hintText = `Vitória em ${this.elapsedSec}s! LED físico confirmando conclusão.`;
      soundEngine.victory();
      this.spawnBurst(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h / 2,
        '#63e6be',
        24,
        145,
      );
      this.callbacks.onVictory(this.dungeon.id, this.elapsedSec);
      this.emitSnapshot();
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
    const pal = BIOME_PALETTES[this.dungeon.biome];
    const tiles = getBiomeTileset(this.dungeon.biome);
    const map = this.getCurrentMap();
    const weapon = WEAPONS[this.inventory.equippedWeapon];
    const armor = ARMORS[this.inventory.equippedArmor];

    ctx.save();
    if (this.shakeTimerMs > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const lightSources: Array<{ x: number; y: number; r: number }> = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (ch === '#') {
          ctx.drawImage(tiles.wall, x, y);
        } else {
          if (ch === ',') {
            ctx.drawImage(tiles.carpet, x, y);
          } else {
            const hash = (r * 31 + c * 17 + this.dungeon.id * 7) % 11;
            const variant = hash === 0 ? 1 : hash === 3 ? 2 : hash === 6 ? 3 : (r + c) % 2;
            ctx.drawImage(tiles.floors[variant], x, y);
          }

          if (r > 0 && map[r - 1][c] === '#') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.fillRect(x, y, TILE_SIZE, 6);
          }

          if (ch === 'T') {
            ctx.drawImage(tiles.prop, x, y);
          } else if (ch === 'B') {
            drawBrazier(ctx, x, y, pal, this.animTime);
            lightSources.push({ x: x + 16, y: y + 12, r: 66 });
          } else if (ch === 'C') {
            drawChestTile(ctx, x, y, this.chestOpenedInDungeon, this.animTime);
            if (!this.chestOpenedInDungeon) {
              lightSources.push({ x: x + 16, y: y + 16, r: 52 });
            }
          } else if (ch === 'D') {
            drawDoorTile(ctx, x, y, this.animTime);
            lightSources.push({ x: x + 16, y: y + 16, r: 58 });
          } else if (ch === 'O') {
            drawPortalTile(ctx, x, y, pal, this.portalUnlocked, this.animTime);
            if (this.portalUnlocked) {
              lightSources.push({ x: x + 16, y: y + 16, r: 84 });
            }
          }
        }
      }
    }

    ctx.fillStyle = this.dungeon.biome === 'forge' ? 'rgba(255, 146, 43, 0.45)' : 'rgba(225, 240, 255, 0.22)';
    for (const m of this.ambientMotes) {
      ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
    }

    for (const g of this.dashGhosts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, g.alpha);
      drawHero(ctx, g.x, g.y, g.aimAngle, true, false, true, 0, this.animTime, weapon.id, armor.tint);
      ctx.restore();
    }

    if (this.room === 2 && this.enemy.alive) {
      drawEnemy(
        ctx,
        this.dungeon.enemyKind,
        this.enemy.x,
        this.enemy.y,
        this.enemy.hurtMs > 0,
        this.animTime,
      );
      lightSources.push({ x: this.enemy.x + 12, y: this.enemy.y + 12, r: 42 });

      const bw = 32;
      const bx = Math.round(this.enemy.x - 4);
      const by = Math.round(this.enemy.y - 11);
      ctx.fillStyle = '#12101a';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(bx, by, Math.round((bw * Math.max(0, this.enemy.hp)) / this.enemy.maxHp), 4);
    }

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
      );
    }

    if (this.player.dashCdMs > 0) {
      const ratio = 1 - this.player.dashCdMs / this.player.dashMaxCdMs;
      ctx.fillStyle = 'rgba(18, 16, 26, 0.75)';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), 20, 3);
      ctx.fillStyle = '#66d9e8';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), Math.round(20 * ratio), 3);
    }

    // Arco de corte colorido conforme a arma equipada
    if (this.attackTimerMs > 0 && weapon.id !== 'elf_bow') {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const alpha = this.attackTimerMs / this.attackDurationMs;
      const arcR = weapon.id === 'forge_axe' ? 32 : 26;
      ctx.save();
      ctx.translate(pCx, pCy);
      ctx.rotate(this.player.aimAngle);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = weapon.id === 'forge_axe' ? 13 : 9;
      ctx.beginPath();
      ctx.arc(4, 0, arcR, -1.05, 1.05);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(6, 0, arcR, -0.92, 0.92);
      ctx.stroke();
      ctx.restore();
    }

    for (const pr of this.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pr.coreColor;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius - 1, 0, Math.PI * 2);
      ctx.fill();
      lightSources.push({ x: pr.x, y: pr.y, r: 28 });
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Iluminacao dinamica ultra-leve (usa carimbo pre-renderizado -> 60fps liso no Android!)
    if (this.lightLerp > 0.02) {
      const lctx = this.ensureLightCanvas();
      const hole = getLightHoleStamp();
      const heroCx = this.player.x + this.player.w / 2;
      const heroCy = this.player.y + this.player.h / 2;
      const heroR = (weapon.id === 'flame_staff' ? 135 : 112) + Math.sin(this.animTime * 11) * 4;

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

      // Brilho quente pre-renderizado da tocha do heroi
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

    if (this.room === 2 && this.enemy.alive) {
      const barW = 200;
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
      ctx.fillText(this.dungeon.enemyName.toUpperCase(), CANVAS_WIDTH / 2, barY - 4);
      ctx.fillStyle = '#2b2f3d';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(barX, barY, Math.round((barW * this.enemy.hp) / this.enemy.maxHp), 5);
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
