export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

export type EnemyKind = 'slime' | 'skeleton' | 'gargoyle' | 'goblin' | 'bat' | 'imp';
export type BiomeKind = 'ruins' | 'crypt' | 'forge';

export interface DungeonDefinition {
  id: 1 | 2 | 3;
  name: string;
  subtitle: string;
  biome: BiomeKind;
  bossKind: 'slime' | 'skeleton' | 'gargoyle';
  minionKind: 'goblin' | 'bat' | 'imp';
  bossName: string;
  minionName: string;
  bossMaxHp: number;
  minionMaxHp: number;
  enemySpeed: number;
  enemyFireRateMs: number;
  accentColor: string;
  rooms: [string[], string[], string[]];
  pvpArena: string[];
}

// Legenda dos mapas (16 colunas x 10 linhas):
// '#' = Parede 2.5D com tijolos e sombra
// 'B' = Braseiro/Tocha iluminada (obstaculo)
// 'T' = Caixa/Pilar decorativo (obstaculo)
// ',' = Tapete/Trilha central decorativa (chao livre)
// '.' = Chao de pedra
// 'P' = Spawn do Jogador 1
// 'Q' = Spawn do Jogador 2 (CO-OP / X1)
// 'C' = Bau de tesouro interativo
// 'm' = Inimigo intermediario (guarda/minion)
// 'E' = Chefe da masmorra (Sala 3)
// 'D' = Porta dourada (abre apos limpar inimigos da sala!)
// 'O' = Portal runico final (Sala 3)
export const DUNGEONS: Record<1 | 2 | 3, DungeonDefinition> = {
  1: {
    id: 1,
    name: 'Cripta das Pedras',
    subtitle: 'Ruinas com musgo guardadas por Goblins e o Slime Rei',
    biome: 'ruins',
    bossKind: 'slime',
    minionKind: 'goblin',
    bossName: 'Slime Rei Ácido',
    minionName: 'Goblin Batedor',
    bossMaxHp: 10,
    minionMaxHp: 3,
    enemySpeed: 64,
    enemyFireRateMs: 1850,
    accentColor: '#38d9a9',
    rooms: [
      [
        '################',
        '#...B......B...#',
        '#.P....T.......#',
        '#..Q....C...m..#',
        '#.,,,,,,,,,,.,D#',
        '#.,,,,,,,,,,.,D#',
        '#...........m..#',
        '#......T.......#',
        '#...B......B...#',
        '################',
      ],
      [
        '################',
        '#..B...T....B..#',
        '#.P.......m....#',
        '#..Q.T.........#',
        '#.,,,,,,C.,m.,D#',
        '#.,,,,,,,,...,D#',
        '#....T.........#',
        '#.........m....#',
        '#..B...T....B..#',
        '################',
      ],
      [
        '################',
        '#...B......B...#',
        '#.P.......m....#',
        '#..Q..T..T.....#',
        '#.,......E...,O#',
        '#.,..........,O#',
        '#.....T..T.....#',
        '#..............#',
        '#...B......B...#',
        '################',
      ],
    ],
    pvpArena: [
      '################',
      '#..B........B..#',
      '#....T....T....#',
      '#..............#',
      '#.P.,,,,,,,,.Q.#',
      '#...,,,,,,,,...#',
      '#..............#',
      '#....T....T....#',
      '#..B........B..#',
      '################',
    ],
  },
  2: {
    id: 2,
    name: 'Catacumba de Ossos',
    subtitle: 'Salao gotico infestado por Morcegos e o Esqueleto Cavaleiro',
    biome: 'crypt',
    bossKind: 'skeleton',
    minionKind: 'bat',
    bossName: 'Esqueleto Cavaleiro',
    minionName: 'Morcego Sombrio',
    bossMaxHp: 12,
    minionMaxHp: 4,
    enemySpeed: 76,
    enemyFireRateMs: 1650,
    accentColor: '#b197fc',
    rooms: [
      [
        '################',
        '#..B...##...B..#',
        '#.P.........m..#',
        '#..Q....C......#',
        '#.,,T,,,,,...,,D',
        '#.,,,,,,,,...,,D',
        '#...T.......m..#',
        '#..............#',
        '#..B...##...B..#',
        '################',
      ],
      [
        '################',
        '#..B........B..#',
        '#.P...T...m....#',
        '#..Q...........#',
        '#.,,..C..T..m,,D',
        '#.,,........,,,D',
        '#.....T........#',
        '#.........m....#',
        '#..B........B..#',
        '################',
      ],
      [
        '################',
        '#..B........B..#',
        '#.P....T...m...#',
        '#..Q...........#',
        '#.,,,,.....E.,,O',
        '#.,,,,.......,,O',
        '#......T.......#',
        '#..............#',
        '#..B...T....B..#',
        '################',
      ],
    ],
    pvpArena: [
      '################',
      '#..B...##...B..#',
      '#..............#',
      '#....T....T....#',
      '#.P.,,,,,,,,.Q.#',
      '#...,,,,,,,,...#',
      '#....T....T....#',
      '#..............#',
      '#..B...##...B..#',
      '################',
    ],
  },
  3: {
    id: 3,
    name: 'Forja Sombria',
    subtitle: 'Camara de magma protegida por Diabretes e a Gargula de Ferro',
    biome: 'forge',
    bossKind: 'gargoyle',
    minionKind: 'imp',
    bossName: 'Gárgula de Ferro',
    minionName: 'Diabrete de Brasa',
    bossMaxHp: 14,
    minionMaxHp: 5,
    enemySpeed: 84,
    enemyFireRateMs: 1480,
    accentColor: '#ff6b6b',
    rooms: [
      [
        '################',
        '#..B........B..#',
        '#.P....T....m..#',
        '#..Q....C......#',
        '#.,,.,,,,,,..,D#',
        '#.,,.,,,,,,..,D#',
        '#...........m..#',
        '#......T.......#',
        '#..B........B..#',
        '################',
      ],
      [
        '################',
        '#..B........B..#',
        '#.P.......m....#',
        '#..Q..T........#',
        '#.,,.C....T.m,D#',
        '#.,,.........,D#',
        '#.....T........#',
        '#.........m....#',
        '#..B........B..#',
        '################',
      ],
      [
        '################',
        '#..B........B..#',
        '#.P........m...#',
        '#..Q.T....T....#',
        '#.,....E.....,O#',
        '#.,..........,O#',
        '#....T....T....#',
        '#..............#',
        '#..B........B..#',
        '################',
      ],
    ],
    pvpArena: [
      '################',
      '#..B........B..#',
      '#.....T..T.....#',
      '#..............#',
      '#.P.,,,,,,,,.Q.#',
      '#...,,,,,,,,...#',
      '#..............#',
      '#.....T..T.....#',
      '#..B........B..#',
      '################',
    ],
  },
};

export function getDungeonById(id: number): DungeonDefinition {
  if (id === 2) return DUNGEONS[2];
  if (id === 3) return DUNGEONS[3];
  return DUNGEONS[1];
}
