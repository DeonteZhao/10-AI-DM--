"use client";

import Link from 'next/link';
import { MODULES } from '@/lib/gameData';
import { useGameStore } from '@/lib/gameStore';

export default function DndAdventuresPage() {
  console.log("DndAdventuresPage rendered");
  const dndModules = MODULES.filter(m => m.type === 'dnd');
  const { adventures } = useGameStore();
  
  // Get ongoing DND adventures
  const ongoingAdventures = adventures.filter(a => a.moduleType === 'dnd');

  return (
    <div className="min-h-[calc(100vh-64px)] relative" style={{ fontFamily: "'Huiwen Mincho', 'Noto Serif SC', serif" }}>
      
      {/* 顶层导航栏 */}
      <nav className="border-b-[3px] border-theme-ink px-10 py-4 flex justify-between items-center sticky top-0 bg-theme-bg z-40 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="text-2xl font-black tracking-widest uppercase flex items-center gap-3 riso-text font-huiwen">
          <span className="opacity-70 text-theme-ink text-lg">⚔️</span>
          冒险者公会 // ADVENTURERS GUILD
        </div>
        <div className="flex gap-8">
          <Link href="/" className="font-bold text-theme-ink hover:text-theme-accent tracking-widest transition-colors riso-text font-huiwen text-lg opacity-60 hover:opacity-100">返回大厅</Link>
          <Link href="/dnd/adventures" className="font-bold text-theme-accent tracking-widest border-b-[3px] border-theme-accent relative riso-text font-huiwen text-lg">
            任务布告板
            <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-theme-accent transform -rotate-1"></div>
          </Link>
          <Link href="/dnd/characters" className="font-bold text-theme-ink hover:text-theme-accent tracking-widest transition-colors riso-text font-huiwen text-lg opacity-60 hover:opacity-100">英雄名册</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-10 py-12 relative z-10">
        
        {/* Ongoing Adventures Section */}
        {ongoingAdventures.length > 0 && (
          <div className="mb-16">
            <div className="mb-10 border-b-[3px] border-dashed border-theme-ink pb-4 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              <h2 className="text-5xl font-black mb-2 tracking-widest uppercase riso-title font-huiwen mt-8">未完的冒险</h2>
              <p className="text-theme-ink opacity-80 tracking-[0.2em] font-bold riso-text font-vt323 text-2xl uppercase mt-2">ACTIVE QUESTS</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-stretch">
              {ongoingAdventures.map(adv => (
                <Link 
                  key={adv.id} 
                  href={`/game/${adv.id}`}
                  className="riso-card block group hover:bg-[#F4E8C8] bg-[var(--paper-light)]"
                >
                  {/* 四角定位十字 */}
                  <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                  <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                  <div className="absolute bottom-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                  <div className="absolute bottom-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>

                  {/* 状态戳 */}
                  <div className="absolute -top-3 -right-3 bg-theme-accent text-theme-bg border-[3px] border-theme-ink px-3 py-1 font-black uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] font-vt323 text-lg transform rotate-3 z-20">
                    IN PROGRESS
                  </div>

                  {/* 档案顶部元数据 */}
                  <div className="flex justify-between text-xs tracking-widest border-b-[3px] border-theme-ink pb-2 mb-4 uppercase font-bold riso-text font-vt323 text-lg opacity-80">
                    <span>DATE: {adv.lastPlayed}</span>
                    <span>LOC: {adv.currentLocation}</span>
                  </div>

                  {/* 标题 */}
                  <h3 className="text-3xl font-black mb-4 leading-tight uppercase riso-title font-huiwen group-hover:text-[#9e3223] transition-colors duration-300 tracking-wider">
                    {adv.moduleName}
                  </h3>

                  {/* 英雄信息 */}
                  <div className="mt-4 mb-8 bg-theme-bg border-[2px] border-theme-ink p-3 shadow-[2px_2px_0_var(--ink-color)] group-hover:bg-[#F4E8C8] transition-colors duration-300">
                    <p className="text-sm font-black opacity-60 uppercase mb-1 tracking-widest font-vt323">冒险者 HERO</p>
                    <p className="text-xl font-bold tracking-widest">{adv.characterName}</p>
                  </div>

                  {/* 底部状态 */}
                  <div className="flex justify-between items-end mt-auto pt-6 relative z-10 border-t-[3px] border-theme-ink border-dashed">
                    <span 
                      className="inline-block border-[3px] border-theme-ink text-theme-bg px-3 py-1 text-sm font-bold tracking-widest uppercase bg-theme-ink shadow-[2px_2px_0_var(--accent-color)] font-vt323 mt-2"
                    >
                      继续旅程
                    </span>
                    <span className="font-bold text-xl tracking-wider riso-text font-vt323 text-2xl">
                      QUEST {adv.id.slice(-4)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 标题区 */}
        <div className="mb-16 border-b-[3px] border-dashed border-theme-ink pb-6 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <h1 className="text-7xl font-black mb-4 tracking-widest uppercase riso-title font-huiwen mt-8">任务布告板</h1>
          <p className="text-theme-ink opacity-80 tracking-[0.2em] font-bold riso-text font-vt323 text-3xl uppercase mt-2">QUEST BOARD // ACCEPTING BRAVE SOULS</p>
        </div>

        {/* 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-stretch">
          {dndModules.map(module => (
            <Link 
              key={module.id} 
              href={`/character/create?module=${module.id}`}
              className="riso-card block group hover:bg-[#F4E8C8]"
            >
              {/* 四角定位十字 */}
              <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute bottom-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute bottom-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>

              {/* 档案顶部元数据 */}
              <div className="flex justify-between text-xs tracking-widest border-b-[3px] border-theme-ink pb-2 mb-4 uppercase font-bold riso-text font-vt323 text-lg opacity-80">
                <span>RANK: {module.difficulty === '新手' ? 'NOVICE' : 'VETERAN'}</span>
                <span>REWARD: {module.price}</span>
              </div>

              {/* 标题 */}
              <h3 className="text-4xl font-black mb-4 leading-tight uppercase riso-title font-huiwen group-hover:text-[#9e3223] transition-colors duration-300 tracking-wider">
                {module.name}
              </h3>

              {/* 描述 */}
              <p className="text-lg leading-relaxed text-justify mb-8 font-medium riso-text font-huiwen flex-grow opacity-90 mt-2 tracking-wide">
                {module.description}
              </p>

              {/* 底部状态 */}
              <div className="flex justify-between items-end mt-auto pt-6 relative z-10 border-t-[3px] border-theme-ink border-dashed">
                <span 
                  className="inline-block border-[3px] border-theme-accent text-theme-accent px-3 py-1 text-sm font-bold tracking-widest uppercase -rotate-2 bg-theme-bg shadow-[2px_2px_0_var(--accent-color)] font-vt323 group-hover:bg-theme-accent group-hover:text-theme-bg transition-colors duration-300 mt-2"
                >
                  D&D 5E
                </span>
                <span className="font-bold text-xl tracking-wider riso-text font-vt323 text-2xl">
                  OPEN QUEST
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}