// Mock data for the TRPG game

export type ModuleType = 'dnd' | 'coc';

export interface GameModule {
  id: string;
  name: string;
  type: ModuleType;
  description: string;
  difficulty: string;
  players: string;
  image: string;
  publisher: string;
  price: string;
  tags: string[];
}

export interface CharacterStats {
  // DnD stats
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  // CoC stats
  str?: number;
  con?: number;
  siz?: number;
  dex?: number;
  app?: number;
  int?: number;
  pow?: number;
  edu?: number;
  luck?: number;
  sanity?: number;
  hp?: number;
  mp?: number;
}

export interface Character {
  id: string;
  name: string;
  type: ModuleType;
  class?: string; // DnD
  race?: string; // DnD
  occupation?: string; // CoC
  age?: number;
  level: number;
  stats: CharacterStats;
  skills: string[];
  items: GameItem[];
  avatar: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'consumable' | 'key' | 'misc';
  quantity: number;
}

export interface Adventure {
  id: string;
  moduleId: string;
  characterId: string;
  moduleName: string;
  characterName: string;
  moduleType: ModuleType;
  progress: number;
  lastPlayed: string;
  image: string;
  currentLocation: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  explored: boolean;
  children?: Location[];
  connections: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'player' | 'dm';
  content: string;
  timestamp: string;
  type: 'narrative' | 'dialog' | 'system' | 'roll';
  rollResult?: { dice: string; result: number; success?: boolean };
}

export const MODULES: GameModule[] = [
  {
    id: 'dnd-frozen-sick',
    name: '冰封疫病',
    type: 'dnd',
    description: '在艾森瓦尔德的冰雪覆盖之地，一种神秘的疾病正在蔓延。冒险者们必须追溯疫病源头，深入危机四伏的冰封洞穴。',
    difficulty: '入门',
    players: '单人',
    image: 'https://images.unsplash.com/photo-1712777691122-8a10db0a78a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwZm9yZXN0JTIwbXlzdGVyaW91cyUyMGZvZ3xlbnwxfHx8fDE3NzMzNzI0NzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Wizards of the Coast',
    price: '免费',
    tags: ['入门', '冒险', '探索']
  },
  {
    id: 'dnd-dragon-lair',
    name: '龙巢夺宝',
    type: 'dnd',
    description: '传说中的红龙在远古的山脉深处筑巢。勇敢的冒险者将深入巢穴，面对致命的陷阱和守卫，最终与龙对决。',
    difficulty: '中等',
    players: '单人',
    image: 'https://images.unsplash.com/photo-1595854866399-6a4807ad33ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwZHJhZ29uJTIwZmlyZXxlbnwxfHx8fDE3NzMzOTg0MTF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Wizards of the Coast',
    price: '免费',
    tags: ['战斗', '龙', '宝藏']
  },
  {
    id: 'dnd-ruins',
    name: '失落神殿',
    type: 'dnd',
    description: '一座被遗忘千年的神殿重现于世。殿内蕴藏着古老的力量与被封印的邪恶。你将揭开神殿的秘密。',
    difficulty: '入门',
    players: '单人',
    image: 'https://images.unsplash.com/photo-1762706016343-0d665b8ce488?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmNpZW50JTIwcnVpbnMlMjB0ZW1wbGUlMjBleHBsb3JhdGlvbnxlbnwxfHx8fDE3NzM0MjM4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: '自制模组',
    price: '免费',
    tags: ['探索', '解谜', '入门']
  },
  {
    id: 'coc-haunted-house',
    name: '幽灵古宅',
    type: 'coc',
    description: '1920年代的新英格兰，一座维多利亚式古宅传出怪异的声响。作为调查员，你必须揭开古宅背后不可名状的恐怖真相。',
    difficulty: '入门',
    players: '单人',
    image: 'https://images.unsplash.com/photo-1578875486683-2e49fcb61d3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXVudGVkJTIwdmljdG9yaWFuJTIwaG91c2UlMjBuaWdodHxlbnwxfHx8fDE3NzM0MjM4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Chaosium',
    price: '免费',
    tags: ['恐怖', '调查', '入门']
  },
  {
    id: 'coc-dark-cult',
    name: '暗夜邪教',
    type: 'coc',
    description: '城市中接连发生离奇失踪案件。线索指向一个秘密邪教组织，他们正在进行可怕的召唤仪式。时间紧迫，你必须在深渊之物降临前阻止他们。',
    difficulty: '中等',
    players: '单人',
    image: 'https://images.unsplash.com/photo-1767779670896-a02bc4f0b5e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb3ZlY3JhZnQlMjBob3Jyb3IlMjBkYXJrJTIwbWFuc2lvbnxlbnwxfHx8fDE3NzM0MjM4MTR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Chaosium',
    price: '免费',
    tags: ['恐怖', '调查', '邪教']
  },
];

export const DND_CLASSES = ['战士', '法师', '盗贼', '牧师', '游侠', '术士'];
export const DND_RACES = ['人类', '精灵', '矮人', '半身人', '半精灵', '龙裔'];
export const COC_OCCUPATIONS = ['私家侦探', '教授', '记者', '医生', '作家', '古董商', '警察', '图书管理员'];

export const SAMPLE_LOCATIONS: Location[] = [
  {
    id: 'town',
    name: '艾登镇',
    description: '一个宁静的小镇，最近被神秘事件所困扰。',
    explored: true,
    connections: ['tavern', 'market', 'library', 'outskirts'],
    children: [
      { id: 'tavern', name: '醉龙酒馆', description: '镇上最热闹的酒馆', explored: true, connections: ['town'], },
      { id: 'market', name: '集市广场', description: '各种商贩聚集之处', explored: true, connections: ['town'], },
      { id: 'library', name: '古老图书馆', description: '存放着许多古籍的图书馆', explored: false, connections: ['town'], },
    ]
  },
  {
    id: 'outskirts',
    name: '镇外荒野',
    description: '艾登镇周围的荒野地带。',
    explored: true,
    connections: ['town', 'cave', 'forest'],
    children: [
      { id: 'cave', name: '冰封洞穴', description: '传说中疫病源头所在', explored: false, connections: ['outskirts'], },
      { id: 'forest', name: '迷雾森林', description: '充满危险的森林', explored: false, connections: ['outskirts'], },
    ]
  },
];

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll3d6(): number {
  return rollDice(6) + rollDice(6) + rollDice(6);
}

export function rollStat(): number {
  const rolls = [rollDice(6), rollDice(6), rollDice(6), rollDice(6)];
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}
