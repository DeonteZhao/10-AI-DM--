import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Dices, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import {
  MODULES, DND_CLASSES, DND_RACES, COC_OCCUPATIONS,
  rollStat, roll3d6,
  type ModuleType, type Character, type CharacterStats
} from '../data/gameData';
import { useGameStore } from '../data/gameStore';

type Step = 'type' | 'basic' | 'stats' | 'skills' | 'confirm';

const DND_SKILLS = ['运动', '体操', '隐匿', '侦察', '洞悉', '医药', '生存', '说服', '欺骗', '威吓', '奥秘', '历史', '自然', '宗教'];
const COC_SKILLS = ['侦查', '图书馆利用', '聆听', '闪避', '心理学', '急救', '潜行', '攀爬', '跳跃', '斗殴', '射击', '驾驶', '电气维修', '机械维修'];

export function CharacterCreatePage() {
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');
  const module = moduleId ? MODULES.find(m => m.id === moduleId) : null;
  const navigate = useNavigate();
  const { addCharacter } = useGameStore();

  const [step, setStep] = useState<Step>(module ? 'basic' : 'type');
  const [charType, setCharType] = useState<ModuleType>(module?.type || 'dnd');
  const [name, setName] = useState('');
  const [charClass, setCharClass] = useState(DND_CLASSES[0]);
  const [race, setRace] = useState(DND_RACES[0]);
  const [occupation, setOccupation] = useState(COC_OCCUPATIONS[0]);
  const [age, setAge] = useState(25);
  const [stats, setStats] = useState<CharacterStats>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const steps: Step[] = module ? ['basic', 'stats', 'skills', 'confirm'] : ['type', 'basic', 'stats', 'skills', 'confirm'];
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
      setStats({
        strength: rollStat(),
        dexterity: rollStat(),
        constitution: rollStat(),
        intelligence: rollStat(),
        wisdom: rollStat(),
        charisma: rollStat(),
      });
    } else {
      const str = roll3d6() * 5;
      const con = roll3d6() * 5;
      const siz = (roll3d6() + 6) * 5 / 3;
      const dex = roll3d6() * 5;
      const app = roll3d6() * 5;
      const int_ = (roll3d6() + 6) * 5 / 3;
      const pow = roll3d6() * 5;
      const edu = (roll3d6() + 6) * 5 / 3;
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
        hp: Math.round((con + siz) / 10),
        mp: Math.round(pow / 5),
      });
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : prev.length < 6 ? [...prev, skill] : prev
    );
  };

  const handleConfirm = () => {
    const maxHp = charType === 'dnd' ? 10 + (stats.constitution ? Math.floor((stats.constitution - 10) / 2) : 0) : (stats.hp || 10);
    const maxMp = charType === 'dnd' ? 4 + (stats.intelligence ? Math.floor((stats.intelligence - 10) / 2) : 0) : (stats.mp || 8);
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
      stats,
      skills: selectedSkills,
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

    if (module) {
      navigate(`/game/new?module=${module.id}&character=${char.id}`);
    } else {
      navigate(`/modules?type=${charType}`);
    }
  };

  const canNext = () => {
    if (step === 'type') return true;
    if (step === 'basic') return name.trim().length > 0;
    if (step === 'stats') return Object.keys(stats).length > 0;
    if (step === 'skills') return selectedSkills.length >= 3;
    return true;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              i <= currentIndex ? 'bg-amber-500 text-black' : 'bg-[#16213e] text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i <= currentIndex ? 'text-amber-400' : 'text-gray-500'}`}>
              {stepLabels[s]}
            </span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${i < currentIndex ? 'bg-amber-500' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-[#16213e] rounded-2xl border border-[#1a1a4e] p-6 min-h-[400px]">
        {/* Step: Choose Type */}
        {step === 'type' && (
          <div>
            <h2 className="text-2xl text-white mb-2">选择游戏体系</h2>
            <p className="text-gray-400 mb-6">不同体系有不同的角色创建流程和游戏规则</p>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setCharType('dnd')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  charType === 'dnd' ? 'border-red-500 bg-red-500/10' : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <h3 className="text-xl text-white mb-2">D&D 龙与地下城</h3>
                <p className="text-gray-400 text-sm">
                  经典奇幻冒险，创建英勇角色探索地下城、击败邪恶势力。以力量、敏捷等六大属性为核心。
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="px-2 py-0.5 rounded text-xs bg-red-600/50 text-red-300">奇幻</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-red-600/50 text-red-300">冒险</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-red-600/50 text-red-300">战斗</span>
                </div>
              </button>
              <button
                onClick={() => setCharType('coc')}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  charType === 'coc' ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <h3 className="text-xl text-white mb-2">CoC 克苏鲁的呼唤</h3>
                <p className="text-gray-400 text-sm">
                  克苏鲁神话背景的恐怖调查游戏。作为普通人面对不可名状的恐怖，SAN值是关键要素。
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="px-2 py-0.5 rounded text-xs bg-green-700/50 text-green-300">恐怖</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-green-700/50 text-green-300">调查</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-green-700/50 text-green-300">推理</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Basic Info */}
        {step === 'basic' && (
          <div>
            <h2 className="text-2xl text-white mb-2">
              {charType === 'dnd' ? '创建D&D角色' : '创建CoC调查员'}
            </h2>
            <p className="text-gray-400 mb-6">填写角色基本信息</p>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-1">角色名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={charType === 'dnd' ? '例如：亚瑟·银月' : '例如：约翰·史密斯'}
                  className="w-full bg-[#0f0f23] border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {charType === 'dnd' ? (
                <>
                  <div>
                    <label className="block text-gray-300 mb-1">种族</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DND_RACES.map(r => (
                        <button
                          key={r}
                          onClick={() => setRace(r)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            race === r ? 'bg-amber-500 text-black' : 'bg-[#0f0f23] text-gray-400 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">职业</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DND_CLASSES.map(c => (
                        <button
                          key={c}
                          onClick={() => setCharClass(c)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            charClass === c ? 'bg-amber-500 text-black' : 'bg-[#0f0f23] text-gray-400 hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-300 mb-1">职业</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COC_OCCUPATIONS.map(o => (
                        <button
                          key={o}
                          onClick={() => setOccupation(o)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            occupation === o ? 'bg-green-600 text-white' : 'bg-[#0f0f23] text-gray-400 hover:text-white'
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">年龄: {age}</label>
                    <input
                      type="range"
                      min={15}
                      max={80}
                      value={age}
                      onChange={e => setAge(Number(e.target.value))}
                      className="w-full accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>15</span><span>80</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step: Stats */}
        {step === 'stats' && (
          <div>
            <h2 className="text-2xl text-white mb-2">属性分配</h2>
            <p className="text-gray-400 mb-4">点击骰子随机生成属性值</p>

            <button
              onClick={rollAllStats}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors mb-6"
            >
              <Dices className="w-5 h-5" /> 投骰生成属性
            </button>

            {Object.keys(stats).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {charType === 'dnd' ? (
                  <>
                    {[
                      { key: 'strength', label: '力量 STR' },
                      { key: 'dexterity', label: '敏捷 DEX' },
                      { key: 'constitution', label: '体质 CON' },
                      { key: 'intelligence', label: '智力 INT' },
                      { key: 'wisdom', label: '感知 WIS' },
                      { key: 'charisma', label: '魅力 CHA' },
                    ].map(({ key, label }) => (
                      <div key={key} className="bg-[#0f0f23] rounded-lg p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className="text-3xl text-amber-400">{(stats as any)[key]}</p>
                        <p className="text-xs text-gray-500">
                          修正值: {(stats as any)[key] >= 10 ? '+' : ''}{Math.floor(((stats as any)[key] - 10) / 2)}
                        </p>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { key: 'str', label: '力量' },
                      { key: 'con', label: '体质' },
                      { key: 'siz', label: '体型' },
                      { key: 'dex', label: '敏捷' },
                      { key: 'app', label: '外貌' },
                      { key: 'int', label: '智力' },
                      { key: 'pow', label: '意志' },
                      { key: 'edu', label: '教育' },
                      { key: 'luck', label: '幸运' },
                      { key: 'sanity', label: 'SAN值' },
                      { key: 'hp', label: '生命' },
                      { key: 'mp', label: '魔法' },
                    ].map(({ key, label }) => (
                      <div key={key} className="bg-[#0f0f23] rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className="text-2xl text-green-400">{(stats as any)[key]}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Skills */}
        {step === 'skills' && (
          <div>
            <h2 className="text-2xl text-white mb-2">选择技能</h2>
            <p className="text-gray-400 mb-6">选择3-6个擅长技能 (已选 {selectedSkills.length}/6)</p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {(charType === 'dnd' ? DND_SKILLS : COC_SKILLS).map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedSkills.includes(skill)
                      ? charType === 'dnd' ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'
                      : 'bg-[#0f0f23] text-gray-400 hover:text-white'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div>
            <div className="text-center mb-6">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h2 className="text-2xl text-white mb-2">角色创建完成!</h2>
              <p className="text-gray-400">确认你的角色信息</p>
            </div>

            <div className="bg-[#0f0f23] rounded-xl p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">名称</span>
                <span className="text-white">{name || '无名冒险者'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">体系</span>
                <span className={charType === 'dnd' ? 'text-red-400' : 'text-green-400'}>
                  {charType === 'dnd' ? 'D&D' : 'CoC'}
                </span>
              </div>
              {charType === 'dnd' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">种族</span><span className="text-white">{race}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">职业</span><span className="text-white">{charClass}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">职业</span><span className="text-white">{occupation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">年龄</span><span className="text-white">{age}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">技能</span>
                <span className="text-white">{selectedSkills.join(', ')}</span>
              </div>
              {module && (
                <div className="flex justify-between">
                  <span className="text-gray-400">模组</span>
                  <span className="text-amber-400">{module.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => currentIndex > 0 && setStep(steps[currentIndex - 1])}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#16213e] text-gray-400 disabled:opacity-30 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> 上一步
        </button>
        {step === 'confirm' ? (
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1 px-6 py-2 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors"
          >
            {module ? '开始冒险' : '完成创建'} <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => canNext() && setStep(steps[currentIndex + 1])}
            disabled={!canNext()}
            className="flex items-center gap-1 px-6 py-2 rounded-lg bg-amber-500 text-black disabled:opacity-50 hover:bg-amber-400 transition-colors"
          >
            下一步 <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
