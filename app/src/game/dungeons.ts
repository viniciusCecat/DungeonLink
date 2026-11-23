export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

export type EnemyKind = 'slime' | 'skeleton' | 'gargoyle';

export interface DungeonDefinition {
  id: 1 | 2 | 3;
  name: string;
  subtitle: string;
  enemyKind: EnemyKind;
  enemyName: string;
  enemyMaxHp: number;
  enemySpeed: number;
  accentColor: string;
  room1: string[];
  room2: string[];
}

// Legenda dos mapas (16 colunas x 10 linhas):
// '#' = Parede solida
// 'T' = Pilar/Braseiro (obstaculo)
// '.' = Chao livre
// 'P' = Spawn do jogador
// 'D' = Porta de passagem (Sala 1 -> Sala 2)
// 'E' = Spawn do inimigo (Sala 2)
// 'O' = Portal final (Sala 2)
export const DUNGEONS: Record<1 | 2 | 3, DungeonDefinition> = {
  1: {
    id: 1,
    name: 'Cripta das Pedras',
    subtitle: 'Ruinas umidas guardadas pelo Slime Acido',
    enemyKind: 'slime',
    enemyName: 'Slime Acido',
    enemyMaxHp: 3,
    enemySpeed: 64,
    accentColor: '#38d9a9',
    room1: [
      '################',
      '#....T.........#',
      '#.P......##....#',
      '#........##....#',
      '#...##........D#',
      '#...##........D#',
      '#........##....#',
      '#........##....#',
      '#.........T....#',
      '################',
    ],
    room2: [
      '################',
      '#....T....T....#',
      '#.P............#',
      '#.....##.......#',
      '#..............#',
      '#.........E...O#',
      '#.....##......O#',
      '#..............#',
      '#....T....T....#',
      '################',
    ],
  },
  2: {
    id: 2,
    name: 'Catacumba de Ossos',
    subtitle: 'Corredores antigos patrulhados pelo Cavaleiro Osseo',
    enemyKind: 'skeleton',
    enemyName: 'Esqueleto Cavaleiro',
    enemyMaxHp: 4,
    enemySpeed: 76,
    accentColor: '#f59f00',
    room1: [
      '################',
      '#......##......#',
      '#.P....##..T...#',
      '#..........#...#',
      '#...T......#..D#',
      '#..........#..D#',
      '#...##.....#...#',
      '#...##.....T...#',
      '#..............#',
      '################',
    ],
    room2: [
      '################',
      '#..T........T..#',
      '#.P....##......#',
      '#..............#',
      '#......T...E...#',
      '#.............O#',
      '#......T......O#',
      '#..............#',
      '#..T...##...T..#',
      '################',
    ],
  },
  3: {
    id: 3,
    name: 'Forja Sombria',
    subtitle: 'Salao vulcanico protegido pela Gargula de Ferro',
    enemyKind: 'gargoyle',
    enemyName: 'Gargula de Ferro',
    enemyMaxHp: 5,
    enemySpeed: 84,
    accentColor: '#ff6b6b',
    room1: [
      '################',
      '#...#......#...#',
      '#.P.#..T...#...#',
      '#..........#...#',
      '#...##........D#',
      '#...##........D#',
      '#...#......T...#',
      '#...#......#...#',
      '#..........#...#',
      '################',
    ],
    room2: [
      '################',
      '#..T...##...T..#',
      '#.P............#',
      '#...#......#...#',
      '#...#..E...#..O#',
      '#.............O#',
      '#...#......#...#',
      '#..........T...#',
      '#......##......#',
      '################',
    ],
  },
};

export function getDungeonById(id: number): DungeonDefinition {
  if (id === 2) return DUNGEONS[2];
  if (id === 3) return DUNGEONS[3];
  return DUNGEONS[1];
}
