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
  BIOME_PALETTES,
  drawBrazier,
  drawDoorTile,
  drawEnemy,
  drawHero,
  drawPortalTile,
  getBiomeTileset,
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
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  portalUnlocked: boolean;
  status: 'idle' | 'playing' | 'victory' | 'defeat';
  elapsedSec: number;
  hintText: string;
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

  private player = {
    x: 64,
    y: 128,
    w: 20,
    h: 20,
    vx: 0,
    vy: 0,
    hp: 6,
    maxHp: 6,
    aimAngle: 0,
    moving: false,
    invulnMs: 0,
    hurtMs: 0,
    dashMs: 0,
    dashCdMs: 0,
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
  private hintText = 'Sala 1/2: Atravesse a masmorra e entre na porta dourada ->';

  constructor(
    private readonly callbacks: {
      onVictory: (dungeonId: number, elapsedSec: number) => void;
      onDamage: (hpRemaining: number) => void;
      onStateChange: (snapshot: GameSnapshot) => void;
    },
  ) {
    for (let i = 0; i < 22; i++) {
      this.ambientMotes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 8 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() > 0.65 ? 3 : 2,
      });
    }
    this.loadDungeon(1, 'bright', false);
  }

  setLightState(light: LightState): void {
    this.light = light;
  }

  loadDungeon(dungeonId: number, light: LightState, playChime = true): void {
    this.dungeon = getDungeonById(dungeonId);
    this.light = light;
    this.lightLerp = light === 'dark' ? 1 : 0;
    this.room = 1;
    this.status = 'playing';
    this.player.hp = this.player.maxHp;
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
    this.roomFlashAlpha = 0.45;
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
      enemyName: this.dungeon.enemyName,
      enemyHp: this.enemy.alive ? this.enemy.hp : 0,
      enemyMaxHp: this.dungeon.enemyMaxHp,
      portalUnlocked: this.portalUnlocked,
      status: this.status,
      elapsedSec: this.elapsedSec,
      hintText: this.hintText,
    };
  }

  private getCurrentMap(): string[] {
    return this.room === 1 ? this.dungeon.room1 : this.dungeon.room2;
  }

  private setupRoom(room: 1 | 2): void {
    this.room = room;
    this.projectiles = [];
    this.dashGhosts = [];
    this.roomFlashAlpha = 0.4;
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
      this.hintText = 'Sala 1/2: Deslize o analógico até a porta dourada →';
    } else {
      this.portalUnlocked = false;
      this.hintText = `Sala 2/2: Derrote ${this.dungeon.enemyName} (Espada bloqueia tiros!)`;
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

  // Movimento com corner-sliding suave estilo Soul Knight (nao prende em quinas!)
  private moveWithSlide(box: EntityBox, dx: number, dy: number): void {
    if (dx !== 0) {
      const nx = box.x + dx;
      if (!this.collidesWithMap(nx, box.y, box.w, box.h)) {
        box.x = nx;
      } else {
        for (let nudge = 1; nudge <= 7; nudge++) {
          if (!this.collidesWithMap(nx, box.y - nudge, box.w, box.h)) {
            box.y -= Math.min(nudge, Math.abs(dx) * 0.9);
            break;
          }
          if (!this.collidesWithMap(nx, box.y + nudge, box.w, box.h)) {
            box.y += Math.min(nudge, Math.abs(dx) * 0.9);
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
        for (let nudge = 1; nudge <= 7; nudge++) {
          if (!this.collidesWithMap(box.x - nudge, ny, box.w, box.h)) {
            box.x -= Math.min(nudge, Math.abs(dy) * 0.9);
            break;
          }
          if (!this.collidesWithMap(box.x + nudge, ny, box.w, box.h)) {
            box.x += Math.min(nudge, Math.abs(dy) * 0.9);
            break;
          }
        }
      }
    }
  }

  private addShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimerMs = Math.max(this.shakeTimerMs, durationMs);
  }

  private spawnBurst(cx: number, cy: number, color: string, count = 10, speedMax = 110): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 28 + Math.random() * speedMax;
      const life = 0.25 + Math.random() * 0.28;
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
      life: 0.7,
      maxLife: 0.7,
    });
  }

  private damageEnemy(amount: number, knockX: number, knockY: number): void {
    if (!this.enemy.alive) return;
    this.enemy.hp -= amount;
    this.enemy.hurtMs = 150;
    this.moveWithSlide(this.enemy, knockX, knockY);
    const eCx = this.enemy.x + this.enemy.w / 2;
    const eCy = this.enemy.y + this.enemy.h / 2;
    this.spawnBurst(eCx, eCy, this.dungeon.accentColor, 10, 120);
    this.spawnFloatingText(eCx, eCy - 14, `-${amount}`, amount >= 2 ? '#ffd43b' : '#ffffff');
    this.addShake(amount >= 2 ? 4.5 : 2.5, 110);
    this.hitstopMs = amount >= 2 ? 32 : 16;
    soundEngine.hitEnemy();

    if (this.enemy.hp <= 0) {
      this.enemy.alive = false;
      this.portalUnlocked = true;
      this.projectiles = this.projectiles.filter((p) => p.fromPlayer);
      this.hintText = 'Inimigo derrotado! Entre no Portal Runico brilhante a direita!';
      this.spawnBurst(eCx, eCy, '#ffd43b', 24, 150);
      this.spawnBurst(eCx, eCy, '#63e6be', 14, 110);
      this.spawnFloatingText(eCx, eCy - 18, 'PORTAL ABERTO!', '#63e6be');
      this.addShake(6.5, 220);
      soundEngine.portalUnlock();
    }
    this.emitSnapshot();
  }

  private damagePlayer(amount = 1): void {
    if (this.player.invulnMs > 0 || this.player.dashMs > 0 || this.status !== 'playing') return;
    this.player.hp -= amount;
    this.player.invulnMs = 950;
    this.player.hurtMs = 220;
    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    this.spawnBurst(pCx, pCy, '#ff6b6b', 12, 110);
    this.spawnFloatingText(pCx, pCy - 14, `-${amount}`, '#ff6b6b');
    this.addShake(5.5, 160);
    soundEngine.hurtPlayer();

    if (this.player.hp <= 0) {
      this.status = 'defeat';
      this.hintText = 'Voce caiu na masmorra! Tente novamente ou troque de dungeon.';
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
    this.player.dashCdMs = 680;
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
    this.attackTimerMs = this.attackDurationMs;
    this.attackCooldownMs = 260;
    soundEngine.slash();

    const pCx = this.player.x + this.player.w / 2;
    const pCy = this.player.y + this.player.h / 2;
    const ax = Math.cos(this.player.aimAngle);
    const ay = Math.sin(this.player.aimAngle);

    // 1. Onda de energia runica (estilo arma de Soul Knight!)
    this.projectiles.push({
      fromPlayer: true,
      x: pCx + ax * 16,
      y: pCy + ay * 16,
      vx: ax * 285,
      vy: ay * 285,
      radius: 5,
      color: '#4dabf7',
      coreColor: '#e7f5ff',
      damage: 1,
      life: 0.72,
    });

    // 2. Corte de espada corpo a corpo (destroi tiros inimigos no caminho!)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.fromPlayer) continue;
      const d = Math.hypot(proj.x - (pCx + ax * 16), proj.y - (pCy + ay * 16));
      if (d <= 32) {
        this.spawnBurst(proj.x, proj.y, '#ffd43b', 7, 90);
        this.spawnFloatingText(proj.x, proj.y - 10, 'DEFESA!', '#ffd43b');
        this.projectiles.splice(i, 1);
        soundEngine.parry();
      }
    }

    // 3. Dano corpo a corpo pesado (2 dmg) se inimigo estiver no alcance do arco
    if (this.room === 2 && this.enemy.alive) {
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      const dist = Math.hypot(eCx - pCx, eCy - pCy);
      if (dist <= 52) {
        const nx = dist > 0.1 ? (eCx - pCx) / dist : ax;
        const ny = dist > 0.1 ? (eCy - pCy) / dist : ay;
        this.damageEnemy(2, nx * 18, ny * 18);
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
      // Orbe acido unico mais lento
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
      // Rajada dupla em V
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
      // Gargula: leque de 3 bolas de fogo
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

    // Transicao suave de iluminacao (claro <-> escuro ao tampar/destampar LDR)
    const targetLight = this.light === 'dark' ? 1 : 0;
    this.lightLerp += (targetLight - this.lightLerp) * Math.min(1, dt * 6.5);

    if (this.roomFlashAlpha > 0) {
      this.roomFlashAlpha = Math.max(0, this.roomFlashAlpha - dt * 1.6);
    }

    // Poeira/brasas ambientes flutuando
    for (const m of this.ambientMotes) {
      m.y -= m.speed * dt;
      m.x += Math.sin(this.animTime * 1.8 + m.phase) * 8 * dt;
      if (m.y < 16) {
        m.y = CANVAS_HEIGHT - 16;
        m.x = 24 + Math.random() * (CANVAS_WIDTH - 48);
      }
    }

    // Atualiza particulas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Atualiza textos flutuantes
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Atualiza rastros do dash
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

    // Vetor de entrada analogico/teclado
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

    // Fisica fluida do heroi
    if (this.player.dashMs > 0) {
      this.player.dashMs = Math.max(0, this.player.dashMs - dt * 1000);
      this.player.vx = this.player.dashDirX * 330;
      this.player.vy = this.player.dashDirY * 330;
      this.player.moving = true;
      if (Math.random() < 0.75) {
        this.dashGhosts.push({
          x: this.player.x,
          y: this.player.y,
          aimAngle: this.player.aimAngle,
          alpha: 0.55,
        });
      }
    } else {
      const targetVx = ix * 150;
      const targetVy = iy * 150;
      const accel = Math.min(1, dt * 14);
      this.player.vx += (targetVx - this.player.vx) * accel;
      this.player.vy += (targetVy - this.player.vy) * accel;
      if (Math.abs(this.player.vx) < 2) this.player.vx = 0;
      if (Math.abs(this.player.vy) < 2) this.player.vy = 0;
      this.player.moving = Math.hypot(this.player.vx, this.player.vy) > 12;
    }

    this.moveWithSlide(this.player, this.player.vx * dt, this.player.vy * dt);

    // Poeira leve nos pes enquanto corre
    if (this.player.moving && this.player.dashMs <= 0) {
      this.player.stepDustTimer += dt;
      if (this.player.stepDustTimer >= 0.15) {
        this.player.stepDustTimer = 0;
        this.particles.push({
          x: this.player.x + this.player.w / 2,
          y: this.player.y + this.player.h,
          vx: (Math.random() - 0.5) * 20,
          vy: -8 - Math.random() * 10,
          life: 0.25,
          maxLife: 0.25,
          color: 'rgba(220, 230, 245, 0.55)',
          size: 3,
        });
      }
    }

    // Mira inteligente estilo Soul Knight: mira no inimigo na Sala 2 ou na direcao do movimento
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

    // IA do chefe na Sala 2
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

    // Atualiza projeteis (ondas runicas + ataques do inimigo)
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

    // Checa transicao de sala / Portal Final
    const centerCol = Math.floor((this.player.x + this.player.w / 2) / TILE_SIZE);
    const centerRow = Math.floor((this.player.y + this.player.h / 2) / TILE_SIZE);
    const tile = this.getCurrentMap()[centerRow]?.[centerCol];

    if (this.room === 1 && tile === 'D') {
      soundEngine.doorEnter();
      this.setupRoom(2);
      this.emitSnapshot();
    } else if (this.room === 2 && tile === 'O' && this.portalUnlocked) {
      this.status = 'victory';
      this.hintText = `Vitoria em ${this.elapsedSec}s! LED fisico confirmando conclusao.`;
      soundEngine.victory();
      this.spawnBurst(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h / 2,
        '#63e6be',
        26,
        150,
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

    ctx.save();
    if (this.shakeTimerMs > 0) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const lightSources: Array<{ x: number; y: number; r: number }> = [];

    // 1. Chao, tapetes, paredes 2.5D, sombras projetadas e props
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (ch === '#') {
          ctx.drawImage(tiles.wall, x, y);
        } else {
          // Chao com variacao deterministica para textura rica
          if (ch === ',') {
            ctx.drawImage(tiles.carpet, x, y);
          } else {
            const hash = (r * 31 + c * 17 + this.dungeon.id * 7) % 11;
            const variant = hash === 0 ? 1 : hash === 3 ? 2 : hash === 6 ? 3 : (r + c) % 2;
            ctx.drawImage(tiles.floors[variant], x, y);
          }

          // Sombra 2.5D projetada pela parede acima
          if (r > 0 && map[r - 1][c] === '#') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.fillRect(x, y, TILE_SIZE, 6);
          }

          if (ch === 'T') {
            ctx.drawImage(tiles.prop, x, y);
          } else if (ch === 'B') {
            drawBrazier(ctx, x, y, pal, this.animTime);
            lightSources.push({ x: x + 16, y: y + 12, r: 66 + Math.sin(this.animTime * 12 + c) * 4 });
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

    // 2. Poeira / brasas ambientes
    ctx.fillStyle = this.dungeon.biome === 'forge' ? 'rgba(255, 146, 43, 0.45)' : 'rgba(225, 240, 255, 0.22)';
    for (const m of this.ambientMotes) {
      ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
    }

    // 3. Rastros fantasmas do Dash
    for (const g of this.dashGhosts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, g.alpha);
      drawHero(ctx, g.x, g.y, g.aimAngle, true, false, true, 0, this.animTime);
      ctx.restore();
    }

    // 4. Inimigo (Sala 2)
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

      // Mini barra de HP acima do inimigo
      const bw = 32;
      const bx = Math.round(this.enemy.x - 4);
      const by = Math.round(this.enemy.y - 11);
      ctx.fillStyle = '#12101a';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(bx, by, Math.round((bw * Math.max(0, this.enemy.hp)) / this.enemy.maxHp), 4);
    }

    // 5. Heroi + Espada
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
      );
    }

    // Barra discreta de recarga do Dash sob o heroi
    if (this.player.dashCdMs > 0) {
      const ratio = 1 - this.player.dashCdMs / 680;
      ctx.fillStyle = 'rgba(18, 16, 26, 0.75)';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), 20, 3);
      ctx.fillStyle = '#66d9e8';
      ctx.fillRect(Math.round(this.player.x), Math.round(this.player.y + 25), Math.round(20 * ratio), 3);
    }

    // 6. Arco luminoso de corte de espada (Soul Knight melee slash!)
    if (this.attackTimerMs > 0) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const alpha = this.attackTimerMs / this.attackDurationMs;
      ctx.save();
      ctx.translate(pCx, pCy);
      ctx.rotate(this.player.aimAngle);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#74c0fc';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(4, 0, 26, -1.05, 1.05);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(6, 0, 26, -0.95, 0.95);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Projeteis brilhantes
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

    // 8. Particulas
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 9. Iluminacao dinamica multi-foco quando LDR indica ESCURO (suavizada com lightLerp)
    if (this.lightLerp > 0.02) {
      const lctx = this.ensureLightCanvas();
      const heroCx = this.player.x + this.player.w / 2;
      const heroCy = this.player.y + this.player.h / 2;
      const heroR = 112 + Math.sin(this.animTime * 13) * 5;

      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      lctx.fillStyle = `rgba(6, 7, 16, ${(0.84 * this.lightLerp).toFixed(3)})`;
      lctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      lctx.globalCompositeOperation = 'destination-out';
      const punch = (lx: number, ly: number, radius: number) => {
        const g = lctx.createRadialGradient(lx, ly, radius * 0.12, lx, ly, radius);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.68)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath();
        lctx.arc(lx, ly, radius, 0, Math.PI * 2);
        lctx.fill();
      };

      punch(heroCx, heroCy, heroR);
      for (const ls of lightSources) {
        punch(ls.x, ls.y, ls.r);
      }

      ctx.drawImage(this.lightCanvas!, 0, 0);

      // Brilho quente da tocha ao redor do heroi no modo sombrio
      const warm = ctx.createRadialGradient(heroCx, heroCy, 8, heroCx, heroCy, heroR * 0.85);
      warm.addColorStop(0, `rgba(255, 190, 92, ${(0.18 * this.lightLerp).toFixed(3)})`);
      warm.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = warm;
      ctx.beginPath();
      ctx.arc(heroCx, heroCy, heroR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10. Textos flutuantes de dano / parry / portal
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (const f of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = '#12101a';
      ctx.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.globalAlpha = 1;

    // 11. Barra de chefe estilo Soul Knight no rodape da Sala 2
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

    // Flash suave de transicao de sala
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
