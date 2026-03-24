"use client";

import Link from "next/link";
import { Sword, BookBookmark, Compass, Eye } from "@phosphor-icons/react";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center">
      <div className="text-center mb-16 relative mt-16">
        <h1 className="riso-title text-6xl md:text-8xl mb-6 font-huiwen text-[var(--ink-color)]">选择你的命运</h1>
        <p className="text-[var(--ink-color)] text-xl tracking-widest border-y-[3px] border-[var(--ink-color)] py-2 inline-block font-huiwen font-bold">
          选择你的世界，开启你的故事
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 w-full max-w-4xl relative z-10">
        {/* DND Portal */}
        <Link 
          href="/dnd/adventures"
          prefetch={true}
          className="border-[3px] border-[var(--ink-color)] p-10 relative cursor-pointer flex flex-col items-center text-center transition-all duration-300 group hover:bg-[var(--paper-light)] hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--ink-color)] bg-theme-bg"
          onMouseEnter={() => document.body.setAttribute('data-theme', 'dnd')}
          onMouseLeave={() => document.body.setAttribute('data-theme', 'hub')}
        >
          <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0_var(--ink-color)]">⚔️</div>
          <h2 className="text-4xl font-black mb-4 font-huiwen text-[var(--ink-color)] tracking-widest">进入剑湾</h2>
          <div className="h-[3px] w-24 bg-[var(--ink-color)] mb-6 opacity-30"></div>
          <p className="text-lg font-bold font-huiwen text-[var(--ink-color)] opacity-80 leading-relaxed">加入冒险者公会，接取委托，<br />在龙与地下城的世界中谱写史诗。</p>
          <div className="mt-8 font-black text-[var(--accent-color)] border-b-[3px] border-current tracking-widest text-xl font-vt323 uppercase">ACCESS D&D 5E</div>
        </Link>

        {/* COC Portal */}
        <Link 
          href="/coc/cases"
          prefetch={true}
          className="border-[3px] border-[var(--ink-color)] p-10 relative cursor-pointer flex flex-col items-center text-center transition-all duration-300 group hover:bg-[var(--paper-light)] hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--ink-color)] bg-theme-bg"
          onMouseEnter={() => document.body.setAttribute('data-theme', 'coc')}
          onMouseLeave={() => document.body.setAttribute('data-theme', 'hub')}
        >
          <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0_var(--ink-color)]">👁️</div>
          <h2 className="text-4xl font-black mb-4 font-huiwen text-[var(--ink-color)] tracking-widest">查阅机密</h2>
          <div className="h-[3px] w-24 bg-[var(--ink-color)] mb-6 opacity-30"></div>
          <p className="text-lg font-bold font-huiwen text-[var(--ink-color)] opacity-80 leading-relaxed">化身调查员，翻开尘封的档案，<br />直面隐藏在黑暗中的不可名状之物。</p>
          <div className="mt-8 font-black text-[var(--ink-color)] border-b-[3px] border-current tracking-widest text-xl font-vt323 uppercase">ACCESS COC 7TH</div>
        </Link>
      </div>
    </div>
  );
}