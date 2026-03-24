"use client";

import Link from 'next/link';
import { MODULES } from '@/lib/gameData';
import { useGameStore } from '@/lib/gameStore';

export default function CocCasesPage() {
  const cocModules = MODULES.filter(m => m.type === 'coc');
  const { adventures } = useGameStore();
  
  // Get ongoing CoC adventures
  const ongoingInvestigations = adventures.filter(a => a.moduleType === 'coc');

  return (
    <div className="min-h-[calc(100vh-64px)] relative" style={{ fontFamily: "'Huiwen Mincho', 'Noto Serif SC', serif" }}>
      {/* 顶层导航档案标签 */}
      <nav className="border-b-[3px] border-theme-ink px-10 py-4 flex justify-between items-center sticky top-0 bg-theme-bg z-40 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="text-2xl font-black tracking-widest uppercase flex items-center gap-3 riso-text font-huiwen">
          <span className="opacity-70 text-theme-ink text-lg">👁️</span>
          档案馆 // BUREAU OF INVESTIGATION
        </div>
        <div className="flex gap-8">
          <Link href="/" className="font-bold text-theme-ink hover:text-theme-accent tracking-widest transition-colors riso-text font-huiwen text-lg opacity-60 hover:opacity-100">返回大厅</Link>
          <Link href="/coc/cases" className="font-bold text-theme-accent tracking-widest border-b-[3px] border-theme-accent relative riso-text font-huiwen text-lg">
            机密档案
            <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-theme-accent transform -rotate-1"></div>
          </Link>
          <Link href="/coc/characters" className="font-bold text-theme-ink hover:text-theme-accent tracking-widest transition-colors riso-text font-huiwen text-lg opacity-60 hover:opacity-100">调查员名录</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-10 py-12 relative z-10">
        
        {/* Ongoing Investigations Section */}
        {ongoingInvestigations.length > 0 && (
          <div className="mb-16">
            <div className="mb-10 border-b-[3px] border-dashed border-theme-ink pb-4 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              <h2 className="text-5xl font-black mb-2 tracking-widest uppercase riso-title font-huiwen mt-8">未尽的调查</h2>
              <p className="text-theme-ink opacity-80 tracking-[0.2em] font-bold riso-text font-vt323 text-2xl uppercase mt-2">ACTIVE CASE FILES</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-stretch">
              {ongoingInvestigations.map(adv => (
                <Link 
                  key={adv.id} 
                  href={`/game/${adv.id}`}
                  className="riso-card block group hover:bg-[#e6d8b3] bg-[var(--paper-light)]"
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

                  {/* 调查员信息 */}
                  <div className="mt-4 mb-8 bg-theme-bg border-[2px] border-theme-ink p-3 shadow-[2px_2px_0_var(--ink-color)] group-hover:bg-[#e6d8b3] transition-colors duration-300">
                    <p className="text-sm font-black opacity-60 uppercase mb-1 tracking-widest font-vt323">调查员 INVESTIGATOR</p>
                    <p className="text-xl font-bold tracking-widest">{adv.characterName}</p>
                  </div>

                  {/* 底部状态 */}
                  <div className="flex justify-between items-end mt-auto pt-6 relative z-10 border-t-[3px] border-theme-ink border-dashed">
                    <span 
                      className="inline-block border-[3px] border-theme-ink text-theme-bg px-3 py-1 text-sm font-bold tracking-widest uppercase bg-theme-ink shadow-[2px_2px_0_var(--accent-color)] font-vt323 mt-2"
                    >
                      继续调查
                    </span>
                    <span className="font-bold text-xl tracking-wider riso-text font-vt323 text-2xl">
                      CASE {adv.id.slice(-4)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 标题区 */}
        <div className="mb-16 border-b-[3px] border-dashed border-theme-ink pb-6 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <h1 className="text-7xl font-black mb-4 tracking-widest uppercase riso-title font-huiwen mt-8">机密案件记录</h1>
          <p className="text-theme-ink opacity-80 tracking-[0.2em] font-bold riso-text font-vt323 text-3xl uppercase mt-2">FILE REF: UNKNOWN // AUTHORIZED PERSONNEL ONLY</p>
        </div>

        {/* 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-stretch">
          {cocModules.map(module => (
            <Link 
              key={module.id} 
              href={`/character/create?module=${module.id}`}
              className="riso-card block group hover:bg-[#e6d8b3]"
            >
              {/* 四角定位十字 */}
              <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute bottom-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute bottom-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>

              {/* 档案顶部元数据 */}
              <div className="flex justify-between text-xs tracking-widest border-b-[3px] border-theme-ink pb-2 mb-4 uppercase font-bold riso-text font-vt323 text-lg opacity-80">
                <span>CLASS: HORROR</span>
                <span>DIFF: {module.difficulty}</span>
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
                  COC 7TH
                </span>
                <span className="font-bold text-xl tracking-wider riso-text font-vt323 text-2xl">
                  {module.price === '免费' ? 'UNCLASSIFIED' : 'RESTRICTED'}
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}