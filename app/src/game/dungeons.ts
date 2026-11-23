export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

export type EnemyKind = 'slime' | 'skeleton' | 'gargoyle';
export type BiomeKind = 'ruins' | 'crypt' | 'forge';

export interface DungeonDefinition {
  id: 1 | 2 | 3;
  name: string;
  subtitle: string;
  biome: BiomeKind;
  enemyKind: EnemyKind;
  enemyName: string;
  enemyMaxHp: number;
  enemySpeed: number;
  enemyFireRateMs: number;
  accentColor: string;
  room1: string[];
  room2: string[];
}

// Legenda dos mapas (16 colunas x 10 linhas):
// '#' = Parede 2.5D com tijolos e sombra
// 'B' = Braseiro/Tocha iluminada (obstaculo)
// 'T' = Caixa/Pilar decorativo (obstaculo)
// ',' = Tapete/Trilha central decorativa (chao livre)
// '.' = Chao de pedra (chao livre com variacao procedural)
// 'P' = Spawn do heroi
// 'D' = Arco/Porta dourada (Sala 1 -> Sala 2)
// 'E' = Spawn do chefe da sala (Sala 2)
// 'O' = Portal runico final (Sala 2)
export const DUNGEONS: Record<1 | 2 | 3, DungeonDefinition> = {
  1: {
    id: 1,
    name: 'Cripta das Pedras',
    subtitle: 'Ruinas com musgo guardadas pelo Slime Rei',
    biome: 'ruins',
    enemyKind: 'slime',
    enemyName: 'Slime Acido',
    enemyMaxHp: 6,
    enemySpeed: 64,
    enemyFireRateMs: 1950,
    accentColor: '#38d9a9',
    room1: [
      '################',
      '#....B....B....#',
      '#.P......TT....#',
      '#..............#',
      '#.,T,........,D#',
      '#.,T,........,D#',
      '#..............#',
      '#........TT....#',
      '#....B....B....#',
      '################',
    ],
    room2: [
      '################',
      '#...B......B...#',
      '#.P............#',
      '#.....T..T.....#',
      '#.,..........,.#',
      '#.,......E...,O#',
      '#.....T..T...,O#',
      '#..............#',
      '#...B......B...#',
      '################',
    ],
  },
  2: {
    id: 2,
    name: 'Catacumba de Ossos',
    subtitle: 'Salao gotico patrulhado pelo Esqueleto Cavaleiro',
    biome: 'crypt',
    enemyKind: 'skeleton',
    enemyName: 'Esqueleto Cavaleiro',
    enemyMaxHp: 8,
    enemySpeed: 76,
    enemyFireRateMs: 1650,
    accentColor: '#b197fc',
    room1: [
      '################',
      '#..B...##...B..#',
      '#.P....##......#',
      '#..........T...#',
      '#.,,T,,,,,...,,D',
      '#.,,,,,,,,...,,D',
      '#...T......T...#',
      '#......##......#',
      '#..B...##...B..#',
      '################',
    ],
    room2: [
      '################',
      '#..B........B..#',
      '#.P....T.......#',
      '#..............#',
      '#.,,,,.....E.,,O',
      '#.,,,,.......,,O',
      '#......T.......#',
      '#..............#',
      '#..B...T....B..#',
      '################',
    ],
  },
  3: {
    id: 3,
    name: 'Forja Sombria',
    subtitle: 'Camara de magma protegida pela Gargula de Ferro',
    biome: 'forge',
    enemyKind: 'gargoyle',
    enemyName: 'Gargula de Ferro',
    enemyMaxHp: 10,
    enemySpeed: 84,
    enemyFireRateMs: 1450,
    accentColor: '#ff6b6b',
    room1: [
      '################',
      '#..B.#....#.B..#',
      '#.P..#....#....#',
      '#..............#',
      '#.,,TT,,,,..,,D#',
      '#.,,TT,,,,..,,D#',
      '#..............#',
      '#....#....#....#',
      '#..B.#....#.B..#',
      '################',
    ],
    room2: [
      '################',
      '#..B...T....B..#',
      '#.P............#',
      '#...T......T...#',
      '#.,....E.....,O#',
      '#.,..........,O#',
      '#...T......T...#',
      '#..............#',
      '#..B...T....B..#',
      '################',
    ],
  },
};

export function getDungeonById(id: number): DungeonDefinition {
  if (id === 2) return DUNGEONS[2];
  if (id === 3) return DUNGEONS[3];
  return DUNGEONS[1];
}
