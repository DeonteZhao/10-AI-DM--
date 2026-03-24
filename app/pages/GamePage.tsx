import { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router';
import {
  Heart, Zap, Shield, Sword, Send, MapPin, ChevronRight, Package, Star,
  Brain, Dices, Eye, Compass, ChevronDown, ChevronUp, Home
} from 'lucide-react';
import {
  MODULES, SAMPLE_LOCATIONS, rollDice,
  type Character, type ChatMessage, type Location, type GameItem, type Adventure
} from '../data/gameData';
import { useGameStore } from '../data/gameStore';

// ==================== Left Panel: Character ====================
function CharacterPanel({ character }: { character: Character }) {
  const [openSection, setOpenSection] = useState<string>('stats');
  const hpPercent = (character.hp / character.maxHp) * 100;
  const mpPercent = (character.mp / character.maxMp) * 100;

  const toggle = (s: string) => setOpenSection(prev => prev === s ? '' : s);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 scrollbar-thin">
      {/* Character Header */}
      <div className="bg-[#16213e] rounded-xl p-4 border border-[#1a1a4e]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-full bg-[#533483] flex items-center justify-center text-2xl border-2 border-amber-500">
            {character.avatar}
          </div>
          <div>
            <h3 className="text-white">{character.name}</h3>
            <p className="text-xs text-gray-400">
              {character.type === 'dnd'
                ? `${character.race} ${character.class} Lv.${character.level}`
                : `${character.occupation} (${character.age}岁)`
              }
            </p>
          </div>
        </div>
        {/* HP / MP bars */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-red-400 flex items-center gap-1"><Heart className="w-3 h-3" /> HP</span>
              <span className="text-gray-400">{character.hp}/{character.maxHp}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-blue-400 flex items-center gap-1"><Zap className="w-3 h-3" /> {character.type === 'coc' ? 'SAN' : 'MP'}</span>
              <span className="text-gray-400">{character.mp}/{character.maxMp}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${mpPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-[#16213e] rounded-xl border border-[#1a1a4e] overflow-hidden">
        <button onClick={() => toggle('stats')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a4e]">
          <span className="flex items-center gap-2 text-sm text-amber-400"><Shield className="w-4 h-4" /> 属性</span>
          {openSection === 'stats' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {openSection === 'stats' && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
            {character.type === 'dnd' ? (
              <>
                {[
                  { k: 'strength', l: '力量' }, { k: 'dexterity', l: '敏捷' },
                  { k: 'constitution', l: '体质' }, { k: 'intelligence', l: '智力' },
                  { k: 'wisdom', l: '感知' }, { k: 'charisma', l: '魅力' },
                ].map(({ k, l }) => (
                  <div key={k} className="bg-[#0f0f23] rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500">{l}</p>
                    <p className="text-amber-400">{(character.stats as any)[k] ?? '—'}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { k: 'str', l: '力量' }, { k: 'con', l: '体质' }, { k: 'dex', l: '敏捷' },
                  { k: 'int', l: '智力' }, { k: 'pow', l: '意志' }, { k: 'edu', l: '教育' },
                ].map(({ k, l }) => (
                  <div key={k} className="bg-[#0f0f23] rounded p-2 text-center">
                    <p className="text-[10px] text-gray-500">{l}</p>
                    <p className="text-green-400">{(character.stats as any)[k] ?? '—'}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Items Section */}
      <div className="bg-[#16213e] rounded-xl border border-[#1a1a4e] overflow-hidden">
        <button onClick={() => toggle('items')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a4e]">
          <span className="flex items-center gap-2 text-sm text-amber-400"><Package className="w-4 h-4" /> 物品栏</span>
          {openSection === 'items' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {openSection === 'items' && (
          <div className="px-4 pb-3 space-y-1">
            {character.items.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-[#0f0f23] rounded px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{
                    item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' :
                    item.type === 'consumable' ? '🧪' : item.type === 'key' ? '🔑' : '📦'
                  }</span>
                  <span className="text-sm text-gray-300">{item.name}</span>
                </div>
                <span className="text-xs text-gray-500">x{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div className="bg-[#16213e] rounded-xl border border-[#1a1a4e] overflow-hidden">
        <button onClick={() => toggle('skills')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a4e]">
          <span className="flex items-center gap-2 text-sm text-amber-400"><Star className="w-4 h-4" /> 技能</span>
          {openSection === 'skills' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {openSection === 'skills' && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {character.skills.map(skill => (
              <span key={skill} className="px-2 py-1 rounded text-xs bg-[#0f0f23] text-gray-300">{skill}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Center: Chat ====================
function ChatPanel({
  messages, onSend, characterType
}: {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  characterType: 'dnd' | 'coc';
}) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const dmTitle = characterType === 'dnd' ? 'DM' : 'KP';

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="px-4 py-3 bg-[#16213e] border-b border-[#1a1a4e] flex items-center gap-2">
        <Brain className="w-5 h-5 text-amber-400" />
        <span className="text-white">与 {dmTitle} 的对话</span>
        <span className="text-xs text-gray-500 ml-auto">AI {dmTitle}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.sender === 'player'
                ? 'bg-amber-600/30 border border-amber-600/40 rounded-br-sm'
                : msg.type === 'system'
                  ? 'bg-purple-900/30 border border-purple-600/30 text-center w-full max-w-full'
                  : msg.type === 'roll'
                    ? 'bg-[#1a1a4e] border border-amber-500/30'
                    : 'bg-[#16213e] border border-[#1a1a4e] rounded-bl-sm'
            }`}>
              {msg.sender === 'dm' && msg.type !== 'system' && (
                <p className="text-xs text-amber-400 mb-1">{dmTitle}</p>
              )}
              {msg.type === 'roll' && msg.rollResult && (
                <div className="flex items-center gap-2 mb-1">
                  <Dices className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-gray-400">{msg.rollResult.dice} = </span>
                  <span className={`text-sm ${msg.rollResult.success !== undefined ? (msg.rollResult.success ? 'text-green-400' : 'text-red-400') : 'text-amber-400'}`}>
                    {msg.rollResult.result}
                    {msg.rollResult.success !== undefined && (msg.rollResult.success ? ' 成功!' : ' 失败')}
                  </span>
                </div>
              )}
              <p className={`text-sm whitespace-pre-wrap ${
                msg.type === 'system' ? 'text-purple-300' :
                msg.type === 'narrative' ? 'text-gray-300 italic' : 'text-gray-200'
              }`}>
                {msg.content}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 flex gap-2 border-t border-[#1a1a4e]">
        {['观察周围', '搜索线索', '前进', '检查'].map(action => (
          <button
            key={action}
            onClick={() => onSend(action)}
            className="px-3 py-1 rounded-full text-xs bg-[#16213e] text-gray-400 hover:text-white hover:bg-[#1a1a4e] transition-colors border border-[#1a1a4e]"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-[#16213e] border-t border-[#1a1a4e]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="输入你的行动或对话..."
            className="flex-1 bg-[#0f0f23] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="p-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Right Panel: Map/Quest ====================
function MapPanel({
  locations, currentLocationId, onTravel
}: {
  locations: Location[];
  currentLocationId: string;
  onTravel: (id: string) => void;
}) {
  const [tab, setTab] = useState<'map' | 'quest'>('map');

  const findLocation = (id: string): Location | undefined => {
    for (const loc of locations) {
      if (loc.id === id) return loc;
      if (loc.children) {
        const child = loc.children.find(c => c.id === id);
        if (child) return child;
      }
    }
    return undefined;
  };

  const currentLoc = findLocation(currentLocationId);

  const quests = [
    { id: 'q1', title: '追查疫病源头', description: '调查艾登镇附近蔓延的神秘疾病', status: 'active' as const },
    { id: 'q2', title: '酒馆的请求', description: '酒馆老板请你寻找失踪的供货商', status: 'active' as const },
    { id: 'q3', title: '搜集草药', description: '为镇上的医生搜集3份草药', status: 'completed' as const },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="flex bg-[#16213e] border-b border-[#1a1a4e]">
        <button
          onClick={() => setTab('map')}
          className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'map' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Compass className="w-4 h-4" /> 地图
        </button>
        <button
          onClick={() => setTab('quest')}
          className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'quest' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Eye className="w-4 h-4" /> 任务
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'map' ? (
          <div className="space-y-3">
            {/* Current Location */}
            {currentLoc && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">当前位置</span>
                </div>
                <h3 className="text-white">{currentLoc.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{currentLoc.description}</p>
              </div>
            )}

            {/* Location Tree */}
            {locations.map(area => (
              <div key={area.id} className="bg-[#16213e] rounded-xl border border-[#1a1a4e] overflow-hidden">
                <button
                  onClick={() => area.explored && onTravel(area.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${
                    area.id === currentLocationId ? 'bg-amber-500/10' : ''
                  } ${area.explored ? 'hover:bg-[#1a1a4e]' : 'opacity-50'}`}
                >
                  <MapPin className={`w-4 h-4 ${area.explored ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className={`text-sm ${area.id === currentLocationId ? 'text-amber-400' : area.explored ? 'text-gray-300' : 'text-gray-600'}`}>
                    {area.explored ? area.name : '???'}
                  </span>
                  {area.id === currentLocationId && (
                    <span className="ml-auto text-[10px] text-amber-500 bg-amber-500/20 px-1.5 py-0.5 rounded">在此</span>
                  )}
                </button>
                {area.children && (
                  <div className="border-t border-[#0f0f23]">
                    {area.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => child.explored && onTravel(child.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 pl-8 text-left ${
                          child.id === currentLocationId ? 'bg-amber-500/10' : ''
                        } ${child.explored ? 'hover:bg-[#1a1a4e]' : 'opacity-50'}`}
                      >
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className={`text-xs ${child.id === currentLocationId ? 'text-amber-400' : child.explored ? 'text-gray-400' : 'text-gray-700'}`}>
                          {child.explored ? child.name : '???'}
                        </span>
                        {child.id === currentLocationId && (
                          <span className="ml-auto text-[10px] text-amber-500 bg-amber-500/20 px-1.5 py-0.5 rounded">在此</span>
                        )}
                        {!child.explored && (
                          <span className="ml-auto text-[10px] text-gray-600">未探索</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {quests.map(quest => (
              <div
                key={quest.id}
                className={`rounded-xl p-3 border ${
                  quest.status === 'active'
                    ? 'bg-[#16213e] border-amber-500/30'
                    : 'bg-[#16213e]/50 border-[#1a1a4e]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {quest.status === 'active' ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                  <h4 className={`text-sm ${quest.status === 'active' ? 'text-white' : 'text-gray-500 line-through'}`}>
                    {quest.title}
                  </h4>
                </div>
                <p className="text-xs text-gray-500 ml-4">{quest.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Main Game Page ====================
export function GamePage() {
  const { adventureId } = useParams();
  const [searchParams] = useSearchParams();
  const { characters, adventures, addAdventure } = useGameStore();

  // Determine character and module
  const moduleParam = searchParams.get('module');
  const charParam = searchParams.get('character');

  const module = moduleParam ? MODULES.find(m => m.id === moduleParam) : null;
  const existingAdventure = adventures.find(a => a.id === adventureId);

  // If new game, create adventure
  const [character] = useState<Character>(() => {
    if (charParam) {
      return characters.find(c => c.id === charParam) || createDefaultCharacter();
    }
    if (existingAdventure) {
      return characters.find(c => c.id === existingAdventure.characterId) || createDefaultCharacter();
    }
    return characters[characters.length - 1] || createDefaultCharacter();
  });

  const [currentLocationId, setCurrentLocationId] = useState('tavern');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const moduleName = module?.name || existingAdventure?.moduleName || '未知模组';
    const dmTitle = character.type === 'dnd' ? 'DM' : 'KP';
    return [
      {
        id: '1',
        sender: 'dm',
        content: `欢迎来到【${moduleName}】`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'system',
      },
      {
        id: '2',
        sender: 'dm',
        content: character.type === 'dnd'
          ? `你站在艾登镇的醉龙酒馆门前。寒风凛冽，镇上弥漫着一股不安的气息。最近这个偏远的小镇被一种神秘的疾病所困扰——人们称之为"冰冻病"。患者的皮肤会逐渐变得冰冷透蓝，最终陷入永恒的沉睡。\n\n酒馆内传来微弱的灯光和低沉的交谈声。门口的告示栏上贴着一张寻求帮助的公告。\n\n你要怎么做？`
          : `1925年，马萨诸塞州阿卡姆市。你收到一封来自老朋友的信件，邀请你前往城郊的一座维多利亚式古宅进行调查。据说那里最近频繁发生怪异事件——深夜的脚步声、无法解释的低语、以及消失的邻居。\n\n你站在古宅前，夜色笼罩四周。老旧的铁门发出嘎吱声。\n\n你要怎么做？`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'narrative',
      },
    ];
  });

  // Save adventure on first load
  useEffect(() => {
    if (adventureId === 'new' && module && character) {
      const newAdv: Adventure = {
        id: `adv_${Date.now()}`,
        moduleId: module.id,
        characterId: character.id,
        moduleName: module.name,
        characterName: character.name,
        moduleType: module.type,
        progress: 5,
        lastPlayed: '刚刚',
        image: module.image,
        currentLocation: '酒馆',
      };
      addAdventure(newAdv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = (text: string) => {
    const playerMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'player',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      type: 'dialog',
    };
    setMessages(prev => [...prev, playerMsg]);

    // Simulate DM response
    setTimeout(() => {
      const responses = getDMResponse(text, character.type);
      setMessages(prev => [...prev, ...responses]);
    }, 800 + Math.random() * 1200);
  };

  const handleTravel = (locationId: string) => {
    setCurrentLocationId(locationId);
    const loc = findLocationById(locationId);
    if (loc) {
      const travelMsg: ChatMessage = {
        id: `msg_${Date.now()}_travel`,
        sender: 'dm',
        content: `你来到了 ${loc.name}。`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'system',
      };
      const descMsg: ChatMessage = {
        id: `msg_${Date.now()}_desc`,
        sender: 'dm',
        content: loc.description + '\n\n你四处打量，这里似乎有些值得注意的地方...',
        timestamp: new Date().toLocaleTimeString(),
        type: 'narrative',
      };
      setMessages(prev => [...prev, travelMsg, descMsg]);
    }
  };

  return (
    <div className="h-[calc(100vh-56px)] flex">
      {/* Left: Character */}
      <div className="w-64 bg-[#0f0f23] border-r border-[#1a1a4e] flex-shrink-0 hidden lg:block">
        <CharacterPanel character={character} />
      </div>

      {/* Center: Chat */}
      <div className="flex-1 bg-[#0a0a1a] flex flex-col min-w-0">
        <ChatPanel messages={messages} onSend={handleSend} characterType={character.type} />
      </div>

      {/* Right: Map/Quest */}
      <div className="w-72 bg-[#0f0f23] border-l border-[#1a1a4e] flex-shrink-0 hidden md:block">
        <MapPanel
          locations={SAMPLE_LOCATIONS}
          currentLocationId={currentLocationId}
          onTravel={handleTravel}
        />
      </div>
    </div>
  );
}

// ==================== Helpers ====================
function createDefaultCharacter(): Character {
  return {
    id: 'default',
    name: '无名冒险者',
    type: 'dnd',
    class: '战士',
    race: '人类',
    level: 1,
    stats: { strength: 14, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 11, charisma: 10 },
    skills: ['运动', '侦察', '生存'],
    items: [
      { id: 'i1', name: '长剑', description: '一把普通长剑', type: 'weapon', quantity: 1 },
      { id: 'i2', name: '皮甲', description: '基础防具', type: 'armor', quantity: 1 },
      { id: 'i3', name: '治疗药水', description: '恢复2d4+2HP', type: 'consumable', quantity: 2 },
      { id: 'i4', name: '火把', description: '照明用', type: 'misc', quantity: 3 },
    ],
    avatar: '⚔️',
    hp: 12,
    maxHp: 12,
    mp: 4,
    maxMp: 4,
  };
}

function findLocationById(id: string): Location | undefined {
  for (const loc of SAMPLE_LOCATIONS) {
    if (loc.id === id) return loc;
    if (loc.children) {
      const c = loc.children.find(ch => ch.id === id);
      if (c) return c;
    }
  }
  return undefined;
}

function getDMResponse(input: string, type: 'dnd' | 'coc'): ChatMessage[] {
  const now = new Date().toLocaleTimeString();
  const results: ChatMessage[] = [];

  const lowerInput = input.toLowerCase();

  // Check for skill checks
  if (lowerInput.includes('观察') || lowerInput.includes('搜索') || lowerInput.includes('检查') || lowerInput.includes('侦查')) {
    const roll = rollDice(20);
    const dc = 12;
    results.push({
      id: `msg_${Date.now()}_roll`,
      sender: 'dm',
      content: type === 'dnd' ? '进行侦察检定...' : '进行侦查技能检定...',
      timestamp: now,
      type: 'roll',
      rollResult: {
        dice: type === 'dnd' ? 'D20' : 'D100',
        result: type === 'dnd' ? roll : roll * 5,
        success: roll >= dc,
      },
    });

    if (roll >= dc) {
      results.push({
        id: `msg_${Date.now()}_result`,
        sender: 'dm',
        content: type === 'dnd'
          ? '你仔细观察四周，注意到墙角有一个暗门的痕迹。门缝中透出微弱的冷光，空气中弥漫着一股腐朽的气息。你还发现地上有一些奇怪的符文标记。'
          : '你敏锐的目光捕捉到了几个细节：壁炉上方的画像似乎被移动过，地毯下有轻微的凸起，书架上有一本书明显比其他的新得多。这些都值得进一步调查。',
        timestamp: now,
        type: 'narrative',
      });
    } else {
      results.push({
        id: `msg_${Date.now()}_result`,
        sender: 'dm',
        content: '你仔细观察了周围，但没有发现什么特别的东西。也许换个地方或者换个方式再试试？',
        timestamp: now,
        type: 'narrative',
      });
    }
    return results;
  }

  if (lowerInput.includes('前进') || lowerInput.includes('进入') || lowerInput.includes('走')) {
    results.push({
      id: `msg_${Date.now()}_move`,
      sender: 'dm',
      content: type === 'dnd'
        ? '你沿着走廊小心前进。火把的光芒在石壁上投射出摇曳的影子。前方有一个岔路口——左边传来水流声，右边则是一片漆黑的寂静。\n\n你要往哪个方向走？'
        : '你推开吱嘎作响的门，走进了下一个房间。这是一间书房，到处堆满了发黄的文件和古老的书籍。空气中弥漫着霉味和另一种你说不出的奇怪气味。\n\n桌上有一本翻开的日记，旁边还有一个上锁的抽屉。',
      timestamp: now,
      type: 'narrative',
    });
    return results;
  }

  // Default response
  const defaultResponses = type === 'dnd' ? [
    '酒馆老板看着你，缓缓说道："冒险者，你来得正好。镇上的人越来越多生病了，我们急需有人去冰封洞穴一探究竟。"\n\n他递给你一份地图碎片。"这是我能找到的唯一线索了。"',
    '一个神秘的旅人坐在角落里，向你招了招手。"我听说你在寻找关于冰冻病的线索，"他低声说，"我知道一些东西...但需要你先帮我一个忙。"',
    '你注意到酒馆的墙上挂着一张冒险者公会的告示牌。上面列着几个待完成的任务，其中一个用红色标记为"紧急"。',
  ] : [
    '"你不该来这里的，"一个沙哑的声音从黑暗中传来。你转身，但什么也没看到。只有墙上的烛火在微微摇曳，投射出诡异的影子。\n\n你的SAN值微微波动。',
    '你翻开那本古老的日记，上面记录着前任房主的日常，但最后几页变得越来越混乱。字迹扭曲，重复出现一些无法理解的符号。最后一页只写着："它们在墙里。不要听。不要看。"',
    '一阵冷风从不知何处吹来，蜡烛熄灭了几根。在短暂的黑暗中，你似乎听到了楼上传来的脚步声，沉重而缓慢。但这栋房子据说已经荒废多年了...',
  ];

  results.push({
    id: `msg_${Date.now()}_resp`,
    sender: 'dm',
    content: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
    timestamp: now,
    type: 'narrative',
  });

  return results;
}