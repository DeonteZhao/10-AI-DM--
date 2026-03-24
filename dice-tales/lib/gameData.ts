
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
  
  // Modifiers
  strMod?: number;
  dexMod?: number;
  conMod?: number;
  intMod?: number;
  wisMod?: number;
  chaMod?: number;

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

export interface CharacterCombatStats {
  ac: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  passivePerception: number;
  
  // Resources (current/max)
  actions: { current: number; max: number };
  bonusActions: { current: number; max: number };
  reactions: { current: number; max: number };
  spellSlots: {
    1: { current: number; max: number };
    2: { current: number; max: number };
    3: { current: number; max: number };
    4: { current: number; max: number };
    5: { current: number; max: number };
    // Simplified to 5 levels for now
  };
  shortRestsAvailable: number;
}

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 for Cantrip
  castingTime: 'action' | 'bonus_action' | 'reaction';
  description: string;
  damageOrHealing?: string; // e.g. "1d10", "1d4 + mod"
}

export interface ClassFeature {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'action' | 'bonus_action' | 'reaction';
  uses?: { current: number; max: number };
  reset?: 'short_rest' | 'long_rest';
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
  combatStats?: CharacterCombatStats; // DnD
  features?: ClassFeature[]; // DnD Class/Race features
  spells?: Spell[]; // DnD spells
  skills: string[] | Record<string, number>;
  inventory: GameItem[]; // Changed from items
  equipment?: Equipment; // Note: In new structure, equipment might just be derived from inventory.is_equipped
  avatar: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export interface Equipment {
  weapon: GameItem | null;
  armor: GameItem | null;
  boots: GameItem | null;
  ring: GameItem | null;
  necklace: GameItem | null;
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
  category: 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace' | 'consumable' | 'key' | 'tool' | 'misc'; // Changed type to category to match backend
  origin?: 'base' | 'module' | 'custom';
  quantity: number;
  is_equipped?: boolean; // Changed from equipped
  stats?: Record<string, any>;
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
  sessionId?: string;
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
  requiredCheck?: { type: 'skill' | 'save' | 'attack'; name: string; attr: string };
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
  {
    id: 'coc_the_haunting',
    name: '鬼屋 (The Haunting)',
    type: 'coc',
    description: '调查员们被房东诺特先生雇佣，前往调查位于波士顿市中心的科比特老宅。由于之前几任租客接连遭遇不幸，这栋房子在当地留下了“闹鬼”的恶名...',
    difficulty: '入门',
    players: '单人/多人',
    image: 'https://images.unsplash.com/photo-1578875486683-2e49fcb61d3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXVudGVkJTIwdmljdG9yaWFuJTIwaG91c2UlMjBuaWdodHxlbnwxfHx8fDE3NzM0MjM4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Chaosium (Official)',
    price: '免费',
    tags: ['恐怖', '调查', '经典']
  },
  {
    id: 'coc_haunting_cn_20170709',
    name: '《鬼屋》(七版·20170709)',
    type: 'coc',
    description: '基于《鬼屋》七版中文文档解析导入的官方经典调查模组，调查员将围绕科比特老宅展开线索搜集与超自然对抗。',
    difficulty: '入门',
    players: '单人/多人',
    image: 'https://images.unsplash.com/photo-1578875486683-2e49fcb61d3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXVudGVkJTIwdmljdG9yaWFuJTIwaG91c2UlMjBuaWdodHxlbnwxfHx8fDE3NzM0MjM4MTV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publisher: 'Chaosium (Official CN)',
    price: '免费',
    tags: ['恐怖', '调查', '经典']
  }
];

export const DND_CLASSES = ['战士', '游侠', '法师', '牧师', '游荡者'];
export const DND_RACES = ['人类', '精灵', '矮人', '提夫林', '德鲁伊'];
export const COC_OCCUPATIONS = ['私家侦探', '教授', '记者', '医生', '作家', '古董商', '警察', '图书管理员'];

export const COC_OCCUPATION_DETAILS: Record<string, { skills: string[], creditRating: [number, number], pointFormula: string }> = {
  '私家侦探': { skills: ['艺术/手艺(摄影)', '乔装', '法律', '图书馆利用', '聆听', '心理学', '侦查'], creditRating: [9, 30], pointFormula: 'EDU*2+(STR|DEX)*2' },
  '教授': { skills: ['图书馆利用', '其他语言', '母语', '心理学', '外语'], creditRating: [20, 70], pointFormula: 'EDU*4' },
  '记者': { skills: ['艺术/手艺(摄影)', '历史', '图书馆利用', '母语', '心理学'], creditRating: [9, 30], pointFormula: 'EDU*4' },
  '医生': { skills: ['急救', '医学', '拉丁语', '心理学', '科学(生物学)', '科学(药学)'], creditRating: [30, 80], pointFormula: 'EDU*4' },
  '作家': { skills: ['艺术/手艺(文学)', '历史', '图书馆利用', '自然界', '外语', '心理学'], creditRating: [9, 30], pointFormula: 'EDU*4' },
  '古董商': { skills: ['估价', '艺术/手艺', '历史', '图书馆利用', '外语', '侦查'], creditRating: [30, 70], pointFormula: 'EDU*4' },
  '警察': { skills: ['斗殴', '射击(手枪)', '急救', '法律', '心理学', '侦查'], creditRating: [9, 30], pointFormula: 'EDU*2+(STR|DEX)*2' },
  '图书管理员': { skills: ['会计', '图书馆利用', '外语', '母语'], creditRating: [9, 30], pointFormula: 'EDU*4' }
};

export const COC_BASE_SKILLS: Record<string, number> = {
  '侦查': 25, '图书馆利用': 20, '聆听': 20, '心理学': 10,
  '急救': 30, '潜行': 20, '斗殴': 25, '射击(手枪)': 20,
  '闪避': 0, // 动态，取决于DEX一半
  '话术': 5, '说服': 10, '恐吓': 15, '魅力': 15,
  '历史': 5, '医学': 1, '自然界': 10, '科学(生物学)': 1, '科学(药学)': 1,
  '艺术/手艺(摄影)': 5, '艺术/手艺(文学)': 5, '乔装': 5, '法律': 5,
  '外语': 1, '母语': 0, // 取决于EDU
  '估价': 5, '机械维修': 10, '电气维修': 10, '信用评级': 0,
  '拉丁语': 1, '其他语言': 1, '会计': 5
};

export const DND_SKILLS_MAP: Record<string, string> = {
  '特技': 'dexterity',
  '巧手': 'dexterity',
  '隐匿': 'dexterity',
  '奥秘': 'intelligence',
  '历史': 'intelligence',
  '调查': 'intelligence',
  '自然': 'intelligence',
  '宗教': 'intelligence',
  '驯兽': 'wisdom',
  '洞悉': 'wisdom',
  '医疗': 'wisdom',
  '察觉': 'wisdom',
  '生存': 'wisdom',
  '欺瞒': 'charisma',
  '威吓': 'charisma',
  '表演': 'charisma',
  '说服': 'charisma'
};

export const calculateModifier = (score: number) => {
  return Math.floor((score - 10) / 2);
};

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

export const DND_CLASS_FEATURES: Record<string, ClassFeature[]> = {
  '战士': [
    { id: 'f_second_wind', name: '复苏之风', description: '在战斗中进行深呼吸，恢复 1d10 + 战士等级 的 HP。', type: 'bonus_action', uses: { current: 1, max: 1 }, reset: 'short_rest' },
    { id: 'f_action_surge', name: '动作如风', description: '在你的回合额外获得一个动作。', type: 'passive', uses: { current: 1, max: 1 }, reset: 'short_rest' }
  ],
  '游侠': [
    { id: 'r_hunters_mark', name: '猎人印记', description: '标记一个敌人，你的武器攻击对其额外造成 1d6 伤害。', type: 'bonus_action', uses: { current: 2, max: 2 }, reset: 'long_rest' },
    { id: 'r_favored_enemy', name: '宿敌', description: '对特定类型敌人有追踪优势和知识优势。', type: 'passive' }
  ],
  '法师': [
    { id: 'w_arcane_recovery', name: '奥术恢复', description: '每天一次短休时，可以恢复部分消耗掉的法术位。', type: 'action', uses: { current: 1, max: 1 }, reset: 'long_rest' },
    { id: 'w_spellbook', name: '法术书', description: '可以学习卷轴上的法术，极大地扩展法术库。', type: 'passive' }
  ],
  '牧师': [
    { id: 'c_channel_divinity', name: '引导神力', description: '释放神圣能量，如驱散亡灵。', type: 'action', uses: { current: 1, max: 1 }, reset: 'short_rest' },
    { id: 'c_healing_word', name: '治愈真言', description: '极具战术价值的治疗，可以在远距离拉起倒地的队友。', type: 'bonus_action' }
  ],
  '游荡者': [
    { id: 'ro_sneak_attack', name: '偷袭', description: '攻击具有优势或有盟友在目标旁时，造成额外 1d6 伤害。', type: 'passive' },
    { id: 'ro_cunning_action', name: '灵巧动作', description: '可以在每个回合将“疾走”、“撤退”或“躲藏”作为附赠动作。', type: 'bonus_action' }
  ]
};

export const DND_INITIAL_SPELLS: Record<string, Spell[]> = {
  '法师': [
    { id: 'sp_fire_bolt', name: '火焰箭', level: 0, castingTime: 'action', description: '掷出火焰，造成 1d10 火焰伤害。', damageOrHealing: '1d10' },
    { id: 'sp_mage_hand', name: '法师之手', level: 0, castingTime: 'action', description: '创造一只幽灵手，可以搬运轻物。' },
    { id: 'sp_magic_missile', name: '魔法飞弹', level: 1, castingTime: 'action', description: '发射3枚必定命中的飞弹，每枚造成 1d4+1 力场伤害。', damageOrHealing: '3d4+3' },
    { id: 'sp_shield', name: '护盾术', level: 1, castingTime: 'reaction', description: '受到攻击时张开魔法护盾，直到你的下回合开始前 AC+5。' }
  ],
  '牧师': [
    { id: 'sp_sacred_flame', name: '圣火术', level: 0, castingTime: 'action', description: '降下神圣火焰，目标需通过敏捷豁免，否则受 1d8 光耀伤害。', damageOrHealing: '1d8' },
    { id: 'sp_guidance', name: '神导术', level: 0, castingTime: 'action', description: '接触目标，使其在下一次属性检定时增加 1d4。' },
    { id: 'sp_healing_word', name: '治愈真言', level: 1, castingTime: 'bonus_action', description: '用语言治愈视线内的一名生物，恢复 1d4 + 感知调整值 的生命。', damageOrHealing: '1d4+MOD' },
    { id: 'sp_bless', name: '祝福术', level: 1, castingTime: 'action', description: '祝福至多三个生物，他们在攻击和豁免检定时可以额外加 1d4。' }
  ],
  '德鲁伊': [
    { id: 'sp_produce_flame', name: '燃火术', level: 0, castingTime: 'action', description: '在手中产生火焰用于照明，或投掷造成 1d8 伤害。', damageOrHealing: '1d8' },
    { id: 'sp_shillelagh', name: '橡棍术', level: 0, castingTime: 'bonus_action', description: '赋予木棍魔法，使其伤害变为 1d8 且可用感知代替力量攻击。' },
    { id: 'sp_entangle', name: '纠缠术', level: 1, castingTime: 'action', description: '20尺范围内的地面长出藤蔓，未通过力量豁免的生物被束缚。' },
    { id: 'sp_cure_wounds', name: '治愈伤药', level: 1, castingTime: 'action', description: '接触一名生物，使其恢复 1d8 + 感知调整值 的生命。', damageOrHealing: '1d8+MOD' }
  ]
};

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll2d6(): number {
  return rollDice(6) + rollDice(6);
}

export function roll3d6(): number {
  return rollDice(6) + rollDice(6) + rollDice(6);
}

export function rollStat(): number {
  // 4d6 drop lowest
  const rolls = [rollDice(6), rollDice(6), rollDice(6), rollDice(6)];
  rolls.sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

export function createDefaultCharacter(): Character {
  return {
    id: 'char_default',
    name: '亚瑟-银月',
    type: 'dnd',
    class: '法师',
    race: '精灵',
    level: 1,
    stats: {
        strength: 10,
        dexterity: 16,
        constitution: 12,
        intelligence: 18,
        wisdom: 14,
        charisma: 10,
        strMod: 0, dexMod: 3, conMod: 1, intMod: 4, wisMod: 2, chaMod: 0
    },
    combatStats: {
        ac: 13, // 10 + dex
        initiative: 3,
        speed: 30,
        proficiencyBonus: 2,
        passivePerception: 12,
        actions: { current: 1, max: 1 },
        bonusActions: { current: 1, max: 1 },
        reactions: { current: 1, max: 1 },
        spellSlots: {
            1: { current: 2, max: 2 },
            2: { current: 0, max: 0 },
            3: { current: 0, max: 0 },
            4: { current: 0, max: 0 },
            5: { current: 0, max: 0 },
        },
        shortRestsAvailable: 1,
    },
    features: [
        { id: 'w_arcane_recovery', name: '奥术恢复', description: '每天一次短休时，可以恢复部分消耗掉的法术位。', type: 'action', uses: { current: 1, max: 1 }, reset: 'long_rest' },
        { id: 'w_spellbook', name: '法术书', description: '可以学习卷轴上的法术，极大地扩展法术库。', type: 'passive' }
    ],
    spells: [
        { id: 'sp_fire_bolt', name: '火焰箭', level: 0, castingTime: 'action', description: '掷出火焰，造成 1d10 火焰伤害。', damageOrHealing: '1d10' },
        { id: 'sp_mage_hand', name: '法师之手', level: 0, castingTime: 'action', description: '创造一只幽灵手，可以搬运轻物。' },
        { id: 'sp_magic_missile', name: '魔法飞弹', level: 1, castingTime: 'action', description: '发射3枚必定命中的飞弹，每枚造成 1d4+1 力场伤害。', damageOrHealing: '3d4+3' },
        { id: 'sp_shield', name: '护盾术', level: 1, castingTime: 'reaction', description: '受到攻击时张开魔法护盾，直到你的下回合开始前 AC+5。' }
    ],
    skills: ['奥秘', '侦查'],
    inventory: [
        { id: 'i1', name: '长剑', description: '1d8挥砍伤害', category: 'weapon', origin: 'base', quantity: 1, is_equipped: true, stats: { damage: "1d8" } },
        { id: 'i2', name: '链甲', description: 'AC 16', category: 'armor', origin: 'base', quantity: 1, is_equipped: true, stats: { ac_bonus: 16 } },
        { id: 'i3', name: '治疗药水', description: '恢复2d4+2HP', category: 'consumable', origin: 'base', quantity: 2, is_equipped: false },
        { id: 'i4', name: '火把', description: '照明用', category: 'tool', origin: 'base', quantity: 3, is_equipped: false },
    ],
    equipment: {
        weapon: { id: 'i1', name: '长剑', description: '1d8挥砍伤害', category: 'weapon', quantity: 1, is_equipped: true },
        armor: { id: 'i2', name: '链甲', description: 'AC 16', category: 'armor', quantity: 1, is_equipped: true },
        boots: null,
        ring: null,
        necklace: null
    },
    avatar: '🧙‍♂️',
    hp: 11,
    maxHp: 11,
    mp: 20,
    maxMp: 20,
  };
}
