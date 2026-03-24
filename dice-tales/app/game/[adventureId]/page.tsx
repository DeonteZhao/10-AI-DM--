"use client";

import { useState, useRef, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  PaperPlaneRight, MapPin, CaretRight,
  Brain, DiceFive, Eye, Compass,
  Sword, PersonSimpleRun, ShieldPlus, MagicWand
} from '@phosphor-icons/react';
import {
  MODULES, SAMPLE_LOCATIONS,
  type Character, type ChatMessage, type Location, type Adventure,
  DND_SKILLS_MAP, calculateModifier, rollDice
} from '@/lib/gameData';
import { useGameStore } from '@/lib/gameStore';
import { CharacterPanel } from '@/components/CharacterPanel';

// ==================== Center: Chat ====================
function ChatPanel({
  messages, onSend, character, onRoll, onRest, moduleType
}: {
  messages: ChatMessage[];
  onSend: (msg: string) => void;
  character: Character;
  onRoll: (check: NonNullable<ChatMessage['requiredCheck']>) => void;
  onRest: (type: 'short' | 'long' | 'first_aid' | 'psychoanalysis') => void;
  moduleType: 'dnd' | 'coc';
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

  const dmTitle = moduleType === 'dnd' ? 'DM' : 'KP';

  return (
    <div className="h-full flex flex-col font-huiwen bg-[var(--paper-light)] z-0">
      {/* Chat Header */}
      <div className="px-6 h-[60px] bg-theme-bg border-b-[3px] border-[var(--ink-color)] flex items-center gap-3 shrink-0 relative z-0">
        <Brain className="w-7 h-7 text-[var(--ink-color)]" weight="fill" />
        <span className="text-[var(--ink-color)] font-black tracking-widest uppercase text-lg">与 {dmTitle} 的对话</span>
        <span className="text-xs text-[var(--bg-color)] bg-[var(--ink-color)] px-3 py-1 ml-auto font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--accent-color)] font-vt323">AI {dmTitle}</span>
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[var(--ink-color)] opacity-20 transform translate-y-1"></div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'player' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-4 border-[3px] relative ${
              msg.sender === 'player'
                ? 'bg-[var(--ink-color)] border-[var(--ink-color)] text-[var(--bg-color)] ml-8 shadow-[-4px_4px_0_var(--ink-color)]'
                : msg.type === 'system'
                  ? 'bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] text-center w-full max-w-full shadow-[4px_4px_0_var(--ink-color)] border-dashed'
                  : msg.type === 'roll'
                    ? 'bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]'
                    : 'bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] mr-8 shadow-[4px_4px_0_var(--ink-color)]'
            }`}>
              {msg.sender === 'dm' && msg.type !== 'system' && (
                <div className="absolute -top-3 -left-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 text-xs font-bold uppercase font-vt323 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                  {dmTitle}
                </div>
              )}
              {msg.sender === 'player' && (
                <div className="absolute -top-3 -right-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 text-xs font-bold uppercase font-vt323 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                  PLAYER
                </div>
              )}
              {msg.type === 'roll' && msg.rollResult && (
                <div className="flex items-center gap-2 mb-3 bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1.5 inline-flex font-vt323 tracking-widest">
                  <DiceFive className="w-5 h-5 text-[var(--bg-color)]" weight="fill" />
                  <span className="text-sm font-bold uppercase opacity-80">{msg.rollResult.dice} CHECK: </span>
                  <span className={`text-base font-black ${msg.rollResult.success !== undefined ? (msg.rollResult.success ? 'text-[#a8e6cf]' : 'text-[#ff8b94]') : 'text-[var(--accent-color)]'}`}>
                    {msg.rollResult.result}
                    {msg.rollResult.success !== undefined && (msg.rollResult.success ? ' (SUCCESS)' : ' (FAIL)')}
                  </span>
                </div>
              )}
              <p className={`text-lg whitespace-pre-wrap leading-relaxed tracking-wide ${
                msg.type === 'system' ? 'font-black tracking-widest uppercase opacity-80' :
                msg.type === 'narrative' ? 'opacity-90 font-medium' : 'font-medium'
              }`}>
                {msg.content}
              </p>
              
              {/* Required Check Button */}
              {msg.requiredCheck && msg.sender === 'dm' && (
                <div className="mt-5 border-t-[3px] border-dashed border-[var(--ink-color)] pt-4">
                  <button
                    onClick={() => onRoll(msg.requiredCheck!)}
                    className="flex items-center gap-2 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-black uppercase tracking-widest hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-color)] active:translate-y-0 active:shadow-none transition-all"
                  >
                    <DiceFive className="w-6 h-6" weight="fill" />
                    进行 {msg.requiredCheck.name} 检定
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions (Combat & Exploration) */}
      <div className="px-6 py-4 border-t-[3px] border-[var(--ink-color)] bg-theme-bg flex flex-col gap-3 relative z-10">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-sm font-black text-[var(--ink-color)] uppercase flex items-center mr-2 tracking-widest opacity-60">探索:</span>
          {['观察周围', '搜索线索', '前进', '检查'].map(action => (
            <button
              key={action}
              onClick={() => onSend(action)}
              className="whitespace-nowrap px-4 py-1.5 bg-theme-bg text-[var(--ink-color)] font-bold tracking-widest hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] hover:translate-y-px hover:shadow-[1px_1px_0_var(--ink-color)]"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none items-center justify-between">
           <div className="flex gap-3 items-center">
             <span className="text-sm font-black text-[var(--accent-color)] uppercase flex items-center mr-2 shrink-0 tracking-widest">
               {moduleType === 'dnd' ? '战斗:' : '应对:'}
             </span>
             {moduleType === 'dnd' ? (
               <>
                 {['攻击', '施法', '疾走', '躲藏'].map(act => (
                   <button
                     key={act}
                     onClick={() => onSend(`我进行 [${act}]`)}
                     className={`flex items-center gap-2 whitespace-nowrap px-4 py-1.5 font-bold tracking-widest transition-colors border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] hover:translate-y-px hover:shadow-[1px_1px_0_var(--ink-color)] ${
                       act === '攻击' ? 'bg-[var(--accent-color)] text-[var(--bg-color)] hover:bg-[#ff5555]' :
                       act === '施法' ? 'bg-[var(--ink-color)] text-[var(--bg-color)] hover:bg-[#333]' :
                       'bg-theme-bg text-[var(--ink-color)] hover:bg-[var(--paper-light)]'
                     }`}
                   >
                     {act === '攻击' && <Sword weight="fill" />}
                     {act === '施法' && <MagicWand weight="fill" />}
                     {act === '疾走' && <PersonSimpleRun weight="fill" />}
                     {act === '躲藏' && <ShieldPlus weight="fill" />}
                     {act}
                   </button>
                 ))}
               </>
             ) : (
               <>
                 {['斗殴/射击', '闪避', '掩护', '逃跑'].map(act => (
                   <button
                     key={act}
                     onClick={() => onSend(`我进行 [${act}]`)}
                     className={`flex items-center gap-2 whitespace-nowrap px-4 py-1.5 font-bold tracking-widest transition-colors border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] hover:translate-y-px hover:shadow-[1px_1px_0_var(--ink-color)] ${
                       act === '斗殴/射击' ? 'bg-[var(--accent-color)] text-[var(--bg-color)] hover:bg-[#ff5555]' :
                       act === '闪避' ? 'bg-[var(--ink-color)] text-[var(--bg-color)] hover:bg-[#333]' :
                       'bg-theme-bg text-[var(--ink-color)] hover:bg-[var(--paper-light)]'
                     }`}
                   >
                     {act === '斗殴/射击' && <Sword weight="fill" />}
                     {act === '闪避' && <ShieldPlus weight="fill" />}
                     {act === '掩护' && <ShieldPlus weight="fill" />}
                     {act === '逃跑' && <PersonSimpleRun weight="fill" />}
                     {act}
                   </button>
                 ))}
               </>
             )}
           </div>
            
           <div className="flex gap-3 items-center shrink-0 ml-6">
             <div className="h-6 w-[3px] bg-[var(--ink-color)] opacity-20 mx-1 shrink-0"></div>
             
             {moduleType === 'dnd' ? (
               <>
                 <button 
                   onClick={() => onRest('short')}
                   className="bg-theme-bg border-[2px] border-[var(--ink-color)] text-[var(--ink-color)] font-bold tracking-widest uppercase px-4 py-1.5 text-sm shadow-[2px_2px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-px active:shadow-none whitespace-nowrap shrink-0"
                 >
                   短休
                 </button>
                 <button 
                   onClick={() => onRest('long')}
                   className="bg-[var(--ink-color)] border-[2px] border-[var(--ink-color)] text-[var(--bg-color)] font-bold tracking-widest uppercase px-4 py-1.5 text-sm shadow-[2px_2px_0_var(--ink-color)] hover:bg-[#333] active:translate-y-px active:shadow-none whitespace-nowrap shrink-0"
                 >
                   长休
                 </button>
               </>
             ) : (
               <>
                 <button 
                   onClick={() => onRest('first_aid')}
                   className="bg-theme-bg border-[2px] border-[var(--ink-color)] text-[var(--ink-color)] font-bold tracking-widest uppercase px-4 py-1.5 text-sm shadow-[2px_2px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-px active:shadow-none whitespace-nowrap shrink-0 flex items-center gap-1"
                 >
                   <span className="text-lg">✚</span> 急救
                 </button>
                 <button 
                   onClick={() => onRest('psychoanalysis')}
                   className="bg-[var(--ink-color)] border-[2px] border-[var(--ink-color)] text-[var(--bg-color)] font-bold tracking-widest uppercase px-4 py-1.5 text-sm shadow-[2px_2px_0_var(--ink-color)] hover:bg-[#333] active:translate-y-px active:shadow-none whitespace-nowrap shrink-0 flex items-center gap-1"
                 >
                   <Brain weight="fill" className="w-4 h-4" /> 精神分析
                 </button>
               </>
             )}
           </div>
         </div>
      </div>

      {/* Input */}
      <div className="p-6 bg-theme-bg border-t-[3px] border-dashed border-[var(--ink-color)] relative z-10">
        <div className="flex items-end gap-3 bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-2 shadow-[4px_4px_0_var(--ink-color)] focus-within:bg-theme-bg transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入你的行动..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[48px] text-[var(--ink-color)] font-bold text-lg p-3 placeholder:text-[var(--ink-color)] placeholder:opacity-40 tracking-wide font-huiwen"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-4 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] disabled:opacity-50 disabled:bg-[var(--ink-color)] transition-colors shadow-[2px_2px_0_var(--ink-color)] active:translate-y-px active:shadow-none"
          >
            <PaperPlaneRight className="w-6 h-6" weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Right Panel: Map/Quest/Rest ====================
function MapPanel({
  locations, currentLocationId, onTravel, quests
}: {
  locations: Location[];
  currentLocationId: string;
  onTravel: (locId: string) => void;
  quests: { id: string; title: string; description: string; status: 'active' | 'completed' }[];
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

  return (
    <div className="h-full flex flex-col bg-theme-bg font-huiwen z-0">
      {/* Tab Header */}
      <div className="flex h-[60px] bg-[var(--paper-light)] border-b-[3px] border-[var(--ink-color)] shrink-0 z-0">
        <button 
          onClick={() => setTab('map')}
          className={`flex-1 flex items-center justify-center gap-2 font-black tracking-widest uppercase transition-colors border-r-[3px] border-[var(--ink-color)] h-full text-lg ${tab === 'map' ? 'bg-[var(--ink-color)] text-[var(--bg-color)]' : 'text-[var(--ink-color)] opacity-60 hover:opacity-100 hover:bg-theme-bg'}`}
        >
          <Compass className="w-6 h-6" weight="fill" /> <span className="leading-none mt-1">地图</span>
        </button>
        <button 
          onClick={() => setTab('quest')}
          className={`flex-1 flex items-center justify-center gap-2 font-black tracking-widest uppercase transition-colors h-full text-lg ${tab === 'quest' ? 'bg-[var(--accent-color)] text-[var(--bg-color)]' : 'text-[var(--ink-color)] opacity-60 hover:opacity-100 hover:bg-theme-bg'}`}
        >
          <Eye className="w-6 h-6" weight="fill" /> <span className="leading-none mt-1">任务</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-theme-bg relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--ink-color) 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>
        {tab === 'map' ? (
          <div className="space-y-6 relative z-10">
            {/* Current Location */}
            {currentLoc && (
              <div className="bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-5 shadow-[4px_4px_0_var(--ink-color)] relative">
                <div className="absolute -top-3 -left-3 bg-[var(--ink-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-3 py-0.5 text-xs font-bold uppercase tracking-widest font-vt323 shadow-[2px_2px_0_var(--ink-color)]">
                  CURRENT LOCATION
                </div>
                <div className="flex items-center gap-3 mb-3 mt-2 border-b-[3px] border-dashed border-[var(--ink-color)] pb-2">
                  <MapPin className="w-6 h-6 text-[var(--accent-color)]" weight="fill" />
                  <h3 className="text-[var(--ink-color)] font-black uppercase tracking-widest text-xl">{currentLoc.name}</h3>
                </div>
                <p className="text-base text-[var(--ink-color)] opacity-90 font-bold leading-relaxed tracking-wide">{currentLoc.description}</p>
              </div>
            )}

            {/* Location Tree */}
            <div className="space-y-4">
              {locations.map(area => (
                <div key={area.id} className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] overflow-hidden">
                  <button
                    onClick={() => area.explored && onTravel(area.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left font-black tracking-widest uppercase border-b-[3px] border-transparent transition-colors ${
                      area.id === currentLocationId ? 'bg-[var(--ink-color)] text-[var(--bg-color)] border-[var(--ink-color)]' : area.explored ? 'hover:bg-[var(--paper-light)] text-[var(--ink-color)]' : 'opacity-40 text-[var(--ink-color)]'
                    }`}
                  >
                    <MapPin className={`w-6 h-6 ${area.explored ? (area.id === currentLocationId ? 'text-[var(--bg-color)]' : 'text-[var(--ink-color)]') : 'text-[var(--ink-color)]'}`} weight={area.id === currentLocationId ? 'fill' : 'regular'} />
                    <span className="flex-1 text-lg mt-1">
                      {area.explored ? area.name : '???'}
                    </span>
                    {area.id === currentLocationId && (
                      <span className="text-xs text-[var(--bg-color)] bg-[var(--accent-color)] px-2 py-0.5 shadow-[2px_2px_0_var(--bg-color)] border border-[var(--bg-color)]">HERE</span>
                    )}
                  </button>
                  {area.children && (
                    <div className="border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
                      {area.children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => child.explored && onTravel(child.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 pl-10 text-left font-bold tracking-widest uppercase border-b-[2px] border-dashed border-[var(--ink-color)] last:border-b-0 transition-colors ${
                            child.id === currentLocationId ? 'bg-[var(--ink-color)] text-[var(--bg-color)]' : child.explored ? 'hover:bg-theme-bg text-[var(--ink-color)]' : 'opacity-40 text-[var(--ink-color)]'
                          }`}
                        >
                          <CaretRight className="w-5 h-5 opacity-50" weight="bold" />
                          <span className="flex-1 text-base mt-0.5">
                            {child.explored ? child.name : '???'}
                          </span>
                          {child.id === currentLocationId && (
                            <span className="text-[10px] text-[var(--bg-color)] bg-[var(--accent-color)] px-2 py-0.5 font-vt323 border border-[var(--bg-color)]">HERE</span>
                          )}
                          {!child.explored && (
                            <span className="text-[10px] opacity-60 border-[2px] border-current px-1 font-vt323">UNEXPLORED</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 relative z-10">
            {quests.map(quest => (
              <div
                key={quest.id}
                className={`p-5 border-[3px] relative ${
                  quest.status === 'active'
                    ? 'bg-[var(--paper-light)] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]'
                    : 'bg-theme-bg border-[var(--ink-color)] opacity-60'
                }`}
              >
                {quest.status === 'active' && (
                  <div className="absolute -top-3 -right-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-3 py-0.5 text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] font-vt323">
                    ACTIVE
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <h4 className={`font-black uppercase tracking-widest text-xl ${quest.status === 'active' ? 'text-[var(--ink-color)]' : 'text-[var(--ink-color)] line-through'}`}>
                    {quest.title}
                  </h4>
                </div>
                <p className={`text-base font-bold tracking-wide ${quest.status === 'active' ? 'text-[var(--ink-color)] opacity-90' : 'text-[var(--ink-color)] opacity-70'}`}>{quest.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameContent() {
  const params = useParams();
  const adventureId = params.adventureId as string;
  const { characters, adventures, addAdventure, updateAdventure, updateCharacter } = useGameStore();

  // Determine character and module
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module');
  const charParam = searchParams.get('character');
  // First look in predefined modules, then in database loaded modules if they are added to gameData.ts
  const selectedModule = moduleParam ? MODULES.find(m => m.id === moduleParam) : null;
  const existingAdventure = adventureId !== 'new' ? adventures.find(a => a.id === adventureId) : null;

  const character: Character = (() => {
    if (charParam) {
      return characters.find(c => c.id === charParam) || createDefaultCharacter();
    }
    if (existingAdventure) {
      return characters.find(c => c.id === existingAdventure.characterId) || createDefaultCharacter();
    }
    if (selectedModule) {
      const matchedChar = characters.find(c => c.type === selectedModule.type);
      if (matchedChar) return matchedChar;
    }
    return characters[characters.length - 1] || createDefaultCharacter();
  })();

  const [currentLocationId, setCurrentLocationId] = useState('tavern');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const moduleName = selectedModule?.name || existingAdventure?.moduleName || '未知模组';
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
    // Only run this once, and ensure we have everything needed
    if (adventureId === 'new' && selectedModule && character) {
      // Check if we already created an adventure for this specific session load to avoid duplicates
      // (This is a simple guard for React strict mode double-invocations)
      const hasRecentlyCreated = adventures.some(a => 
        a.moduleId === selectedModule.id && 
        a.characterId === character.id && 
        Date.now() - parseInt(a.id.split('_')[1] || '0') < 5000
      );
      
      if (!hasRecentlyCreated) {
        const newAdv: Adventure = {
          id: `adv_${Date.now()}`,
          moduleId: selectedModule.id,
          characterId: character.id,
          moduleName: selectedModule.name,
          characterName: character.name,
          moduleType: selectedModule.type,
          progress: 5,
          lastPlayed: '刚刚',
          image: selectedModule.image,
          currentLocation: '酒馆',
        };
        addAdventure(newAdv);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInitError, setSessionInitError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>(SAMPLE_LOCATIONS);
  const [isHydrated, setIsHydrated] = useState(false);
  const [quests, setQuests] = useState<{ id: string; title: string; description: string; status: 'active' | 'completed' }[]>([
    { id: 'q1', title: '追查疫病源头', description: '调查艾登镇附近蔓延的神秘疾病', status: 'active' }
  ]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load Module Locations and Quests
  useEffect(() => {
    let isMounted = true;
    const fetchModuleData = async () => {
      try {
        const modId = selectedModule?.id || existingAdventure?.moduleId;
        if (!modId) return;
        const res = await fetch(`/api/backend/modules/${modId}/structured`);
        if (res.ok) {
          const data = await res.json();
          if (data.module && data.module.locations && data.module.locations.length > 0) {
            const parsedLocs = data.module.locations.map((loc: any) => ({
              id: loc.name,
              name: loc.name,
              description: loc.description,
              explored: true,
              connections: loc.connections || [],
            }));
            if (isMounted) {
              setLocations(parsedLocs);
              // 如果是新游戏，设置初始位置为第一个地点
              if (!existingAdventure) {
                setCurrentLocationId(parsedLocs[0].id);
              } else if (existingAdventure.currentLocation) {
                setCurrentLocationId(existingAdventure.currentLocation);
              }
            }
          }
          if (data.module && data.module.quests && data.module.quests.length > 0) {
            const parsedQuests = data.module.quests.map((q: any, i: number) => ({
              id: `q${i}`,
              title: q.name,
              description: q.goal || q.description,
              status: 'active' as const
            }));
            if (isMounted) {
              setQuests(parsedQuests);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load module structured data", e);
      }
    };
    fetchModuleData();
    return () => { isMounted = false; };
  }, [selectedModule?.id, existingAdventure?.moduleId, existingAdventure]);

  const ensureSessionInitialized = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (existingAdventure?.sessionId) {
      setSessionId(existingAdventure.sessionId);
      return existingAdventure.sessionId;
    }
    try {
      const items = Array.isArray(character.inventory)
        ? character.inventory.map(item => ({
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            stats: item.stats || {}
          }))
        : [];
      const charRes = await fetch('/api/backend/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: character.id,
          name: character.name,
          type: character.type,
          class: character.class,
          race: character.race,
          occupation: character.occupation,
          age: character.age,
          stats: character.stats,
          skills: character.skills,
          items,
          backstory: "Frontend Created"
        })
      });
      if (!charRes.ok) {
        const errData = await charRes.text();
        setSessionInitError(`创建角色失败: ${errData}`);
        return null;
      }
      const createdCharData = await charRes.json();
      const finalCharId = createdCharData.character.id;
      const modId = selectedModule?.id || existingAdventure?.moduleId;
      if (!modId) {
        setSessionInitError("创建会话失败: 缺少 module_id");
        return null;
      }
      const res = await fetch('/api/backend/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: modId,
          character_id: finalCharId,
          user_id: 'user_default'
        })
      });
      if (!res.ok) {
        const errData = await res.text();
        setSessionInitError(`创建会话失败: ${errData}`);
        return null;
      }
      const data = await res.json();
      const newSessionId = data.session.id as string;
      setSessionId(newSessionId);
      setSessionInitError(null);
      if (existingAdventure) {
        updateAdventure(existingAdventure.id, { sessionId: newSessionId, characterId: finalCharId });
      }
      return newSessionId;
    } catch (e) {
      setSessionInitError((e as Error).message);
      return null;
    }
  };

  useEffect(() => {
    ensureSessionInitialized();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventureId, character.id, selectedModule?.id, existingAdventure?.id]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = await ensureSessionInitialized();
    }

    if (!activeSessionId) {
      const aiMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        sender: 'dm',
        content: `无法连接到 DM (错误: ${sessionInitError || '会话未初始化，请刷新页面重试'})`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'system'
      };
      setMessages(prev => [...prev, aiMsg]);
      return;
    }

    const playerMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'player',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      type: 'dialog',
    };
    setMessages(prev => [...prev, playerMsg]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/backend/gm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          message: text
        })
      });

      if (res.ok) {
        const data = await res.json();
        const result = data.result || data;
        
        const aiMsg: ChatMessage = {
          id: `msg_${Date.now()}_ai`,
          sender: 'dm',
          content: result.narration || "DM 似乎陷入了沉思...",
          timestamp: new Date().toLocaleTimeString(),
          type: 'narrative',
          requiredCheck: result.required_check
        };
        const systemMsgs: ChatMessage[] = [];
        if (Array.isArray(result.revealed_clues) && result.revealed_clues.length > 0) {
          for (const clue of result.revealed_clues) {
            systemMsgs.push({
              id: `msg_${Date.now()}_clue_${clue.id}`,
              sender: 'dm',
              content: `你获得线索【${clue.title}】：${clue.content}`,
              timestamp: new Date().toLocaleTimeString(),
              type: 'system'
            });
          }
        }
        if (Array.isArray(result.granted_handouts) && result.granted_handouts.length > 0) {
          for (const handout of result.granted_handouts) {
            systemMsgs.push({
              id: `msg_${Date.now()}_handout_${handout.id}`,
              sender: 'dm',
              content: `你获得资料【${handout.title}】并已加入物品栏。`,
              timestamp: new Date().toLocaleTimeString(),
              type: 'system'
            });
          }
        }
        setMessages(prev => [...prev, aiMsg, ...systemMsgs]);
        
        if (result.location_change) {
           handleTravel(result.location_change);
        }
      } else {
        const aiMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          sender: 'dm',
          content: "DM 似乎有些分心 (服务器错误)",
          timestamp: new Date().toLocaleTimeString(),
          type: 'system'
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e: unknown) {
       console.error("Error in handleSend:", e);
       const aiMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          sender: 'dm',
          content: `无法连接到 DM (错误: ${(e as Error).message})`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'system'
        };
        setMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRoll = async (check: NonNullable<ChatMessage['requiredCheck']>) => {
    let rollMsg: ChatMessage;
    let finalResultText = '';

    if (character.type === 'dnd') {
      const d20 = rollDice(20);
      let modifier = 0;
      let modifierText = '';

      const attrName = check.attr || DND_SKILLS_MAP[check.name];
      if (attrName && character.stats[attrName as keyof typeof character.stats]) {
        const score = character.stats[attrName as keyof typeof character.stats] as number;
        const attrMod = calculateModifier(score);
        modifier += attrMod;
        modifierText += `${attrMod >= 0 ? '+' : ''}${attrMod}(${attrName})`;
      }

      if (check.type === 'skill' && Array.isArray(character.skills) && character.skills.includes(check.name) && character.combatStats) {
        modifier += character.combatStats.proficiencyBonus;
        modifierText += `+${character.combatStats.proficiencyBonus}(熟练)`;
      }

      const total = d20 + modifier;
      rollMsg = {
        id: `msg_${Date.now()}_roll`,
        sender: 'player',
        content: `[系统] 执行了 ${check.name} 检定：1d20(${d20}) ${modifierText} = ${total}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'roll',
        rollResult: {
          dice: '1d20',
          result: total
        }
      };
      finalResultText = `我进行了 ${check.name} 检定，掷骰结果是：${total}。`;
    } else {
      // CoC Roll
      const d100 = rollDice(100);
      let targetValue = 50; // Default fallback
      
      if (check.attr && character.stats[check.attr as keyof typeof character.stats]) {
        targetValue = character.stats[check.attr as keyof typeof character.stats] as number;
      } else if (!Array.isArray(character.skills) && character.skills[check.name] !== undefined) {
        targetValue = character.skills[check.name];
      }

      // We can optionally call the API, but we can also just calculate it here like DND
      let text = "失败";
      if (d100 === 1) text = "大成功";
      else if (d100 >= 96 && targetValue < 50) text = "大失败";
      else if (d100 === 100) text = "大失败";
      else if (d100 <= Math.floor(targetValue / 5)) text = "极难成功";
      else if (d100 <= Math.floor(targetValue / 2)) text = "困难成功";
      else if (d100 <= targetValue) text = "常规成功";

      rollMsg = {
        id: `msg_${Date.now()}_roll`,
        sender: 'player',
        content: `[系统] 执行了 ${check.name} 检定：1d100(${d100}) / ${targetValue}，结果：${text}`,
        timestamp: new Date().toLocaleTimeString(),
        type: 'roll',
        rollResult: {
          dice: '1d100',
          result: d100,
          success: text.includes("成功")
        }
      };
      finalResultText = `我进行了 ${check.name} 检定，掷骰结果是：${d100} / ${targetValue}，这是个${text}。`;
    }

    setMessages(prev => [...prev, rollMsg]);
    
    // Remove the required check from the last DM message to prevent re-rolling
    setMessages(prev => {
      const newMsgs = [...prev];
      for (let i = newMsgs.length - 1; i >= 0; i--) {
        if (newMsgs[i].sender === 'dm' && newMsgs[i].requiredCheck) {
          newMsgs[i] = { ...newMsgs[i], requiredCheck: undefined };
          break;
        }
      }
      return newMsgs;
    });

    handleSend(finalResultText);
  };

  const handleTravel = (locationId: string) => {
    setCurrentLocationId(locationId);
    
    const findLoc = (id: string, locs: Location[]): Location | undefined => {
      for (const loc of locs) {
        if (loc.id === id) return loc;
        if (loc.children) {
          const c = loc.children.find(ch => ch.id === id);
          if (c) return c;
        }
      }
      return undefined;
    };
    
    const loc = findLoc(locationId, locations);
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

  const handleRest = (type: 'short' | 'long' | 'first_aid' | 'psychoanalysis') => {
    const updatedChar = { ...character };
    let restMsg = '';
    let playerActionMsg = '';
    
    if (type === 'first_aid') {
      playerActionMsg = '我尝试使用急救技能处理伤口。';
      handleSend(playerActionMsg);
      return; // CoC actions do not hardcode healing, let DM decide
    } else if (type === 'psychoanalysis') {
      playerActionMsg = '我尝试进行精神分析，平复情绪。';
      handleSend(playerActionMsg);
      return; // CoC actions do not hardcode healing, let DM decide
    } else if (type === 'short') {
      // Check if short rest is available
      if (updatedChar.combatStats && updatedChar.combatStats.shortRestsAvailable <= 0) {
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          sender: 'dm',
          content: `[系统] 提示：在进行长休之前，你无法再次进行短休。`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'system',
        };
        setMessages(prev => [...prev, msg]);
        return; // Prevent resting
      }

      // Heal 50% max HP (rounded up)
      const healAmount = Math.ceil(updatedChar.maxHp / 2);
      updatedChar.hp = Math.min(updatedChar.maxHp, updatedChar.hp + healAmount);

      restMsg = `你进行了短休，恢复了 ${healAmount} 点生命值以及部分能力。`;
      
      // Reset short rest features
      if (updatedChar.features) {
        updatedChar.features.forEach(f => {
          if (f.reset === 'short_rest' && f.uses) f.uses.current = f.uses.max;
        });
      }
      // Reset actions
      if (updatedChar.combatStats) {
        updatedChar.combatStats.actions.current = updatedChar.combatStats.actions.max;
        updatedChar.combatStats.bonusActions.current = updatedChar.combatStats.bonusActions.max;
        updatedChar.combatStats.reactions.current = updatedChar.combatStats.reactions.max;
        updatedChar.combatStats.shortRestsAvailable = 0; // Consume the short rest
      }
    } else {
      restMsg = '你进行了长休，恢复了所有体力、法术位与能力。';
      updatedChar.hp = updatedChar.maxHp;
      // Reset all features
      if (updatedChar.features) {
        updatedChar.features.forEach(f => {
          if (f.uses) f.uses.current = f.uses.max;
        });
      }
      // Reset spell slots & actions
      if (updatedChar.combatStats) {
        Object.keys(updatedChar.combatStats.spellSlots).forEach(level => {
          const l = Number(level) as 1|2|3|4|5;
          updatedChar.combatStats!.spellSlots[l].current = updatedChar.combatStats!.spellSlots[l].max;
        });
        updatedChar.combatStats.actions.current = updatedChar.combatStats.actions.max;
        updatedChar.combatStats.bonusActions.current = updatedChar.combatStats.bonusActions.max;
        updatedChar.combatStats.reactions.current = updatedChar.combatStats.reactions.max;
        updatedChar.combatStats.shortRestsAvailable = 1; // Reset short rest availability
      }
    }

    updateCharacter(character.id, updatedChar);

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_rest`,
      sender: 'dm',
      content: `[系统] ${restMsg}`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'system',
    };
    setMessages(prev => [...prev, msg]);
    handleSend(type === 'short' ? '我打算在这里短休一下。' : '我打算在这里长休。');
  };

  if (!isHydrated) {
    return <div className="h-[calc(100vh-76px)] flex items-center justify-center text-[var(--ink-color)] font-black tracking-widest">LOADING...</div>;
  }

  return (
    <div className="h-[calc(100vh-76px)] flex bg-theme-bg font-huiwen overflow-hidden relative z-0">
      {/* Left: Character */}
      <div className="w-[360px] bg-theme-bg border-r-[3px] border-[var(--ink-color)] flex-shrink-0 hidden lg:block z-0 relative overflow-hidden shadow-[4px_0_0_var(--ink-color)]">
        <CharacterPanel 
          character={character} 
          onUseResource={(type, name, level) => {
            const updatedChar = { ...character };
            if (!updatedChar.combatStats) return;

            let resourceUsed = false;
            let costMsg = '';

            if (type === 'action' && updatedChar.combatStats.actions.current > 0) {
              updatedChar.combatStats.actions.current -= 1;
              resourceUsed = true;
              costMsg = '消耗 1 个动作';
            } else if (type === 'bonus_action' && updatedChar.combatStats.bonusActions.current > 0) {
              updatedChar.combatStats.bonusActions.current -= 1;
              resourceUsed = true;
              costMsg = '消耗 1 个附赠动作';
            } else if (type === 'spell_slot' && level) {
              const slot = updatedChar.combatStats.spellSlots[level as 1|2|3|4|5];
              if (slot && slot.current > 0) {
                slot.current -= 1;
                costMsg = `消耗 1 个 ${level} 环法术位`;
                // A leveled spell also costs an action (simplified)
                if (updatedChar.combatStats.actions.current > 0) {
                  updatedChar.combatStats.actions.current -= 1;
                  costMsg += '和 1 个动作';
                }
                resourceUsed = true;
              }
            }

            if (resourceUsed) {
              updateCharacter(character.id, { combatStats: updatedChar.combatStats });
              handleSend(`我使用/施放了【${name}】。(${costMsg})`);
            } else {
               const msg: ChatMessage = {
                 id: `msg_${Date.now()}_err`,
                 sender: 'dm',
                 content: `[系统] 提示：资源不足，无法使用/施放【${name}】。`,
                 timestamp: new Date().toLocaleTimeString(),
                 type: 'system',
               };
               setMessages(prev => [...prev, msg]);
            }
          }}
          onEquipItem={async (itemId, type) => {
            if (!sessionId) return;
            
            try {
               const res = await fetch(`/api/backend/characters/${character.id}/equip`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ item_id: itemId })
               });
               
               if (res.ok) {
                 const data = await res.json();
                 updateCharacter(character.id, data.character);
                 
                 // Find item name for message
                 const item = (character.inventory || []).find(i => i.id === itemId);
                 if (item) {
                    const action = item.is_equipped ? '卸下' : '装备';
                    handleSend(`我${action}了【${item.name}】。`);
                 }
               }
            } catch (e) {
               console.error("Failed to equip item", e);
            }
          }}
        />
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-theme-bg z-0 relative">
        <ChatPanel 
          messages={messages} 
          onSend={handleSend} 
          character={character} 
          onRoll={handleRoll} 
          onRest={handleRest}
          moduleType={selectedModule?.type || existingAdventure?.moduleType || 'dnd'} 
        />
      </div>

      {/* Right: Map/Quest */}
      <div className="w-80 bg-theme-bg border-l-[3px] border-[var(--ink-color)] flex-shrink-0 hidden md:block z-0 relative shadow-[-4px_0_0_var(--ink-color)]">
        <MapPanel
          locations={locations}
          currentLocationId={currentLocationId}
          onTravel={handleTravel}
          quests={quests}
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
    inventory: [
      { id: 'i1', name: '长剑', description: '一把普通长剑', category: 'weapon', quantity: 1 },
      { id: 'i2', name: '皮甲', description: '基础防具', category: 'armor', quantity: 1 },
      { id: 'i3', name: '治疗药水', description: '恢复2d4+2HP', category: 'consumable', quantity: 2 },
      { id: 'i4', name: '火把', description: '照明用', category: 'misc', quantity: 3 },
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

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>}>
      <GameContent />
    </Suspense>
  );
}
