export type WeaponId =
  | 'rune_sword'
  | 'elf_bow'
  | 'twin_daggers'
  | 'frost_wand'
  | 'flame_staff'
  | 'thunder_spear'
  | 'forge_axe';

export type ArmorId =
  | 'iron_mail'
  | 'ranger_vest'
  | 'shadow_cloak'
  | 'frost_aegis'
  | 'magma_plate';

export type RelicId = 'none' | 'vamp_ring' | 'gold_charm' | 'swift_boots';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tag: string;
  description: string;
  meleeDamage: number;
  projDamage: number;
  cooldownMs: number;
  projSpeed: number;
  projCount: number;
  spreadRad: number;
  parryRadius: number;
  meleeRange: number;
  slowsEnemy?: boolean;
  piercing?: boolean;
  color: string;
  coreColor: string;
  cost: number;
}

export interface ArmorDef {
  id: ArmorId;
  name: string;
  description: string;
  maxShield: number;
  speedMult: number;
  bonusDamage: number;
  dashCdMs: number;
  tint: string;
  cost: number;
}

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
  color: string;
  cost: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rune_sword: {
    id: 'rune_sword',
    name: 'Espada Rúnica',
    tag: 'Equilibrada',
    description: 'Corte azul que rebate tiros + onda de energia.',
    meleeDamage: 2,
    projDamage: 1,
    cooldownMs: 250,
    projSpeed: 295,
    projCount: 1,
    spreadRad: 0,
    parryRadius: 34,
    meleeRange: 52,
    color: '#4dabf7',
    coreColor: '#e7f5ff',
    cost: 0,
  },
  elf_bow: {
    id: 'elf_bow',
    name: 'Arco Élfico',
    tag: 'Rápido',
    description: 'Dispara 2 flechas velozes em leque.',
    meleeDamage: 1,
    projDamage: 1,
    cooldownMs: 210,
    projSpeed: 365,
    projCount: 2,
    spreadRad: 0.16,
    parryRadius: 18,
    meleeRange: 34,
    color: '#51cf66',
    coreColor: '#ebfbee',
    cost: 0,
  },
  twin_daggers: {
    id: 'twin_daggers',
    name: 'Adagas Gêmeas',
    tag: 'Veloz',
    description: 'Golpes frenéticos (150ms) e rajada curta.',
    meleeDamage: 2,
    projDamage: 1,
    cooldownMs: 155,
    projSpeed: 340,
    projCount: 1,
    spreadRad: 0,
    parryRadius: 30,
    meleeRange: 46,
    color: '#20c997',
    coreColor: '#e6fcf5',
    cost: 20,
  },
  frost_wand: {
    id: 'frost_wand',
    name: 'Varinha Glacial',
    tag: 'Gelo',
    description: 'Cristais de gelo que desaceleram inimigos.',
    meleeDamage: 1,
    projDamage: 2,
    cooldownMs: 300,
    projSpeed: 270,
    projCount: 2,
    spreadRad: 0.2,
    parryRadius: 24,
    meleeRange: 40,
    slowsEnemy: true,
    color: '#3bc9db',
    coreColor: '#e3fafc',
    cost: 30,
  },
  flame_staff: {
    id: 'flame_staff',
    name: 'Cajado Flamejante',
    tag: 'Fogo',
    description: 'Orbe ígneo potente que clareia o modo escuro.',
    meleeDamage: 1,
    projDamage: 3,
    cooldownMs: 360,
    projSpeed: 255,
    projCount: 1,
    spreadRad: 0,
    parryRadius: 24,
    meleeRange: 42,
    color: '#ff922b',
    coreColor: '#fff3bf',
    cost: 35,
  },
  thunder_spear: {
    id: 'thunder_spear',
    name: 'Lança do Trovão',
    tag: 'Perfurante',
    description: 'Raio perfurante que atravessa múltiplos inimigos.',
    meleeDamage: 2,
    projDamage: 2,
    cooldownMs: 310,
    projSpeed: 420,
    projCount: 1,
    spreadRad: 0,
    parryRadius: 30,
    meleeRange: 62,
    piercing: true,
    color: '#ffd43b',
    coreColor: '#fff9db',
    cost: 42,
  },
  forge_axe: {
    id: 'forge_axe',
    name: 'Machado da Forja',
    tag: 'Brutal',
    description: '3 dano de perto + 3 ondas vermelhas que limpam tiros.',
    meleeDamage: 3,
    projDamage: 2,
    cooldownMs: 410,
    projSpeed: 235,
    projCount: 3,
    spreadRad: 0.24,
    parryRadius: 44,
    meleeRange: 60,
    color: '#ff6b6b',
    coreColor: '#ffe3e3',
    cost: 50,
  },
};

export const ARMORS: Record<ArmorId, ArmorDef> = {
  iron_mail: {
    id: 'iron_mail',
    name: 'Malha de Ferro',
    description: '2 de Escudo recarregável. Equilibrada.',
    maxShield: 2,
    speedMult: 1.0,
    bonusDamage: 0,
    dashCdMs: 650,
    tint: '#3b5bdb',
    cost: 0,
  },
  ranger_vest: {
    id: 'ranger_vest',
    name: 'Gibão do Caçador',
    description: '2 Escudo + 18% Velocidade + Dash ultra-rápido.',
    maxShield: 2,
    speedMult: 1.18,
    bonusDamage: 0,
    dashCdMs: 420,
    tint: '#2b8a3e',
    cost: 22,
  },
  shadow_cloak: {
    id: 'shadow_cloak',
    name: 'Manto Sombrio',
    description: '3 Escudo + 14% Velocidade + Dash rápido.',
    maxShield: 3,
    speedMult: 1.14,
    bonusDamage: 0,
    dashCdMs: 460,
    tint: '#7048e8',
    cost: 30,
  },
  frost_aegis: {
    id: 'frost_aegis',
    name: 'Égide Glacial',
    description: '5 de Escudo recarregável para tanque pesado.',
    maxShield: 5,
    speedMult: 0.96,
    bonusDamage: 0,
    dashCdMs: 640,
    tint: '#0c8599',
    cost: 40,
  },
  magma_plate: {
    id: 'magma_plate',
    name: 'Placa de Magma',
    description: '4 Escudo + bônus de +1 dano em todos os ataques.',
    maxShield: 4,
    speedMult: 1.0,
    bonusDamage: 1,
    dashCdMs: 600,
    tint: '#d9480f',
    cost: 45,
  },
};

export const RELICS: Record<RelicId, RelicDef> = {
  none: {
    id: 'none',
    name: 'Sem Relíquia',
    description: 'Equipe um anel ou amuleto para ganhar bônus passivos.',
    color: '#868e96',
    cost: 0,
  },
  vamp_ring: {
    id: 'vamp_ring',
    name: 'Anel Vampírico',
    description: 'Recupera +1 HP sempre que derrotar um inimigo.',
    color: '#fa5252',
    cost: 25,
  },
  gold_charm: {
    id: 'gold_charm',
    name: 'Amuleto da Fortuna',
    description: '+50% Ouro extra em baús, monstros e chefes.',
    color: '#fcc419',
    cost: 20,
  },
  swift_boots: {
    id: 'swift_boots',
    name: 'Botas de Vento',
    description: '+18% Velocidade e recarga de Escudo 2x mais rápida.',
    color: '#38d9a9',
    cost: 28,
  },
};

export const WEAPON_LIST: WeaponDef[] = Object.values(WEAPONS);
export const ARMOR_LIST: ArmorDef[] = Object.values(ARMORS);
export const RELIC_LIST: RelicDef[] = [RELICS.vamp_ring, RELICS.gold_charm, RELICS.swift_boots];

export interface InventoryState {
  gold: number;
  potions: number;
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  equippedRelic: RelicId;
  unlockedWeapons: WeaponId[];
  unlockedArmors: ArmorId[];
  unlockedRelics: RelicId[];
}

export function createInitialInventory(): InventoryState {
  return {
    gold: 20,
    potions: 2,
    equippedWeapon: 'rune_sword',
    equippedArmor: 'iron_mail',
    equippedRelic: 'none',
    unlockedWeapons: ['rune_sword', 'elf_bow'],
    unlockedArmors: ['iron_mail'],
    unlockedRelics: ['none'],
  };
}
