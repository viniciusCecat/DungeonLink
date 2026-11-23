import type { LightState } from '../ble/protocol';
import type { EnemyKind } from './dungeons';

export interface ThemePalette {
  bg: string;
  floorA: string;
  floorB: string;
  wallTop: string;
  wallFace: string;
  wallBorder: string;
  pillar: string;
  torchGlow: string;
  doorLocked: string;
  doorOpen: string;
  portalLocked: string;
  portalOpenA: string;
  portalOpenB: string;
}

export const PALETTES: Record<LightState, ThemePalette> = {
  bright: {
    bg: '#1c2434',
    floorA: '#5f6f87',
    floorB: '#53627a',
    wallTop: '#8e9eb5',
    wallFace: '#435066',
    wallBorder: '#2a3342',
    pillar: '#707e94',
    torchGlow: 'rgba(255, 198, 92, 0.28)',
    doorLocked: '#a87c4f',
    doorOpen: '#ffd166',
    portalLocked: '#495057',
    portalOpenA: '#22b8cf',
    portalOpenB: '#ffd43b',
  },
  dark: {
    bg: '#080a10',
    floorA: '#23283b',
    floorB: '#1c2030',
    wallTop: '#363d57',
    wallFace: '#161a29',
    wallBorder: '#0b0d14',
    pillar: '#2d3348',
    torchGlow: 'rgba(255, 136, 36, 0.45)',
    doorLocked: '#5c4028',
    doorOpen: '#f59f00',
    portalLocked: '#2b2f3d',
    portalOpenA: '#9775fa',
    portalOpenB: '#38d9a9',
  },
};

function drawPixelMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
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
      const drawCol = flipX ? cols - 1 - c : c;
      ctx.fillRect(Math.round(x + drawCol * scale), Math.round(y + r * scale), scale, scale);
    }
  }
}

const HERO_SPRITE = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '...HHSSSSHH...',
  '...HSSKKSSH...',
  '...HSSSSSSH...',
  '....BBBBBB....',
  '..CCBBBBBBCC..',
  '.CCCBBBBBBCCC.',
  '.CC.BBYYBB.CC.',
  '....BBBBBB....',
  '....DD..DD....',
  '....DD..DD....',
  '...KKK..KKK...',
];

const SLIME_SPRITE = [
  '..............',
  '.....GGGG.....',
  '...GGGGGGGG...',
  '..GGGLLLLGGG..',
  '.GGGLLGGLLGGG.',
  '.GGKKGGGGKKGG.',
  '.GGGGGGGGGGGG.',
  'GGGGGGGGGGGGGG',
  'GGGGDDDDDDGGGG',
  'GGGGDDDDDDGGGG',
  '.GGGGGGGGGGGG.',
  '..DDDDDDDDDD..',
];

const SKELETON_SPRITE = [
  '....WWWWWW....',
  '...WWWWWWWW...',
  '...WWKKWWKK...',
  '...WWWWWWWW...',
  '....WWKKWW....',
  '...RRRRRRRR...',
  '..RRWWKKWWRR..',
  '..R.WWWWWW.R..',
  '....WW..WW....',
  '....WW..WW....',
  '...WW....WW...',
  '..KKK....KKK..',
];

const GARGOYLE_SPRITE = [
  '.P..........P.',
  'PP...PPPP...PP',
  'PPP.PPPPPP.PPP',
  '.PPPRRPPPRRPP.',
  '..PPPPPPPPPP..',
  '..PDDDDDDDDP..',
  '..PDDGGGGDDP..',
  '...DDDDDDDD...',
  '....DD..DD....',
  '...PPP..PPP...',
  '..KKK....KKK..',
];

export function drawHeroSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingX: number,
  hurtFlash: boolean,
  walkBob: number,
): void {
  const palette: Record<string, string> = hurtFlash
    ? { H: '#ffffff', S: '#ffffff', K: '#ff8787', B: '#ffffff', C: '#ffffff', Y: '#ffffff', D: '#ffffff' }
    : {
        H: '#ced4da', // capacete
        S: '#ffd8a8', // rosto
        K: '#1f2430', // olhos/botas
        B: '#3b5bdb', // armadura azul
        C: '#e03131', // capa vermelha
        Y: '#fcc419', // cinto dourado
        D: '#364fc7', // pernas
      };
  drawPixelMatrix(ctx, HERO_SPRITE, palette, x + 2, y + 3 + walkBob, 2, facingX < 0);
}

export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  x: number,
  y: number,
  light: LightState,
  hurtFlash: boolean,
  bob: number,
): void {
  if (hurtFlash) {
    const whitePal: Record<string, string> = {
      G: '#ffffff', L: '#ffffff', K: '#ffe3e3', D: '#ffffff',
      W: '#ffffff', R: '#ffffff', P: '#ffffff',
    };
    const mat = kind === 'slime' ? SLIME_SPRITE : kind === 'skeleton' ? SKELETON_SPRITE : GARGOYLE_SPRITE;
    drawPixelMatrix(ctx, mat, whitePal, x + 2, y + 4 + bob, 2, false);
    return;
  }

  if (kind === 'slime') {
    drawPixelMatrix(
      ctx,
      SLIME_SPRITE,
      {
        G: light === 'dark' ? '#20c997' : '#2b8a3e',
        L: '#96f2d7',
        D: '#0ca678',
        K: light === 'dark' ? '#ff6b6b' : '#1b1f29',
      },
      x + 2,
      y + 5 + bob,
      2,
      false,
    );
    return;
  }

  if (kind === 'skeleton') {
    drawPixelMatrix(
      ctx,
      SKELETON_SPRITE,
      {
        W: '#f1f3f5',
        K: light === 'dark' ? '#ff922b' : '#1c1f29',
        R: '#862e9c',
      },
      x + 2,
      y + 4 + bob,
      2,
      false,
    );
    return;
  }

  drawPixelMatrix(
    ctx,
    GARGOYLE_SPRITE,
    {
      P: '#5c5f66',
      D: '#343a40',
      R: '#ff6b6b',
      G: '#ffa94d',
      K: '#181a20',
    },
    x + 2,
    y + 4 + bob,
    2,
    false,
  );
}
