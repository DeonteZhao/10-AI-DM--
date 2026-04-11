import type { CocCharacteristics } from "./core";

export type CocOccupationDetail = {
  skills: string[];
  creditRating: [number, number];
  pointFormula: "EDU*2" | "EDU+(STR|DEX)";
};

export const COC_SKILL_NAME_ALIASES: Record<string, string> = {
  "射击(手枪)": "射击",
  "射击（手枪）": "射击",
  "科学(生物学)": "科学",
  "科学（生物学）": "科学",
  "科学(药学)": "科学",
  "科学（药学）": "科学",
  "艺术/手艺(摄影)": "艺术/手艺",
  "艺术/手艺（摄影）": "艺术/手艺",
  "艺术/手艺(文学)": "艺术/手艺",
  "艺术/手艺（文学）": "艺术/手艺",
};

export const COC_BASE_SKILLS: Record<string, number> = {
  侦查: 25,
  图书馆利用: 20,
  聆听: 20,
  心理学: 10,
  急救: 30,
  潜行: 20,
  斗殴: 25,
  射击: 20,
  闪避: 0,
  话术: 5,
  说服: 10,
  恐吓: 15,
  魅力: 15,
  历史: 5,
  医学: 1,
  自然界: 10,
  科学: 1,
  "艺术/手艺": 5,
  乔装: 5,
  法律: 5,
  外语: 1,
  母语: 0,
  估价: 5,
  机械维修: 10,
  电气维修: 10,
  信用评级: 0,
  拉丁语: 1,
  其他语言: 1,
  会计: 5,
};

export const COC_OCCUPATION_DETAILS: Record<string, CocOccupationDetail> = {
  私家侦探: { skills: ["艺术/手艺", "乔装", "法律", "图书馆利用", "聆听", "心理学", "侦查"], creditRating: [9, 30], pointFormula: "EDU+(STR|DEX)" },
  教授: { skills: ["图书馆利用", "其他语言", "母语", "心理学", "外语"], creditRating: [20, 70], pointFormula: "EDU*2" },
  记者: { skills: ["艺术/手艺", "历史", "图书馆利用", "母语", "心理学"], creditRating: [9, 30], pointFormula: "EDU*2" },
  医生: { skills: ["急救", "医学", "拉丁语", "心理学", "科学"], creditRating: [30, 80], pointFormula: "EDU*2" },
  作家: { skills: ["艺术/手艺", "历史", "图书馆利用", "自然界", "外语", "心理学"], creditRating: [9, 30], pointFormula: "EDU*2" },
  古董商: { skills: ["估价", "艺术/手艺", "历史", "图书馆利用", "外语", "侦查"], creditRating: [30, 70], pointFormula: "EDU*2" },
  警察: { skills: ["斗殴", "射击", "急救", "法律", "心理学", "侦查"], creditRating: [9, 30], pointFormula: "EDU+(STR|DEX)" },
  图书管理员: { skills: ["会计", "图书馆利用", "外语", "母语"], creditRating: [9, 30], pointFormula: "EDU*2" },
};

export const COC_OCCUPATIONS = Object.keys(COC_OCCUPATION_DETAILS);

export function normalizeCocSkillName(skill: string) {
  return COC_SKILL_NAME_ALIASES[skill] || skill;
}

export function normalizeCocSkillMap(skills: Record<string, number>) {
  const normalized: Record<string, number> = {};
  Object.entries(skills).forEach(([skill, value]) => {
    const canonicalSkill = normalizeCocSkillName(skill);
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return;
    }
    normalized[canonicalSkill] = Math.max(normalized[canonicalSkill] || 0, Math.floor(numericValue));
  });
  return normalized;
}

export function getCocSkillBaseValue(skill: string, characteristics: CocCharacteristics) {
  if (skill === "闪避") {
    return Math.floor((characteristics.dex || 0) / 2);
  }
  if (skill === "母语") {
    return characteristics.edu || 0;
  }
  return COC_BASE_SKILLS[skill] || 0;
}

export function getCocOccupationPointTotal(characteristics: CocCharacteristics, occupationDetail: CocOccupationDetail) {
  if (!characteristics.edu) {
    return 0;
  }
  if (occupationDetail.pointFormula === "EDU+(STR|DEX)") {
    return (characteristics.edu || 0) + Math.max(characteristics.str || 0, characteristics.dex || 0);
  }
  return (characteristics.edu || 0) * 2;
}

export function getCocPersonalPointTotal(characteristics: CocCharacteristics) {
  return characteristics.int || 0;
}
