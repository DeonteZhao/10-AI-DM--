"use client";

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DiceFive, CaretRight, CaretLeft, Sparkle, ArrowLeft } from '@phosphor-icons/react';
import {
  MODULES, DND_CLASSES, DND_RACES, COC_OCCUPATIONS, COC_OCCUPATION_DETAILS, COC_BASE_SKILLS,
  rollStat, roll3d6, roll2d6, calculateModifier,
  DND_CLASS_FEATURES, DND_INITIAL_SPELLS,
  type ModuleType, type Character, type CharacterStats
} from '@/lib/gameData';
import { useGameStore } from '@/lib/gameStore';

type Step = 'type' | 'basic' | 'stats' | 'skills' | 'confirm';

const DND_SKILLS = ['运动', '体操', '隐匿', '侦察', '洞悉', '医药', '生存', '说服', '欺骗', '威吓', '奥秘', '历史', '自然', '宗教'];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const DND_RACE_BONUSES: Record<string, { [key: string]: number }> = {
  '人类': { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
  '精灵': { dexterity: 2, intelligence: 1 },
  '矮人': { constitution: 2, strength: 1 },
  '提夫林': { charisma: 2, intelligence: 1 },
  '德鲁伊': { wisdom: 2, constitution: 1 },
};

function CharacterCreateContent() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('module');
  const typeParam = searchParams.get('type') as ModuleType | null;
  const selectedModule = moduleId ? MODULES.find(m => m.id === moduleId) : null;
  const router = useRouter();
  const { addCharacter } = useGameStore();

  const initialType = selectedModule?.type || typeParam || 'dnd';
  const initialStep: Step = (selectedModule || typeParam) ? 'basic' : 'type';

  const [step, setStep] = useState<Step>(initialStep);
  const [charType, setCharType] = useState<ModuleType>(initialType);
  const [name, setName] = useState('');
  const [charClass, setCharClass] = useState(DND_CLASSES[0]);
  const [race, setRace] = useState(DND_RACES[0]);
  const [occupation, setOccupation] = useState(COC_OCCUPATIONS[0]);
  const [age, setAge] = useState(25);
  const [stats, setStats] = useState<CharacterStats>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [statMethod, setStatMethod] = useState<'standard' | 'roll'>('standard');
  const [standardArrayAssignments, setStandardArrayAssignments] = useState<Record<string, number>>({});
  const [availableStandardScores, setAvailableStandardScores] = useState<number[]>([...STANDARD_ARRAY]);
  
  // COC specific states
  const [cocStatPool, setCocStatPool] = useState(0);
  const [cocSkillAllocations, setCocSkillAllocations] = useState<Record<string, {occ: number, per: number}>>({});

  const steps: Step[] = (selectedModule || typeParam) ? ['basic', 'stats', 'skills', 'confirm'] : ['type', 'basic', 'stats', 'skills', 'confirm'];
  const currentIndex = steps.indexOf(step);

  const stepLabels: Record<Step, string> = {
    type: '选择体系',
    basic: '基本信息',
    stats: '属性',
    skills: '技能',
    confirm: '确认'
  };

  const rollAllStats = () => {
    if (charType === 'dnd') {
      const rolledStats = {
        strength: rollStat(),
        dexterity: rollStat(),
        constitution: rollStat(),
        intelligence: rollStat(),
        wisdom: rollStat(),
        charisma: rollStat(),
      };
      setStats(rolledStats);
    } else {
      const str = roll3d6() * 5;
      const con = roll3d6() * 5;
      const siz = (roll2d6() + 6) * 5;
      const dex = roll3d6() * 5;
      const app = roll3d6() * 5;
      const int_ = (roll2d6() + 6) * 5;
      const pow = roll3d6() * 5;
      const edu = (roll2d6() + 6) * 5;
      setStats({
        str: Math.round(str),
        con: Math.round(con),
        siz: Math.round(siz),
        dex: Math.round(dex),
        app: Math.round(app),
        int: Math.round(int_),
        pow: Math.round(pow),
        edu: Math.round(edu),
        luck: roll3d6() * 5,
        sanity: Math.round(pow),
        hp: Math.floor((con + siz) / 10),
        mp: Math.floor(pow / 5),
      });
      setCocStatPool(0); // Reset pool on new roll
      setCocSkillAllocations({}); // Reset skills on new roll
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : prev.length < 6 ? [...prev, skill] : prev
    );
  };

  const adjustCocStat = (stat: keyof CharacterStats, amount: number) => {
    if (charType !== 'coc') return;
    setStats(prev => {
      const current = prev[stat] || 0;
      const next = current + amount;
      if (next < 15 || next > 90) return prev; // COC limits
      if (amount > 0 && cocStatPool < amount) return prev; // Not enough pool to increase
      
      setCocStatPool(p => p - amount);
      const newStats = { ...prev, [stat]: next };
      
      // Update derived stats
      if (stat === 'con' || stat === 'siz') {
         newStats.hp = Math.floor(((newStats.con || 0) + (newStats.siz || 0)) / 10);
      }
      if (stat === 'pow') {
         newStats.mp = Math.floor((newStats.pow || 0) / 5);
         newStats.sanity = newStats.pow;
      }
      return newStats;
    });
  };

  const getFinalStat = (statName: keyof CharacterStats) => {
    if (charType !== 'dnd') return stats[statName] || 0;
    
    let base = 0;
    if (statMethod === 'standard') {
      base = standardArrayAssignments[statName] || 0;
    } else {
      base = stats[statName] || 0;
    }

    const bonus = DND_RACE_BONUSES[race]?.[statName as string] || 0;
    return base > 0 ? base + bonus : 0;
  };

  const handleStandardArrayAssign = (statName: string, score: number) => {
    setStandardArrayAssignments(prev => {
      const newAssign = { ...prev };
      const oldScore = newAssign[statName];
      
      // If we're replacing an old score, add it back to available
      let newAvailable = [...availableStandardScores];
      if (oldScore) {
        newAvailable.push(oldScore);
      }
      
      // Remove the new score from available
      newAvailable = newAvailable.filter(s => s !== score);
      // But only remove one instance if there are duplicates (though standard array has none)
      
      newAssign[statName] = score;
      setAvailableStandardScores(newAvailable.sort((a,b)=>b-a));
      return newAssign;
    });
  };

  const handleStandardArrayRemove = (statName: string) => {
    setStandardArrayAssignments(prev => {
      const newAssign = { ...prev };
      const score = newAssign[statName];
      if (score) {
        setAvailableStandardScores(curr => [...curr, score].sort((a,b)=>b-a));
        delete newAssign[statName];
      }
      return newAssign;
    });
  };

  // Calculate COC points
  const occPointsTotal = charType === 'coc' ? (() => {
    if (!stats.edu) return 0;
    const details = COC_OCCUPATION_DETAILS[occupation];
    if (!details) return stats.edu * 4;
    if (details.pointFormula === 'EDU*4') return stats.edu * 4;
    if (details.pointFormula === 'EDU*2+(STR|DEX)*2') return stats.edu * 2 + Math.max(stats.str || 0, stats.dex || 0) * 2;
    return stats.edu * 4;
  })() : 0;

  const perPointsTotal = charType === 'coc' ? (stats.int || 0) * 2 : 0;

  const occPointsSpent = Object.values(cocSkillAllocations).reduce((acc, curr) => acc + curr.occ, 0);
  const perPointsSpent = Object.values(cocSkillAllocations).reduce((acc, curr) => acc + curr.per, 0);
  
  const allocateCocSkill = (skill: string, type: 'occ' | 'per', amount: number) => {
    setCocSkillAllocations(prev => {
      const current = prev[skill] || { occ: 0, per: 0 };
      const newValue = current[type] + amount;
      if (newValue < 0) return prev; // Cannot be negative
      
      const newTotalSpent = type === 'occ' ? occPointsSpent + amount : perPointsSpent + amount;
      const maxPoints = type === 'occ' ? occPointsTotal : perPointsTotal;
      if (newTotalSpent > maxPoints && amount > 0) return prev; // Not enough points

      // Calculate total skill value to ensure it doesn't exceed 99
      const baseVal = skill === '闪避' ? Math.floor((stats.dex || 0) / 2) : (skill === '母语' ? (stats.edu || 0) : (COC_BASE_SKILLS[skill] || 0));
      const newSkillTotal = baseVal + (type === 'occ' ? newValue : current.occ) + (type === 'per' ? newValue : current.per);
      if (newSkillTotal > 99 && amount > 0) return prev; // Cap at 99

      return {
        ...prev,
        [skill]: { ...current, [type]: newValue }
      };
    });
  };

  const handleConfirm = () => {
    // 准备最终存入的 stats
    const finalStats: CharacterStats = {};
    if (charType === 'dnd') {
      ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].forEach(stat => {
        const val = getFinalStat(stat as keyof CharacterStats);
        // @ts-expect-error dynamic key assignment
        finalStats[stat] = val;
        // @ts-expect-error dynamic key assignment
        finalStats[`${stat.substring(0,3)}Mod`] = calculateModifier(val);
      });
    } else {
      Object.assign(finalStats, stats);
    }

    const conScore = finalStats.constitution || 10;
    const maxHp = charType === 'dnd' ? 10 + calculateModifier(conScore) : (finalStats.hp || 10);
    const intScore = finalStats.intelligence || 10;
    const maxMp = charType === 'dnd' ? 4 + calculateModifier(intScore) : (finalStats.mp || 8);
    const avatars = ['🧙', '⚔️', '🏹', '🛡️', '🗡️', '🔮', '🕵️', '📚', '🔬', '✝️'];

    const char: Character = {
      id: `char_${Date.now()}`,
      name: name || '无名冒险者',
      type: charType,
      class: charType === 'dnd' ? charClass : undefined,
      race: charType === 'dnd' ? race : undefined,
      occupation: charType === 'coc' ? occupation : undefined,
      age: charType === 'coc' ? age : undefined,
      level: 1,
      stats: finalStats,
      combatStats: charType === 'dnd' ? {
        ac: 10 + (finalStats.dexMod || 0),
        initiative: finalStats.dexMod || 0,
        speed: 30,
        proficiencyBonus: 2,
        passivePerception: 10 + (finalStats.wisMod || 0),
        actions: { current: 1, max: 1 },
        bonusActions: { current: 1, max: 1 },
        reactions: { current: 1, max: 1 },
        spellSlots: {
            1: { current: ['法师', '牧师', '德鲁伊', '术士', '吟游诗人'].includes(charClass) ? 2 : 0, max: ['法师', '牧师', '德鲁伊', '术士', '吟游诗人'].includes(charClass) ? 2 : 0 },
            2: { current: 0, max: 0 },
            3: { current: 0, max: 0 },
            4: { current: 0, max: 0 },
            5: { current: 0, max: 0 },
        },
        shortRestsAvailable: 1
      } : undefined,
      features: charType === 'dnd' ? [...(DND_CLASS_FEATURES[charClass] || [])] : undefined,
      spells: charType === 'dnd' ? [...(DND_INITIAL_SPELLS[charClass] || [])] : undefined,
      skills: charType === 'dnd' ? selectedSkills : (() => {
        const finalSkills: Record<string, number> = {};
        Object.entries(cocSkillAllocations).forEach(([skill, alloc]) => {
          if (alloc.occ > 0 || alloc.per > 0) {
            const baseVal = skill === '闪避' ? Math.floor((stats.dex || 0) / 2) : (skill === '母语' ? (stats.edu || 0) : (COC_BASE_SKILLS[skill] || 0));
            finalSkills[skill] = baseVal + alloc.occ + alloc.per;
          }
        });
        // Also ensure base values are recorded if needed, but we can compute them on the fly. Let's just record modified skills.
        return finalSkills;
      })(),
      items: [
        { id: 'item_1', name: charType === 'dnd' ? '冒险者背包' : '手电筒', description: '基础装备', type: 'misc', quantity: 1 },
        { id: 'item_2', name: charType === 'dnd' ? '治疗药水' : '急救包', description: '恢复生命', type: 'consumable', quantity: 2 },
      ],
      avatar: avatars[Math.floor(Math.random() * avatars.length)],
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
    };

    addCharacter(char);

    if (moduleId) {
      router.push(`/game/new?module=${moduleId}&character=${char.id}`);
    } else {
      router.push(`/`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-12 relative z-10 font-huiwen">
      <div className="mb-10 flex justify-between items-center">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-0 active:shadow-none transition-all text-lg"
        >
          <ArrowLeft weight="bold" /> 返回
        </button>
      </div>

      {selectedModule && (
        <div className="mb-10 flex items-center gap-4 bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-6 shadow-[4px_4px_0_var(--ink-color)] relative">
          <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
          <div className="w-16 h-20 bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] overflow-hidden relative flex-shrink-0">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, var(--bg-color) 25%, transparent 25%, transparent 75%, var(--bg-color) 75%, var(--bg-color)), linear-gradient(45deg, var(--bg-color) 25%, transparent 25%, transparent 75%, var(--bg-color) 75%, var(--bg-color))', backgroundSize: '10px 10px' }}></div>
          </div>
          <div>
            <p className="text-[var(--ink-color)] opacity-70 text-sm font-bold tracking-widest uppercase mb-1 font-vt323">CREATING CHARACTER FOR MODULE</p>
            <h2 className="text-[var(--ink-color)] text-3xl font-black uppercase tracking-widest riso-title">{selectedModule.name}</h2>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-12 px-4 relative">
        <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-[var(--ink-color)] opacity-30 -z-10 -translate-y-1/2 border-dashed border-t-[3px] border-transparent" style={{ borderTopColor: 'var(--ink-color)' }} />
        {steps.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center border-[3px] font-black text-xl tracking-widest font-vt323 ${
              i < currentIndex ? `border-[var(--ink-color)] text-[var(--bg-color)] ${charType === 'dnd' ? 'bg-[var(--accent-color)] opacity-80' : 'bg-[var(--ink-color)]'}` :
              i === currentIndex ? `border-[var(--ink-color)] text-[var(--bg-color)] shadow-[4px_4px_0_var(--ink-color)] ${charType === 'dnd' ? 'bg-[var(--accent-color)]' : 'bg-[var(--ink-color)]'}` :
              'bg-[var(--bg-color)] border-[var(--ink-color)] text-[var(--ink-color)] opacity-50'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm font-bold tracking-widest uppercase ${
              i <= currentIndex ? 'text-[var(--ink-color)]' : 'text-[var(--ink-color)] opacity-50'
            }`}>{stepLabels[s]}</span>
          </div>
        ))}
      </div>

      <div className="bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-10 shadow-[8px_8px_0_var(--ink-color)] text-[var(--ink-color)] relative">
        <div className="absolute top-3 left-3 text-theme-ink text-sm leading-none opacity-50 font-vt323 tracking-widest">+</div>
        <div className="absolute top-3 right-3 text-theme-ink text-sm leading-none opacity-50 font-vt323 tracking-widest">+</div>
        <div className="absolute bottom-3 left-3 text-theme-ink text-sm leading-none opacity-50 font-vt323 tracking-widest">+</div>
        <div className="absolute bottom-3 right-3 text-theme-ink text-sm leading-none opacity-50 font-vt323 tracking-widest">+</div>

        {step === 'type' && !selectedModule && (
          <div className="space-y-8">
            <h2 className="text-4xl font-black mb-8 text-center uppercase tracking-widest riso-title">选择游戏体系</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <button
                onClick={() => setCharType('dnd')}
                className={`p-8 border-[3px] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] flex flex-col items-center text-center ${
                  charType === 'dnd' ? 'border-[var(--ink-color)] bg-[var(--accent-color)] shadow-[6px_6px_0_var(--ink-color)] text-[var(--bg-color)]' : 'border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)] hover:bg-[var(--paper-light)]'
                }`}
              >
                <h3 className="text-4xl font-black mb-3 uppercase font-vt323 tracking-widest">DND 5E</h3>
                <p className={`text-lg font-bold mb-4 ${charType === 'dnd' ? 'text-[var(--bg-color)] opacity-90' : 'text-[var(--ink-color)] opacity-70'}`}>龙与地下城 简化版</p>
                <p className={`text-base leading-relaxed ${charType === 'dnd' ? 'text-[var(--bg-color)]' : 'text-[var(--ink-color)]'}`}>奇幻冒险，英雄史诗。侧重战斗、魔法与角色成长。</p>
              </button>
              <button
                onClick={() => setCharType('coc')}
                className={`p-8 border-[3px] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] flex flex-col items-center text-center ${
                  charType === 'coc' ? 'border-[var(--ink-color)] bg-[var(--ink-color)] shadow-[6px_6px_0_var(--ink-color)] text-[var(--bg-color)]' : 'border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)] hover:bg-[var(--paper-light)]'
                }`}
              >
                <h3 className="text-4xl font-black mb-3 uppercase font-vt323 tracking-widest">COC 7TH</h3>
                <p className={`text-lg font-bold mb-4 ${charType === 'coc' ? 'text-[var(--bg-color)] opacity-90' : 'text-[var(--ink-color)] opacity-70'}`}>克苏鲁的呼唤 简化版</p>
                <p className={`text-base leading-relaxed ${charType === 'coc' ? 'text-[var(--bg-color)]' : 'text-[var(--ink-color)]'}`}>调查解谜，洛夫克拉夫特式恐怖。侧重技能检定与理智机制。</p>
              </button>
            </div>
          </div>
        )}

        {step === 'basic' && (
          <div className="space-y-8 max-w-xl mx-auto">
            <h2 className="text-4xl font-black mb-8 text-center uppercase tracking-widest riso-title">基本信息</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">角色姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)]"
                  placeholder="输入一个响亮的名字..."
                />
              </div>

              {charType === 'dnd' ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">种族</label>
                    <select
                      value={race}
                      onChange={e => setRace(e.target.value)}
                      className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)] cursor-pointer"
                    >
                      {DND_RACES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">职业</label>
                    <select
                      value={charClass}
                      onChange={e => setCharClass(e.target.value)}
                      className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)] cursor-pointer"
                    >
                      {DND_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">职业</label>
                    <select
                      value={occupation}
                      onChange={e => setOccupation(e.target.value)}
                      className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)] cursor-pointer"
                    >
                      {COC_OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">年龄</label>
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(Number(e.target.value))}
                      min="15" max="90"
                      className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'stats' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8 border-b-[3px] border-[var(--ink-color)] pb-4">
              <h2 className="text-4xl font-black uppercase tracking-widest riso-title">属性值</h2>
              {charType === 'dnd' && (
                <div className="flex gap-4">
                  <button
                    onClick={() => setStatMethod('standard')}
                    className={`px-6 py-2 font-bold uppercase border-[3px] transition-all tracking-widest text-lg ${
                      statMethod === 'standard' 
                        ? 'bg-[var(--accent-color)] text-[var(--bg-color)] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]' 
                        : 'bg-theme-bg text-[var(--ink-color)] border-[var(--ink-color)] hover:bg-[var(--paper-light)] hover:-translate-y-0.5'
                    }`}
                  >
                    标准阵列
                  </button>
                  <button
                    onClick={() => setStatMethod('roll')}
                    className={`px-6 py-2 font-bold uppercase border-[3px] transition-all tracking-widest text-lg ${
                      statMethod === 'roll' 
                        ? 'bg-[var(--accent-color)] text-[var(--bg-color)] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]' 
                        : 'bg-theme-bg text-[var(--ink-color)] border-[var(--ink-color)] hover:bg-[var(--paper-light)] hover:-translate-y-0.5'
                    }`}
                  >
                    随机掷骰
                  </button>
                </div>
              )}
            </div>

            {charType === 'dnd' && statMethod === 'standard' && (
              <div className="mb-10 p-6 bg-theme-bg border-[3px] border-dashed border-[var(--ink-color)]">
                <h3 className="text-xl font-bold mb-4 text-center text-[var(--ink-color)] tracking-widest uppercase">可用点数 (点击下方属性框选择)</h3>
                <div className="flex justify-center gap-4 flex-wrap">
                  {availableStandardScores.map((score, i) => (
                    <div key={`${score}-${i}`} className="w-14 h-14 flex items-center justify-center bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] font-black text-2xl shadow-[2px_2px_0_var(--ink-color)] font-vt323 text-[var(--ink-color)]">
                      {score}
                    </div>
                  ))}
                  {availableStandardScores.length === 0 && (
                    <span className="text-[var(--accent-color)] font-black py-3 text-xl tracking-widest">分配完成！</span>
                  )}
                </div>
              </div>
            )}

            {((charType === 'dnd' && statMethod === 'roll') || charType === 'coc') && (
              <div className="flex justify-center mb-10">
                <button
                  onClick={rollAllStats}
                  className={`flex items-center gap-3 text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-8 py-4 font-black uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] active:translate-y-0 active:shadow-none transition-all text-2xl tracking-widest ${charType === 'dnd' ? 'bg-[var(--accent-color)]' : 'bg-[var(--ink-color)]'}`}
                >
                  <DiceFive className="w-8 h-8" weight="fill" />
                  {charType === 'dnd' ? '掷骰生成 (4D6 弃最低)' : '掷骰生成'}
                </button>
              </div>
            )}

            {(charType === 'coc' && Object.keys(stats).length === 0) ? (
              <div className="text-center py-16 border-[3px] border-dashed border-[var(--ink-color)] bg-theme-bg opacity-70">
                <DiceFive className="w-20 h-20 text-[var(--ink-color)] mx-auto mb-6 opacity-50" />
                <p className="text-[var(--ink-color)] font-bold text-xl tracking-widest">点击上方按钮掷骰生成属性</p>
              </div>
            ) : charType === 'dnd' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((statKey) => {
                  const label = {
                    strength: '力量 STR', dexterity: '敏捷 DEX', constitution: '体质 CON',
                    intelligence: '智力 INT', wisdom: '感知 WIS', charisma: '魅力 CHA',
                  }[statKey] || statKey;
                  
                  const finalVal = getFinalStat(statKey as keyof CharacterStats);
                  const mod = calculateModifier(finalVal);
                  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                  
                  const raceBonus = DND_RACE_BONUSES[race]?.[statKey] || 0;
                  const hasBonus = raceBonus > 0;

                  return (
                    <div key={statKey} className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-5 flex flex-col relative overflow-hidden group shadow-[4px_4px_0_var(--ink-color)]">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[var(--ink-color)] font-black text-lg tracking-widest uppercase">{label}</span>
                        {hasBonus && <span className="text-xs font-bold text-[var(--bg-color)] bg-[var(--accent-color)] px-2 py-1 border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] tracking-widest uppercase">种族 +{raceBonus}</span>}
                      </div>
                      
                      <div className="flex justify-between items-end mt-auto">
                        {statMethod === 'standard' ? (
                          <div className="flex items-center gap-2">
                            <select 
                              value={standardArrayAssignments[statKey] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) handleStandardArrayAssign(statKey, Number(val));
                                else handleStandardArrayRemove(statKey);
                              }}
                              className="border-[3px] border-[var(--ink-color)] p-2 font-black text-2xl w-20 text-center bg-[var(--paper-light)] focus:outline-none focus:bg-theme-bg font-vt323 cursor-pointer text-[var(--ink-color)]"
                            >
                              <option value="">-</option>
                              {standardArrayAssignments[statKey] && (
                                <option value={standardArrayAssignments[statKey]}>{standardArrayAssignments[statKey]}</option>
                              )}
                              {availableStandardScores.map((score, i) => (
                                <option key={`${score}-${i}`} value={score}>{score}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="text-4xl font-black text-[var(--ink-color)] font-vt323">{stats[statKey as keyof CharacterStats] || 0}</div>
                        )}
                        
                        <div className="flex flex-col items-end text-right">
                          <span className="text-4xl font-black font-vt323 tracking-wider" style={{ color: finalVal > 0 ? 'var(--ink-color)' : 'var(--ink-color)', opacity: finalVal > 0 ? 1 : 0.3 }}>
                            {finalVal > 0 ? finalVal : '?'}
                          </span>
                          {finalVal > 0 && (
                            <span className={`text-lg font-bold tracking-widest mt-1 font-vt323 ${mod >= 0 ? 'text-[var(--accent-color)]' : 'text-[#8b0000]'}`}>
                              MOD {modStr}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                {cocStatPool > 0 && (
                  <div className="mb-6 text-center font-black text-[var(--bg-color)] text-2xl bg-[var(--accent-color)] py-3 border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] tracking-widest uppercase">
                    剩余可自由分配点数: {cocStatPool}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {Object.entries(stats).map(([key, value]) => {
                    const label = {
                      str: '力量 STR', con: '体质 CON', siz: '体型 SIZ', dex: '敏捷 DEX',
                      app: '外貌 APP', int: '智力 INT', pow: '意志 POW', edu: '教育 EDU',
                      luck: '幸运 LUK', sanity: '理智 SAN', hp: '生命 HP', mp: '魔法 MP'
                    }[key] || key;
                    
                    const isDerived = ['sanity', 'hp', 'mp'].includes(key);
                    
                    return (
                      <div key={key} className={`border-[3px] border-[var(--ink-color)] p-5 flex flex-col justify-between relative shadow-[4px_4px_0_var(--ink-color)] ${isDerived ? 'bg-[var(--ink-color)] text-[var(--bg-color)]' : 'bg-theme-bg text-[var(--ink-color)]'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-black text-lg tracking-widest uppercase">{label}</span>
                          <span className="text-4xl font-black font-vt323">{value}</span>
                        </div>
                        {!isDerived ? (
                          <div className="flex justify-between items-center mt-3 border-t-[3px] border-dashed border-[var(--ink-color)] pt-4 opacity-80">
                            <button onClick={() => adjustCocStat(key as keyof CharacterStats, -5)} className="w-10 h-10 flex items-center justify-center bg-[var(--paper-light)] hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black border-[3px] border-[var(--ink-color)] active:scale-90 transition-all text-xl">-</button>
                            <span className="text-xs font-bold tracking-widest uppercase">微调 (5)</span>
                            <button onClick={() => adjustCocStat(key as keyof CharacterStats, 5)} disabled={cocStatPool < 5} className={`w-10 h-10 flex items-center justify-center font-black border-[3px] border-[var(--ink-color)] active:scale-90 transition-all text-xl ${cocStatPool < 5 ? 'bg-theme-bg opacity-50 cursor-not-allowed' : 'bg-[var(--paper-light)] hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)]'}`}>+</button>
                          </div>
                        ) : (
                          <div className="flex justify-center items-center mt-3 border-t-[3px] border-dashed border-current pt-4 opacity-60 h-[59px]">
                            <span className="text-xs font-bold tracking-widest uppercase">衍生属性 (不可微调)</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'skills' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8 border-b-[3px] border-[var(--ink-color)] pb-4">
              <h2 className="text-4xl font-black uppercase tracking-widest riso-title">选择熟练技能</h2>
              {charType === 'dnd' ? (
                <span className="text-[var(--bg-color)] font-black border-[3px] border-[var(--ink-color)] px-4 py-2 bg-[var(--accent-color)] shadow-[2px_2px_0_var(--ink-color)] tracking-widest text-lg">
                  已选: {selectedSkills.length}/6
                </span>
              ) : (
                <div className="flex gap-4">
                  <span className="text-[var(--bg-color)] font-black border-[3px] border-[var(--ink-color)] px-4 py-2 bg-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] tracking-widest text-lg">
                    本职点数: {occPointsTotal - occPointsSpent}
                  </span>
                  <span className="text-[var(--bg-color)] font-black border-[3px] border-[var(--ink-color)] px-4 py-2 bg-[var(--accent-color)] shadow-[2px_2px_0_var(--ink-color)] tracking-widest text-lg">
                    兴趣点数: {perPointsTotal - perPointsSpent}
                  </span>
                </div>
              )}
            </div>
            
            {charType === 'dnd' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {DND_SKILLS.map(skill => {
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`p-4 border-[3px] font-black text-xl text-center transition-all tracking-widest ${
                        isSelected
                          ? 'border-[var(--ink-color)] bg-[var(--accent-color)] text-[var(--bg-color)] shadow-[4px_4px_0_var(--ink-color)] -translate-y-1'
                          : 'border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)] hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)]'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-5 text-lg text-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
                  <p className="mb-2"><strong className="font-black uppercase tracking-widest">当前职业:</strong> {occupation} <span className="font-vt323 opacity-80">(信用评级: {COC_OCCUPATION_DETAILS[occupation]?.creditRating[0] || 0} - {COC_OCCUPATION_DETAILS[occupation]?.creditRating[1] || 99})</span></p>
                  <p><strong className="font-black uppercase tracking-widest">本职技能:</strong> {COC_OCCUPATION_DETAILS[occupation]?.skills.join('、')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[50vh] overflow-y-auto pr-4 scrollbar-thin">
                  {Object.keys(COC_BASE_SKILLS).map(skill => {
                    const isOcc = COC_OCCUPATION_DETAILS[occupation]?.skills.includes(skill);
                    const baseVal = skill === '闪避' ? Math.floor((stats.dex || 0) / 2) : (skill === '母语' ? (stats.edu || 0) : (COC_BASE_SKILLS[skill] || 0));
                    const alloc = cocSkillAllocations[skill] || { occ: 0, per: 0 };
                    const totalVal = baseVal + alloc.occ + alloc.per;
                    
                    return (
                      <div key={skill} className={`relative p-4 border-[3px] flex items-center justify-between shadow-[2px_2px_0_var(--ink-color)] min-h-[96px] h-full ${isOcc ? 'border-[var(--ink-color)] bg-[var(--ink-color)] text-[var(--bg-color)]' : 'border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)]'}`}>
                        {isOcc && (
                          <div className="absolute top-0 right-0 bg-[var(--accent-color)] text-[var(--bg-color)] px-2 py-0.5 text-xs font-black tracking-widest border-b-[2px] border-l-[2px] border-[var(--ink-color)] z-10">
                            本职
                          </div>
                        )}
                        <div className="flex flex-col pr-2 justify-center">
                          <span className="font-black text-xl flex items-center gap-3 tracking-widest leading-tight break-words">
                            {skill}
                          </span>
                          <span className={`text-sm mt-1 font-vt323 ${isOcc ? 'opacity-80' : 'opacity-60'}`}>BASE: {baseVal} | TOTAL: <strong className="text-lg">{totalVal}</strong></span>
                        </div>
                        <div className="flex gap-2 sm:gap-3 shrink-0">
                          {isOcc && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-black tracking-widest uppercase">本职</span>
                              <div className="flex border-[2px] border-current overflow-hidden bg-theme-bg text-[var(--ink-color)]">
                                <button onClick={() => allocateCocSkill(skill, 'occ', -5)} className="w-6 h-7 sm:w-7 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black active:scale-90 transition-all">-</button>
                                <span className="w-8 sm:w-10 flex items-center justify-center font-black font-vt323 text-lg border-x-[2px] border-current">{alloc.occ}</span>
                                <button onClick={() => allocateCocSkill(skill, 'occ', 5)} className="w-6 h-7 sm:w-7 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black active:scale-90 transition-all">+</button>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black tracking-widest uppercase">兴趣</span>
                            <div className="flex border-[2px] border-current overflow-hidden bg-theme-bg text-[var(--ink-color)]">
                              <button onClick={() => allocateCocSkill(skill, 'per', -5)} className="w-6 h-7 sm:w-7 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black active:scale-90 transition-all">-</button>
                              <span className="w-8 sm:w-10 flex items-center justify-center font-black font-vt323 text-lg border-x-[2px] border-current">{alloc.per}</span>
                              <button onClick={() => allocateCocSkill(skill, 'per', 5)} className="w-6 h-7 sm:w-7 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black active:scale-90 transition-all">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-8">
            <h2 className="text-4xl font-black mb-8 text-center uppercase tracking-widest riso-title text-[var(--ink-color)]">角色确认</h2>
            
            <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-8 relative shadow-[8px_8px_0_var(--ink-color)] text-[var(--ink-color)]">
              <div className={`absolute top-0 right-0 ${charType === 'dnd' ? 'bg-[var(--accent-color)]' : 'bg-[var(--ink-color)]'} text-[var(--bg-color)] px-4 py-2 font-black tracking-widest text-sm uppercase font-vt323`}>
                {charType === 'dnd' ? 'D&D 5E SYSTEM' : 'COC 7TH SYSTEM'}
              </div>
              
              <div className="mb-8 border-b-[3px] border-dashed border-[var(--ink-color)] pb-8">
                <h3 className="text-5xl font-black mb-4 uppercase tracking-widest">{name || '无名冒险者'}</h3>
                <p className="text-[var(--accent-color)] font-black text-2xl tracking-widest">
                  {charType === 'dnd' ? `${race} ${charClass}` : `${occupation} (${age}岁)`}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                <div>
                  <h4 className="font-black opacity-60 mb-4 uppercase tracking-widest border-b-[3px] border-[var(--ink-color)] pb-2 text-xl">核心属性 / STATS</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-vt323 text-xl">
                    {Object.entries(stats).filter(([k]) => !['hp', 'mp', 'sanity', 'luck'].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b-[2px] border-dashed border-[var(--ink-color)] py-1">
                        <span className="font-bold uppercase opacity-80">{k.substring(0,3)}</span>
                        <span className="font-black">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-black opacity-60 mb-4 uppercase tracking-widest border-b-[3px] border-[var(--ink-color)] pb-2 text-xl">熟练技能 / SKILLS</h4>
                  <div className="flex flex-wrap gap-3">
                    {charType === 'dnd' ? (
                      selectedSkills.length > 0 ? selectedSkills.map(s => (
                        <span key={s} className="bg-[var(--accent-color)] text-[var(--bg-color)] px-3 py-1.5 text-lg font-bold border-[2px] border-[var(--ink-color)] tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                          {s}
                        </span>
                      )) : <span className="opacity-50 italic font-bold tracking-widest">未选择技能</span>
                    ) : (
                      Object.values(cocSkillAllocations).some(alloc => alloc.occ > 0 || alloc.per > 0)
                        ? Object.entries(cocSkillAllocations).filter(([, alloc]) => alloc.occ > 0 || alloc.per > 0).map(([s, alloc]) => {
                          const baseVal = s === '闪避' ? Math.floor((stats.dex || 0) / 2) : (s === '母语' ? (stats.edu || 0) : (COC_BASE_SKILLS[s] || 0));
                          const totalVal = baseVal + alloc.occ + alloc.per;
                          return (
                            <span key={s} className="bg-theme-bg text-[var(--ink-color)] px-3 py-1.5 text-lg font-bold border-[2px] border-[var(--ink-color)] flex gap-2 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                              {s} <span className="text-[var(--accent-color)] font-black font-vt323">{totalVal}</span>
                            </span>
                          );
                        })
                        : <span className="opacity-50 italic font-bold tracking-widest">未分配技能点</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-12 pt-8 border-t-[3px] border-dashed border-[var(--ink-color)] relative z-10">
          <button
            onClick={() => setStep(steps[currentIndex - 1])}
            disabled={currentIndex === 0}
            className={`flex items-center gap-3 px-8 py-4 font-black uppercase border-[3px] transition-all tracking-widest text-xl ${
              currentIndex === 0
                ? 'opacity-30 cursor-not-allowed border-[var(--ink-color)] text-[var(--ink-color)] bg-theme-bg'
                : 'border-[var(--ink-color)] text-[var(--ink-color)] bg-theme-bg hover:-translate-x-1 hover:shadow-[-4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)]'
            }`}
          >
            <CaretLeft className="w-6 h-6" weight="bold" /> 上一步
          </button>

          {currentIndex < steps.length - 1 ? (
            <button
              onClick={() => setStep(steps[currentIndex + 1])}
              disabled={step === 'stats' && Object.keys(stats).length === 0}
              className={`flex items-center gap-3 px-8 py-4 font-black uppercase border-[3px] transition-all tracking-widest text-xl ${
                step === 'stats' && Object.keys(stats).length === 0
                  ? 'opacity-30 cursor-not-allowed border-[var(--ink-color)] text-[var(--ink-color)] bg-theme-bg'
                  : `border-[var(--ink-color)] text-[var(--bg-color)] ${charType === 'dnd' ? 'bg-[var(--accent-color)]' : 'bg-[var(--ink-color)]'} hover:translate-x-1 hover:shadow-[4px_4px_0_var(--ink-color)]`
              }`}
            >
              下一步 <CaretRight className="w-6 h-6" weight="bold" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className={`flex items-center gap-3 px-10 py-4 font-black uppercase border-[3px] border-[var(--ink-color)] text-[var(--bg-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] active:translate-y-1 active:shadow-none transition-all text-2xl tracking-widest ${charType === 'dnd' ? 'bg-[var(--accent-color)]' : 'bg-[var(--ink-color)]'}`}
            >
              <Sparkle className="w-8 h-8" weight="fill" />
              完成创建
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CharacterCreatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CharacterCreateContent />
    </Suspense>
  );
}
