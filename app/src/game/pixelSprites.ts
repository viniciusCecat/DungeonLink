import type { BiomeKind, EnemyKind } from './dungeons';
import type { WeaponId } from './items';

/**
 * Banco procedural de texturas e sprites em pixel-art estilo Soul Knight
 * (contornos escuros grossos, tiles 2.5D com topo/face/sombra, 3 biomas distintos,
 * 2 quadros de animacao por personagem e cache em canvas offscreen para 60fps constantes).
 */

export interface BiomePalette {
  bg: string;
  floorBase: string;
  floorAlt: string;
  floorGroove: string;
  floorAccent: string;
  carpetA: string;
  carpetB: string;
  carpetTrim: string;
  wallCap: string;
  wallCapHi: string;
  wallFace: string;
  wallFaceDark: string;
  wallOutline: string;
  propMain: string;
  propHi: string;
  propDark: string;
  flameCore: string;
  flameMid: string;
  flameGlow: string;
  portalA: string;
  portalB: string;
}

export const BIOME_PALETTES: Record<BiomeKind, BiomePalette> = {
  ruins: {
    bg: '#131622',
    floorBase: '#5b6b7d',
    floorAlt: '#516072',
    floorGroove: '#3e4a59',
    floorAccent: '#4d7c5f', // musgo sutil
    carpetA: '#3d5a6c',
    carpetB: '#355061',
    carpetTrim: '#74c0fc',
    wallCap: '#7d8fa4',
    wallCapHi: '#a3b5ca',
    wallFace: '#414f61',
    wallFaceDark: '#2c3645',
    wallOutline: '#12151f',
    propMain: '#9c6644',
    propHi: '#c88c5c',
    propDark: '#5e3a24',
    flameCore: '#fff3bf',
    flameMid: '#ff922b',
    flameGlow: 'rgba(255, 169, 77, 0.35)',
    portalA: '#22b8cf',
    portalB: '#63e6be',
  },
  crypt: {
    bg: '#110e1c',
    floorBase: '#48435e',
    floorAlt: '#3f3a54',
    floorGroove: '#2d283e',
    floorAccent: '#635b82',
    carpetA: '#7a2846',
    carpetB: '#66203a',
    carpetTrim: '#f59f00',
    wallCap: '#6d658a',
    wallCapHi: '#938ab3',
    wallFace: '#38324d',
    wallFaceDark: '#231f33',
    wallOutline: '#100d1a',
    propMain: '#76708f',
    propHi: '#a59ec2',
    propDark: '#474259',
    flameCore: '#e5dbff',
    flameMid: '#9775fa',
    flameGlow: 'rgba(151, 117, 250, 0.38)',
    portalA: '#9775fa',
    portalB: '#f783ac',
  },
  forge: {
    bg: '#160d0f',
    floorBase: '#4a3c42',
    floorAlt: '#403338',
    floorGroove: '#2b2125',
    floorAccent: '#e8590c', // veios de brasa
    carpetA: '#5c2b29',
    carpetB: '#4d2220',
    carpetTrim: '#ff922b',
    wallCap: '#6b555a',
    wallCapHi: '#8f7279',
    wallFace: '#3d2c31',
    wallFaceDark: '#261a1e',
    wallOutline: '#140c0e',
    propMain: '#524b52',
    propHi: '#7d737d',
    propDark: '#2e292e',
    flameCore: '#fff3bf',
    flameMid: '#ff5722',
    flameGlow: 'rgba(255, 107, 53, 0.42)',
    portalA: '#ff922b',
    portalB: '#ffd43b',
  },
};

function makeOffscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function drawMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: string[],
  palette: Record<string, string>,
  ox = 0,
  oy = 0,
  scale = 2,
  flipX = false,
): void {
  const rows = matrix.length;
  const cols = matrix[0].length;
  for (let r = 0; r < rows; r++) {
    const line = matrix[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      const dc = flipX ? cols - 1 - c : c;
      ctx.fillRect(ox + dc * scale, oy + r * scale, scale, scale);
    }
  }
}

// ============================================================
// Sprites Chibi estilo Soul Knight (16x16 com contorno #12101a)
// ============================================================
const HERO_FRAME_0 = [
  '......OOOO......',
  '.....ORRRRO.....',
  '....OOHHHHOO....',
  '...OHHWWWWWHO...',
  '...OHKKKKKKHO...',
  '...OHKCKKCKHO...',
  '...OHHSSSSWHO...',
  '....OOOOOOOO....',
  '...OOBBYYBBOO...',
  '..OROBBBBBBORO..',
  '..OROBBYYBBORO..',
  '..OO.OBBBBO.OO..',
  '.....OD..DO.....',
  '.....OD..DO.....',
  '....OOO..OOO....',
  '................',
];

const HERO_FRAME_1 = [
  '................',
  '......OOOO......',
  '.....ORRRRO.....',
  '....OOHHHHOO....',
  '...OHHWWWWWHO...',
  '...OHKKKKKKHO...',
  '...OHKCKKCKHO...',
  '...OHHSSSSWHO...',
  '....OOOOOOOO....',
  '..OORBBYYBBROO..',
  '..OROBBBBBBORO..',
  '...O.OBBBBO.O...',
  '....OD....DO....',
  '....OOO..OOO....',
  '................',
  '................',
];

const SLIME_FRAME_0 = [
  '................',
  '......OOOO......',
  '.....OYYYYO.....',
  '....OOOGGOOO....',
  '...OGGLLLLGGO...',
  '..OGGLWWWWLGGO..',
  '..OGGLLLLLLGGO..',
  '.OGGGOOGGOOGGGO.',
  '.OGGGOOGGOOGGGO.',
  '.OGGGGGGGGGGGGO.',
  '.OGGDDDDDDDDGGO.',
  '.OGDDDDDDDDDDGO.',
  '..ODDDDDDDDDDO..',
  '...OOOOOOOOOO...',
  '................',
  '................',
];

const SLIME_FRAME_1 = [
  '................',
  '................',
  '.....OOOOOO.....',
  '....OYYYYYYO....',
  '...OOGGGGGGOO...',
  '..OGGLLLLLLGGO..',
  '.OGGLWWLLLLGGGO.',
  '.OGGGOOGGOOGGGO.',
  'OGGGGOOGGOOGGGGO',
  'OGGGGGGGGGGGGGGO',
  'OGGGDDDDDDDDGGGO',
  '.OGDDDDDDDDDDGO.',
  '..ODDDDDDDDDDO..',
  '...OOOOOOOOOO...',
  '................',
  '................',
];

const SKELETON_FRAME_0 = [
  '....OOOOOOOO....',
  '...OHHHHHHHHO...',
  '..OHWWWWWWWWHO..',
  '..OWWWWWWWWWWO..',
  '..OWWEEWWEEWWO..',
  '..OWWWWWWWWWWO..',
  '...OWWOOOOOWO...',
  '....OOOOOOOO....',
  '..OOPPWWWWPPOO..',
  '.OPPPWOOOOOWPPO.',
  '.OP.OWWWWWWO.PO.',
  '....OWW..WWO....',
  '....OW....WO....',
  '...OOO....OOO...',
  '................',
  '................',
];

const SKELETON_FRAME_1 = [
  '................',
  '....OOOOOOOO....',
  '...OHHHHHHHHO...',
  '..OHWWWWWWWWHO..',
  '..OWWWWWWWWWWO..',
  '..OWWEEWWEEWWO..',
  '..OWWWWWWWWWWO..',
  '...OWWOOOOOWO...',
  '....OOOOOOOO....',
  '.OOPPPWWWWPPPOO.',
  '.OPP.WOOOOOW.PO.',
  '.....OWWWWO.....',
  '...OWW....WWO...',
  '...OOO....OOO...',
  '................',
  '................',
];

const GARGOYLE_FRAME_0 = [
  '.OO..........OO.',
  'OSSO..OOOO..OSSO',
  'OSSSSOSSSSOSSSSO',
  'OSSSSSSDDSSSSSSO',
  '.OSSSSEEEESSSSO.',
  '..OSSDSSSSDSSO..',
  '..OSSDDDDDDSSO..',
  '...ODGGGGGGDO...',
  '...ODDDDDDDDO...',
  '....ODDDDDDO....',
  '....OD....DO....',
  '...OOO....OOO...',
  '................',
  '................',
  '................',
  '................',
];

const GARGOYLE_FRAME_1 = [
  '................',
  '......OOOO......',
  '.OO..OSSSSO..OO.',
  'OSSO.SSDDSS.OSSO',
  'OSSSOSEEEESOSSSO',
  '.OSSSSSDDDSSSSO.',
  '..OSSDGGGGDSSO..',
  '...ODDDDDDDDO...',
  '....ODDDDDDO....',
  '....OD....DO....',
  '...OOO....OOO...',
  '................',
  '................',
  '................',
  '................',
  '................',
];

interface BiomeTileset {
  floors: HTMLCanvasElement[];
  carpet: HTMLCanvasElement;
  wall: HTMLCanvasElement;
  prop: HTMLCanvasElement;
}

const tilesetCache = new Map<BiomeKind, BiomeTileset>();

function createFloorTile(pal: BiomePalette, variant: number): HTMLCanvasElement {
  const [c, ctx] = makeOffscreen(32, 32);
  ctx.fillStyle = variant % 2 === 0 ? pal.floorBase : pal.floorAlt;
  ctx.fillRect(0, 0, 32, 32);

  // Juntas de lajota estilo Soul Knight
  ctx.fillStyle = pal.floorGroove;
  ctx.fillRect(0, 30, 32, 2);
  ctx.fillRect(30, 0, 2, 32);

  // Highlight sutil no topo esquerdo do bloco
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(2, 2, 26, 2);
  ctx.fillRect(2, 2, 2, 26);

  if (variant === 1) {
    // Pequena rachadura
    ctx.fillStyle = pal.floorGroove;
    ctx.fillRect(8, 10, 6, 2);
    ctx.fillRect(12, 12, 2, 6);
    ctx.fillRect(14, 16, 4, 2);
  } else if (variant === 2) {
    // Detalhe do bioma (musgo / runa / veio de brasa)
    ctx.fillStyle = pal.floorAccent;
    ctx.fillRect(6, 20, 6, 4);
    ctx.fillRect(10, 18, 4, 2);
    ctx.fillRect(20, 8, 4, 4);
  } else if (variant === 3) {
    // Pedrinhas / divisao interna
    ctx.fillStyle = pal.floorGroove;
    ctx.fillRect(0, 14, 32, 2);
    ctx.fillRect(14, 0, 2, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(18, 18, 6, 4);
  }
  return c;
}

function createCarpetTile(pal: BiomePalette): HTMLCanvasElement {
  const [c, ctx] = makeOffscreen(32, 32);
  ctx.fillStyle = pal.carpetA;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = pal.carpetB;
  ctx.fillRect(4, 4, 24, 24);
  ctx.fillStyle = pal.carpetTrim;
  ctx.fillRect(0, 2, 32, 2);
  ctx.fillRect(0, 28, 32, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(12, 12, 8, 8);
  return c;
}

function createWallTile(pal: BiomePalette): HTMLCanvasElement {
  const [c, ctx] = makeOffscreen(32, 32);
  // Contorno externo escuro
  ctx.fillStyle = pal.wallOutline;
  ctx.fillRect(0, 0, 32, 32);

  // Topo 2.5D da parede (16px)
  ctx.fillStyle = pal.wallCap;
  ctx.fillRect(2, 2, 28, 14);
  ctx.fillStyle = pal.wallCapHi;
  ctx.fillRect(2, 2, 28, 3);
  ctx.fillStyle = pal.wallOutline;
  ctx.fillRect(15, 2, 2, 14);

  // Face frontal de tijolos (14px)
  ctx.fillStyle = pal.wallFace;
  ctx.fillRect(2, 17, 28, 13);
  ctx.fillStyle = pal.wallFaceDark;
  ctx.fillRect(2, 24, 28, 6);
  // Rejuntes de tijolos alternados
  ctx.fillStyle = pal.wallOutline;
  ctx.fillRect(2, 23, 28, 2);
  ctx.fillRect(10, 17, 2, 6);
  ctx.fillRect(22, 17, 2, 6);
  ctx.fillRect(16, 25, 2, 5);
  return c;
}

function createPropTile(pal: BiomePalette, biome: BiomeKind): HTMLCanvasElement {
  const [c, ctx] = makeOffscreen(32, 32);
  // Sombra na base
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(4, 26, 24, 5);

  // Corpo (caixa de madeira nas ruinas; pilar runico na cripta/forja)
  ctx.fillStyle = pal.wallOutline;
  ctx.fillRect(3, 3, 26, 25);
  ctx.fillStyle = pal.propMain;
  ctx.fillRect(5, 5, 22, 21);
  ctx.fillStyle = pal.propHi;
  ctx.fillRect(5, 5, 22, 5);
  ctx.fillStyle = pal.propDark;
  ctx.fillRect(5, 20, 22, 6);

  if (biome === 'ruins') {
    // Tabuas cruzadas de caixa estilo Soul Knight
    ctx.fillStyle = pal.propDark;
    ctx.fillRect(5, 13, 22, 2);
    ctx.fillRect(15, 5, 2, 21);
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(7, 7, 4, 2);
    ctx.fillRect(21, 7, 4, 2);
  } else {
    // Runa brilhante no centro do pilar
    ctx.fillStyle = pal.flameMid;
    ctx.fillRect(13, 12, 6, 6);
    ctx.fillStyle = pal.flameCore;
    ctx.fillRect(15, 14, 2, 2);
  }
  return c;
}

export function getBiomeTileset(biome: BiomeKind): BiomeTileset {
  const existing = tilesetCache.get(biome);
  if (existing) return existing;
  const pal = BIOME_PALETTES[biome];
  const ts: BiomeTileset = {
    floors: [0, 1, 2, 3].map((v) => createFloorTile(pal, v)),
    carpet: createCarpetTile(pal),
    wall: createWallTile(pal),
    prop: createPropTile(pal, biome),
  };
  tilesetCache.set(biome, ts);
  return ts;
}

const glowStampCache = new Map<string, HTMLCanvasElement>();
let lightHoleStamp: HTMLCanvasElement | null = null;

export function getGlowStamp(color: string): HTMLCanvasElement {
  const cached = glowStampCache.get(color);
  if (cached) return cached;
  const [c, ctx] = makeOffscreen(64, 64);
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowStampCache.set(color, c);
  return c;
}

export function getLightHoleStamp(): HTMLCanvasElement {
  if (lightHoleStamp) return lightHoleStamp;
  const [c, ctx] = makeOffscreen(128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.68)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  lightHoleStamp = c;
  return c;
}

export function drawBrazier(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pal: BiomePalette,
  t: number,
): void {
  // Base de ferro
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 6, y + 25, 20, 5);
  ctx.fillStyle = '#12151f';
  ctx.fillRect(x + 7, y + 12, 18, 15);
  ctx.fillStyle = '#495057';
  ctx.fillRect(x + 9, y + 14, 14, 11);
  ctx.fillStyle = '#868e96';
  ctx.fillRect(x + 9, y + 14, 14, 3);

  // Chama animada pixel-art
  const sway = Math.round(Math.sin(t * 14 + x * 0.1) * 1.5);
  const tall = Math.sin(t * 19 + y * 0.2) > 0 ? 2 : 0;
  ctx.fillStyle = pal.flameMid;
  ctx.fillRect(x + 10 + sway, y + 6 - tall, 12, 10 + tall);
  ctx.fillRect(x + 12 + sway, y + 3 - tall, 8, 5);
  ctx.fillStyle = pal.flameCore;
  ctx.fillRect(x + 13 + sway, y + 8 - Math.floor(tall / 2), 6, 7);

  // Glow pre-renderizado (zero alocacao de gradiente por frame -> 60fps liso no Android)
  const glow = getGlowStamp(pal.flameGlow);
  ctx.drawImage(glow, x - 12, y - 16, 56, 56);
}

export function drawChestTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opened: boolean,
  t: number,
): void {
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(x + 4, y + 24, 24, 5);

  if (opened) {
    ctx.fillStyle = '#12101a';
    ctx.fillRect(x + 4, y + 9, 24, 18);
    ctx.fillStyle = '#5c3d24';
    ctx.fillRect(x + 6, y + 11, 20, 14);
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(x + 8, y + 13, 16, 6);
    ctx.fillStyle = '#fab005';
    ctx.fillRect(x + 6, y + 18, 20, 2);
    return;
  }

  const bounce = Math.sin(t * 5) > 0.75 ? -1 : 0;
  const glow = getGlowStamp('rgba(255, 212, 59, 0.36)');
  ctx.drawImage(glow, x - 10, y - 10 + bounce, 52, 52);

  // Bau fechado dourado estilo Soul Knight
  ctx.fillStyle = '#12101a';
  ctx.fillRect(x + 4, y + 7 + bounce, 24, 20);
  ctx.fillStyle = '#8d5524';
  ctx.fillRect(x + 6, y + 9 + bounce, 20, 16);
  ctx.fillStyle = '#b57035';
  ctx.fillRect(x + 6, y + 9 + bounce, 20, 6);
  // Faixas douradas e fechadura
  ctx.fillStyle = '#fcc419';
  ctx.fillRect(x + 6, y + 14 + bounce, 20, 3);
  ctx.fillRect(x + 9, y + 9 + bounce, 2, 16);
  ctx.fillRect(x + 21, y + 9 + bounce, 2, 16);
  ctx.fillStyle = '#fff3bf';
  ctx.fillRect(x + 14, y + 13 + bounce, 4, 5);
}

export function drawDoorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
): void {
  ctx.fillStyle = '#12151f';
  ctx.fillRect(x + 2, y + 1, 28, 30);
  ctx.fillStyle = '#6c4f2e';
  ctx.fillRect(x + 4, y + 3, 24, 26);
  const pulse = 0.7 + 0.3 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(255, 212, 59, ${pulse.toFixed(2)})`;
  ctx.fillRect(x + 8, y + 6, 16, 20);
  ctx.fillStyle = '#fff9db';
  ctx.fillRect(x + 13, y + 12, 6, 8);
}

export function drawPortalTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pal: BiomePalette,
  unlocked: boolean,
  t: number,
): void {
  ctx.fillStyle = '#12151f';
  ctx.fillRect(x + 2, y + 2, 28, 28);

  if (!unlocked) {
    ctx.fillStyle = '#343a40';
    ctx.fillRect(x + 4, y + 4, 24, 24);
    ctx.fillStyle = '#495057';
    ctx.fillRect(x + 7, y + 7, 18, 18);
    // Cadeado runico
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(x + 12, y + 10, 8, 4);
    ctx.fillStyle = '#f59f00';
    ctx.fillRect(x + 11, y + 14, 10, 8);
    return;
  }

  // Portal magico giratorio estilo Soul Knight (usando glow pre-renderizado)
  const cx = x + 16;
  const cy = y + 16;
  const glow = getGlowStamp(pal.portalA);
  ctx.drawImage(glow, x - 12, y - 12, 56, 56);
  ctx.fillStyle = pal.portalB;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 2.8);
  ctx.strokeStyle = pal.portalB;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.rotate(-t * 5.2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-5, -5, 10, 10);
  ctx.restore();
}

export function drawHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  aimAngle: number,
  moving: boolean,
  hurtFlash: boolean,
  dashActive: boolean,
  attackProgress: number, // 0 = idle, >0 = swinging (0..1)
  t: number,
  weaponId: WeaponId = 'rune_sword',
  armorTint = '#3b5bdb',
): void {
  const flipX = Math.cos(aimAngle) < 0;
  const frame = moving && Math.floor(t * 10) % 2 === 1 ? HERO_FRAME_1 : HERO_FRAME_0;
  const bob = moving ? Math.round(Math.sin(t * 16) * 1.2) : Math.round(Math.sin(t * 4) * 0.6);

  // Sombra oval suave no chao
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(x + 11, y + 23, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const pal: Record<string, string> = hurtFlash
    ? { O: '#ffffff', R: '#ffffff', H: '#ffffff', W: '#ffffff', K: '#ff8787', C: '#ffffff', S: '#ffffff', B: '#ffffff', Y: '#ffffff', D: '#ffffff' }
    : dashActive
      ? { O: '#12101a', R: '#66d9e8', H: '#99e9f2', W: '#e3fafc', K: '#15aabf', C: '#ffffff', S: '#ffe8cc', B: '#22b8cf', Y: '#ffd43b', D: '#0c8599' }
      : {
          O: '#12101a', // contorno grosso Soul Knight
          R: '#e03131', // pluma/capa vermelha
          H: '#adb5bd', // capacete
          W: '#f1f3f5', // brilho do capacete
          K: '#1a1d2b', // visor escuro
          C: '#74c0fc', // olhos brilhantes no visor
          S: '#ffd8a8', // queixo
          B: armorTint, // armadura equipada!
          Y: '#fcc419', // cinto/emblema dourado
          D: armorTint, // pernas combinando com armadura
        };

  drawMatrix(ctx, frame, pal, Math.round(x - 5), Math.round(y - 6 + bob), 2, flipX);

  // Arma equipada na mao e rotacionada na direcao da mira
  const handX = x + 11 + (flipX ? -4 : 4);
  const handY = y + 13 + bob;
  const swingAmp = weaponId === 'elf_bow' || weaponId === 'flame_staff' ? 0.35 : 1.45;
  const swingOffset =
    attackProgress > 0 ? Math.sin(attackProgress * Math.PI) * (flipX ? -swingAmp : swingAmp) : 0;

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(aimAngle + swingOffset);

  if (weaponId === 'elf_bow') {
    // Arco Elfico verde/madeira
    ctx.strokeStyle = '#12101a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(4, 0, 10, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = '#9c6644';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 0, 10, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = '#b2f2bb';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, -9);
    ctx.lineTo(8, 9);
    ctx.stroke();
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(6, -1, 12, 2);
  } else if (weaponId === 'flame_staff') {
    // Cajado Flamejante
    ctx.fillStyle = '#12101a';
    ctx.fillRect(-3, -2, 18, 5);
    ctx.fillStyle = '#7950f2';
    ctx.fillRect(-2, -1, 16, 3);
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(16, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath();
    ctx.arc(16, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (weaponId === 'forge_axe') {
    // Machado Pesado da Forja
    ctx.fillStyle = '#12101a';
    ctx.fillRect(-3, -2, 18, 5);
    ctx.fillStyle = '#8d5524';
    ctx.fillRect(-2, -1, 16, 3);
    ctx.fillStyle = '#12101a';
    ctx.fillRect(10, -9, 10, 18);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(12, -7, 6, 14);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(16, -6, 2, 12);
  } else {
    // Espada Runica padrao
    ctx.fillStyle = '#12101a';
    ctx.fillRect(-2, -3, 6, 6);
    ctx.fillStyle = '#fcc419';
    ctx.fillRect(0, -2, 3, 4);
    ctx.fillStyle = '#fab005';
    ctx.fillRect(3, -5, 3, 10);
    ctx.fillStyle = '#12101a';
    ctx.fillRect(6, -3, 15, 6);
    ctx.fillStyle = '#e7f5ff';
    ctx.fillRect(6, -2, 13, 2);
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(6, 0, 13, 2);
  }
  ctx.restore();
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  x: number,
  y: number,
  hurtFlash: boolean,
  t: number,
): void {
  const frameIdx = Math.floor(t * 6) % 2;
  const bob = Math.round(Math.sin(t * 8) * 1.5);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 25, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const mat =
    kind === 'slime'
      ? frameIdx === 0
        ? SLIME_FRAME_0
        : SLIME_FRAME_1
      : kind === 'skeleton'
        ? frameIdx === 0
          ? SKELETON_FRAME_0
          : SKELETON_FRAME_1
        : frameIdx === 0
          ? GARGOYLE_FRAME_0
          : GARGOYLE_FRAME_1;

  if (hurtFlash) {
    const white: Record<string, string> = {
      O: '#ffffff', Y: '#ffffff', G: '#ffffff', L: '#ffffff', W: '#ffffff',
      D: '#ffffff', H: '#ffffff', E: '#ff8787', P: '#ffffff', S: '#ffffff',
    };
    drawMatrix(ctx, mat, white, Math.round(x - 4), Math.round(y - 6 + bob), 2, false);
    return;
  }

  if (kind === 'slime') {
    drawMatrix(
      ctx,
      mat,
      {
        O: '#12101a',
        Y: '#ffd43b', // coroa dourada
        G: '#20c997',
        L: '#96f2d7',
        W: '#e6fcf5',
        D: '#099268',
      },
      Math.round(x - 4),
      Math.round(y - 6 + bob),
      2,
      false,
    );
    return;
  }

  if (kind === 'skeleton') {
    drawMatrix(
      ctx,
      mat,
      {
        O: '#12101a',
        H: '#868e96',
        W: '#f8f9fa',
        E: '#ff6b6b', // olhos vermelhos brilhantes
        P: '#9c36b5', // capa roxa
      },
      Math.round(x - 4),
      Math.round(y - 6 + bob),
      2,
      false,
    );
    return;
  }

  drawMatrix(
    ctx,
    mat,
    {
      O: '#12101a',
      S: '#5c5f66',
      D: '#343a40',
      E: '#ff5722', // olhos de brasa
      G: '#ffa94d', // nucleo de magma no peito
    },
    Math.round(x - 4),
    Math.round(y - 6 + bob),
    2,
    false,
  );
}
