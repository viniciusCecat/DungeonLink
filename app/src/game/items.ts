export type WeaponId = 'rune_sword' | 'elf_bow' | 'flame_staff' | 'forge_axe';
export type ArmorId = 'iron_mail' | 'shadow_cloak' | 'magma_plate';

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

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rune_sword: {
    id: 'rune_sword',
    name: 'Espada Rúnica',
    tag: 'Equilibrada',
    description: 'Corte azul que rebate tiros + onda de energia.',
    meleeDamage: 2,
    projDamage: 1,
    cooldownMs: 260,
    projSpeed: 290,
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
    description: 'Dispara 2 flechas rápidas em leque com recarga curta.',
    meleeDamage: 1,
    projDamage: 1,
    cooldownMs: 210,
    projSpeed: 360,
    projCount: 2,
    spreadRad: 0.16,
    parryRadius: 18,
    meleeRange: 34,
    color: '#51cf66',
    coreColor: '#ebfbee',
    cost: 20,
  },
  flame_staff: {
    id: 'flame_staff',
    name: 'Cajado Flamejante',
    tag: 'Mágico',
    description: 'Orbe ígneo de alto dano que ilumina a masmorra.',
    meleeDamage: 1,
    projDamage: 2,
    cooldownMs: 360,
    projSpeed: 250,
    projCount: 1,
    spreadRad: 0,
    parryRadius: 24,
    meleeRange: 42,
    color: '#ff922b',
    coreColor: '#fff3bf',
    cost: 35,
  },
  forge_axe: {
    id: 'forge_axe',
    name: 'Machado da Forja',
    tag: 'Pesado',
    description: 'Golpe brutal de perto (3 dano) + onda larga que destrói tiros.',
    meleeDamage: 3,
    projDamage: 2,
    cooldownMs: 420,
    projSpeed: 230,
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
    dashCdMs: 680,
    tint: '#3b5bdb',
    cost: 0,
  },
  shadow_cloak: {
    id: 'shadow_cloak',
    name: 'Manto Sombrio',
    description: '3 de Escudo + 16% mais velocidade + Dash rápido.',
    maxShield: 3,
    speedMult: 1.16,
    bonusDamage: 0,
    dashCdMs: 460,
    tint: '#7048e8',
    cost: 30,
  },
  magma_plate: {
    id: 'magma_plate',
    name: 'Placa de Magma',
    description: '4 de Escudo + bônus de +1 dano em todos os ataques.',
    maxShield: 4,
    speedMult: 0.98,
    bonusDamage: 1,
    dashCdMs: 620,
    tint: '#d9480f',
    cost: 45,
  },
};

export const WEAPON_LIST: WeaponDef[] = [
  WEAPONS.rune_sword,
  WEAPONS.elf_bow,
  WEAPONS.flame_staff,
  WEAPONS.forge_axe,
];

export const ARMOR_LIST: ArmorDef[] = [
  ARMORS.iron_mail,
  ARMORS.shadow_cloak,
  ARMORS.magma_plate,
];

export interface InventoryState {
  gold: number;
  potions: number;
  equippedWeapon: WeaponId;
  equippedArmor: ArmorId;
  unlockedWeapons: WeaponId[];
  unlockedArmors: ArmorId[];
}

export function createInitialInventory(): InventoryState {
  return {
    gold: 15,
    potions: 2,
    equippedWeapon: 'rune_sword',
    equippedArmor: 'iron_mail',
    unlockedWeapons: ['rune_sword', 'elf_bow'],
    unlockedArmors: ['iron_mail'],
  };
}
