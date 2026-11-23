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
import { drawEnemySprite, drawHeroSprite, PALETTES } from './pixelSprites';
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
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attackPressed: boolean;
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

  private player = { x: 64, y: 128, w: 22, h: 22, hp: 5, maxHp: 5, facingX: 1, facingY: 0, invulnMs: 0, hurtMs: 0 };
  private enemy = { x: 320, y: 160, w: 24, h: 24, hp: 3, maxHp: 3, alive: false, hurtMs: 0, attackCdMs: 0, vx: 0, vy: 0 };
  private attackTimerMs = 0;
  private attackCooldownMs = 0;
  private portalUnlocked = false;
  private startTimeMs = Date.now();
  private elapsedSec = 0;
  private animTime = 0;
  private particles: Particle[] = [];
  private hintText = 'Avance ate a porta dourada a direita!';

  constructor(
    private readonly callbacks: {
      onVictory: (dungeonId: number, elapsedSec: number) => void;
      onDamage: (hpRemaining: number) => void;
      onStateChange: (snapshot: GameSnapshot) => void;
    },
  ) {
    this.loadDungeon(1, 'bright', false);
  }

  setLightState(light: LightState): void {
    this.light = light;
  }

  loadDungeon(dungeonId: number, light: LightState, playChime = true): void {
    this.dungeon = getDungeonById(dungeonId);
    this.light = light;
    this.room = 1;
    this.status = 'playing';
    this.player.hp = this.player.maxHp;
    this.player.invulnMs = 0;
    this.player.hurtMs = 0;
    this.player.facingX = 1;
    this.player.facingY = 0;
    this.attackTimerMs = 0;
    this.attackCooldownMs = 0;
    this.portalUnlocked = false;
    this.particles = [];
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
    const map = this.getCurrentMap();
    this.enemy.alive = false;
    this.enemy.hp = this.dungeon.enemyMaxHp;
    this.enemy.maxHp = this.dungeon.enemyMaxHp;
    this.enemy.hurtMs = 0;
    this.enemy.attackCdMs = 450;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        if (ch === 'P') {
          this.player.x = c * TILE_SIZE + 5;
          this.player.y = r * TILE_SIZE + 5;
        } else if (ch === 'E' && room === 2) {
          this.enemy.x = c * TILE_SIZE + 4;
          this.enemy.y = r * TILE_SIZE + 4;
          this.enemy.alive = true;
        }
      }
    }

    if (room === 1) {
      this.portalUnlocked = false;
      this.hintText = 'Sala 1/2: Atravesse a sala e entre na porta dourada ->';
    } else {
      this.portalUnlocked = false;
      this.hintText = `Sala 2/2: Derrote ${this.dungeon.enemyName} para abrir o portal!`;
    }
  }

  private isSolidTile(col: number, row: number): boolean {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
    const ch = this.getCurrentMap()[row][col];
    return ch === '#' || ch === 'T';
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

  private moveWithCollision(box: EntityBox, dx: number, dy: number): void {
    if (dx !== 0) {
      const nextX = box.x + dx;
      if (!this.collidesWithMap(nextX, box.y, box.w, box.h)) {
        box.x = nextX;
      }
    }
    if (dy !== 0) {
      const nextY = box.y + dy;
      if (!this.collidesWithMap(box.x, nextY, box.w, box.h)) {
        box.y = nextY;
      }
    }
  }

  private spawnBurst(cx: number, cy: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 35 + Math.random() * 85;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        color,
        size: 3 + Math.floor(Math.random() * 3),
      });
    }
  }

  triggerAttack(): void {
    if (this.status !== 'playing' || this.attackCooldownMs > 0) return;
    this.attackTimerMs = 170;
    this.attackCooldownMs = 310;
    soundEngine.slash();

    if (this.room === 2 && this.enemy.alive) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      const dist = Math.hypot(eCx - pCx, eCy - pCy);

      if (dist <= 44) {
        this.enemy.hp -= 1;
        this.enemy.hurtMs = 180;
        const nx = dist > 0.1 ? (eCx - pCx) / dist : this.player.facingX;
        const ny = dist > 0.1 ? (eCy - pCy) / dist : this.player.facingY;
        this.moveWithCollision(this.enemy, nx * 18, ny * 18);
        this.spawnBurst(eCx, eCy, this.dungeon.accentColor, 10);
        soundEngine.hitEnemy();

        if (this.enemy.hp <= 0) {
          this.enemy.alive = false;
          this.portalUnlocked = true;
          this.hintText = 'Inimigo derrotado! Entre no Portal Final a direita!';
          this.spawnBurst(eCx, eCy, '#ffd43b', 18);
          soundEngine.portalUnlock();
        }
        this.emitSnapshot();
      }
    }
  }

  update(dtSec: number, input: InputState): void {
    const dt = Math.min(0.05, Math.max(0.001, dtSec));
    this.animTime += dt;

    // Atualiza particulas mesmo apos vitoria
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (this.status !== 'playing') return;

    this.elapsedSec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    if (this.player.invulnMs > 0) this.player.invulnMs = Math.max(0, this.player.invulnMs - dt * 1000);
    if (this.player.hurtMs > 0) this.player.hurtMs = Math.max(0, this.player.hurtMs - dt * 1000);
    if (this.enemy.hurtMs > 0) this.enemy.hurtMs = Math.max(0, this.enemy.hurtMs - dt * 1000);
    if (this.enemy.attackCdMs > 0) this.enemy.attackCdMs = Math.max(0, this.enemy.attackCdMs - dt * 1000);
    if (this.attackTimerMs > 0) this.attackTimerMs = Math.max(0, this.attackTimerMs - dt * 1000);
    if (this.attackCooldownMs > 0) this.attackCooldownMs = Math.max(0, this.attackCooldownMs - dt * 1000);

    // Movimento do heroi
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      if (Math.abs(mx) > 0.1) this.player.facingX = mx >= 0 ? 1 : -1;
      this.player.facingY = my;
      const speed = 128;
      this.moveWithCollision(this.player, mx * speed * dt, my * speed * dt);
    }

    if (input.attackPressed) {
      this.triggerAttack();
    }

    // IA do inimigo na Sala 2
    if (this.room === 2 && this.enemy.alive) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const eCx = this.enemy.x + this.enemy.w / 2;
      const eCy = this.enemy.y + this.enemy.h / 2;
      const dx = pCx - eCx;
      const dy = pCy - eCy;
      const dist = Math.hypot(dx, dy);

      if (dist > 6) {
        const vx = (dx / dist) * this.dungeon.enemySpeed;
        const vy = (dy / dist) * this.dungeon.enemySpeed;
        this.moveWithCollision(this.enemy, vx * dt, vy * dt);
      }

      if (dist < 23 && this.player.invulnMs <= 0 && this.enemy.attackCdMs <= 0) {
        this.player.hp -= 1;
        this.player.invulnMs = 900;
        this.player.hurtMs = 220;
        this.enemy.attackCdMs = 700;
        soundEngine.hurtPlayer();
        this.spawnBurst(pCx, pCy, '#ff6b6b', 8);

        if (this.player.hp <= 0) {
          this.status = 'defeat';
          this.hintText = 'Voce caiu na dungeon! Tente novamente ou gere outro mapa.';
        } else {
          this.callbacks.onDamage(this.player.hp);
        }
        this.emitSnapshot();
      }
    }

    // Checa porta (Sala 1) ou Portal (Sala 2) no centro do jogador
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
        '#38d9a9',
        24,
      );
      this.callbacks.onVictory(this.dungeon.id, this.elapsedSec);
      this.emitSnapshot();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const pal = PALETTES[this.light];
    const map = this.getCurrentMap();

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Renderiza tiles do mapa
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = map[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // Chao quadriculado sutil
        ctx.fillStyle = (r + c) % 2 === 0 ? pal.floorA : pal.floorB;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        if (ch === '#') {
          ctx.fillStyle = pal.wallBorder;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 10);
          ctx.fillStyle = pal.wallFace;
          ctx.fillRect(x + 2, y + TILE_SIZE - 8, TILE_SIZE - 4, 6);
        } else if (ch === 'T') {
          ctx.fillStyle = pal.wallBorder;
          ctx.fillRect(x + 5, y + 4, TILE_SIZE - 10, TILE_SIZE - 8);
          ctx.fillStyle = pal.pillar;
          ctx.fillRect(x + 7, y + 6, TILE_SIZE - 14, TILE_SIZE - 14);
          // Braseiro no topo do pilar
          const flicker = Math.sin(this.animTime * 11 + c * 2) > 0 ? '#ffa94d' : '#ff6b6b';
          ctx.fillStyle = flicker;
          ctx.fillRect(x + 12, y + 8, 8, 6);
          ctx.fillStyle = pal.torchGlow;
          ctx.beginPath();
          ctx.arc(x + 16, y + 11, 18, 0, Math.PI * 2);
          ctx.fill();
        } else if (ch === 'D') {
          ctx.fillStyle = '#2b2118';
          ctx.fillRect(x + 4, y + 2, TILE_SIZE - 8, TILE_SIZE - 4);
          ctx.fillStyle = pal.doorOpen;
          ctx.fillRect(x + 8, y + 5, TILE_SIZE - 16, TILE_SIZE - 10);
          ctx.fillStyle = '#fff9db';
          ctx.fillRect(x + 14, y + 14, 4, 4);
        } else if (ch === 'O') {
          ctx.fillStyle = this.portalUnlocked ? pal.portalOpenA : pal.portalLocked;
          ctx.fillRect(x + 4, y + 3, TILE_SIZE - 8, TILE_SIZE - 6);
          if (this.portalUnlocked) {
            const pulse = Math.floor((Math.sin(this.animTime * 8) + 1) * 3);
            ctx.fillStyle = pal.portalOpenB;
            ctx.fillRect(x + 8 + pulse / 2, y + 7, TILE_SIZE - 16 - pulse, TILE_SIZE - 14);
          } else {
            ctx.fillStyle = '#868e96';
            ctx.fillRect(x + 11, y + 11, 10, 10);
          }
        }
      }
    }

    // 2. Renderiza inimigo
    if (this.room === 2 && this.enemy.alive) {
      const bob = Math.round(Math.sin(this.animTime * 7) * 1.5);
      drawEnemySprite(
        ctx,
        this.dungeon.enemyKind,
        this.enemy.x - 4,
        this.enemy.y - 4,
        this.light,
        this.enemy.hurtMs > 0,
        bob,
      );

      // Barra de vida do inimigo acima do sprite
      const barW = 28;
      const barX = this.enemy.x - 2;
      const barY = this.enemy.y - 8;
      ctx.fillStyle = '#11131a';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 6);
      ctx.fillStyle = '#fa5252';
      ctx.fillRect(barX, barY, Math.round((barW * this.enemy.hp) / this.enemy.maxHp), 4);
    }

    // 3. Renderiza heroi
    const walkBob = Math.round(Math.sin(this.animTime * 10) * 1);
    const blinkHide = this.player.invulnMs > 0 && Math.floor(this.player.invulnMs / 70) % 2 === 1;
    if (!blinkHide) {
      drawHeroSprite(
        ctx,
        this.player.x - 4,
        this.player.y - 4,
        this.player.facingX,
        this.player.hurtMs > 0,
        walkBob,
      );
    }

    // 4. Efeito visual de ataque da espada
    if (this.attackTimerMs > 0) {
      const pCx = this.player.x + this.player.w / 2;
      const pCy = this.player.y + this.player.h / 2;
      const sx = pCx + this.player.facingX * 16;
      const sy = pCy;
      ctx.strokeStyle = '#fff3bf';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        sx,
        sy,
        14,
        this.player.facingX > 0 ? -0.9 : Math.PI - 0.9,
        this.player.facingX > 0 ? 0.9 : Math.PI + 0.9,
      );
      ctx.stroke();
    }

    // 5. Particulas
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 6. Iluminacao dinamica quando LDR indica ambiente ESCURO ("dark")
    if (this.light === 'dark') {
      const heroCx = this.player.x + this.player.w / 2;
      const heroCy = this.player.y + this.player.h / 2;
      const torchRadius = 96 + Math.sin(this.animTime * 14) * 5;

      const grad = ctx.createRadialGradient(heroCx, heroCy, 24, heroCx, heroCy, torchRadius);
      grad.addColorStop(0, 'rgba(255, 169, 77, 0.04)');
      grad.addColorStop(0.55, 'rgba(10, 12, 22, 0.52)');
      grad.addColorStop(1, 'rgba(5, 6, 12, 0.86)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onStateChange(this.getSnapshot());
  }
}
