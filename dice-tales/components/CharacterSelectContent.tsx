"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Plus, Clock, MapPin, ArrowLeft, Heart } from '@phosphor-icons/react';
import { useGameStore } from '@/lib/gameStore';
import { MODULES } from '@/lib/gameData';
import { CharacterPanel } from '@/components/CharacterPanel';
import { ModuleImagePlaceholder } from '@/components/ModuleImagePlaceholder';

export function CharacterSelectContent({ type }: { type: 'dnd' | 'coc' }) {
  const searchParams = useSearchParams();
  const charId = searchParams.get('id');
  const store = useGameStore();
  const characters = store.characters.filter(c => c.type === type);
  const adventures = store.adventures;

  const [selectedCharId, setSelectedCharId] = useState<string | null>(charId || null);

  useEffect(() => {
    if (charId && characters.some(c => c.id === charId)) {
      setSelectedCharId(charId);
    }
  }, [charId, characters]);

  if (characters.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-10 py-16 text-center font-huiwen">
        <h2 className="text-4xl text-[var(--ink-color)] font-black uppercase tracking-widest mb-10 riso-title">你还没有创建任何角色</h2>
        <Link
          href={`/character/create?type=${type}`}
          className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] font-bold uppercase shadow-[4px_4px_0_var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] active:translate-y-1 active:shadow-none transition-all text-xl tracking-wider"
        >
          <Plus className="w-6 h-6" weight="bold" /> 创建新角色
        </Link>
      </div>
    );
  }

  if (!selectedCharId) {
    return (
      <div className="max-w-7xl mx-auto px-10 py-8 h-[calc(100vh-56px)] flex flex-col font-huiwen">
        <div className="flex items-center justify-between mb-12 border-b-[3px] border-dashed border-[var(--ink-color)] pb-6 riso-border" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
          <h1 className="text-5xl font-black uppercase riso-title tracking-widest">{type === 'dnd' ? '英雄名册' : '调查员名录'}</h1>
          <Link
            href="/"
            className="flex items-center gap-2 bg-[var(--bg-color)] text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] transition-all text-lg tracking-widest"
          >
            <ArrowLeft weight="bold" /> 返回大厅
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <Link
            href={`/character/create?type=${type}`}
            className="riso-card flex flex-col items-center justify-center min-h-[250px] group border-dashed hover:bg-[var(--paper-light)]"
          >
            <div className="w-20 h-20 bg-theme-bg border-[3px] border-[var(--ink-color)] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[4px_4px_0_var(--ink-color)] group-hover:bg-[var(--accent-color)] group-hover:text-[var(--bg-color)] text-[var(--ink-color)]">
              <Plus className="w-10 h-10" weight="bold" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-widest text-[var(--ink-color)]">创建新角色</h3>
          </Link>

          {characters.map(char => (
            <div
              key={char.id}
              onClick={() => setSelectedCharId(char.id)}
              className="riso-card flex flex-col group cursor-pointer hover:bg-[var(--paper-light)] relative"
            >
              <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              
              <div className="flex items-center gap-4 mb-6 mt-4">
                <div className="w-16 h-16 bg-theme-bg border-[3px] border-[var(--ink-color)] flex items-center justify-center text-3xl shadow-[2px_2px_0_var(--ink-color)]">
                  {char.avatar}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase text-[var(--ink-color)] leading-none mb-2 tracking-widest">{char.name}</h3>
                  <p className="text-sm font-bold text-[var(--ink-color)] opacity-80 tracking-widest">
                    {char.type === 'dnd' ? `Lv.${char.level} ${char.race} ${char.class}` : `${char.occupation}`}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 mb-6">
                <span className="px-2 py-0.5 border-[2px] border-[var(--ink-color)] text-xs font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] bg-[var(--ink-color)] text-[var(--bg-color)] font-vt323 tracking-widest">
                  {char.type === 'dnd' ? 'D&D 5E' : 'CoC 7TH'}
                </span>
                <span className="px-2 py-0.5 border-[2px] border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)] text-xs font-bold shadow-[2px_2px_0_var(--ink-color)] flex items-center gap-1 font-vt323 tracking-widest">
                  <Heart className="w-3 h-3 text-[var(--accent-color)]" weight="fill" /> {char.hp}/{char.maxHp}
                </span>
              </div>
              
              <div className="mt-auto border-t-[3px] border-dashed border-[var(--ink-color)] pt-4 relative z-10">
                <p className="text-xs text-[var(--ink-color)] font-bold uppercase tracking-widest opacity-70">
                  最近活跃: {adventures.find(a => a.characterId === char.id)?.lastPlayed || '未参与冒险'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedChar = characters.find(c => c.id === selectedCharId) || characters[0];
  const charAdventures = adventures.filter(a => a.characterId === selectedChar.id);

  // Filter modules to match the character's type (dnd or coc)
  const compatibleModules = MODULES.filter(m => m.type === selectedChar.type);

  return (
    <div className="max-w-7xl mx-auto px-10 py-8 h-[calc(100vh-56px)] flex flex-col font-huiwen">
      <div className="mb-8 flex justify-between items-center">
        <button 
          onClick={() => setSelectedCharId(null)} 
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-0 active:shadow-none transition-all tracking-widest text-lg"
        >
          <ArrowLeft weight="bold" /> {type === 'dnd' ? '返回英雄名册' : '返回调查员名录'}
        </button>
      </div>

      <div className="flex-1 flex gap-10 min-h-0">
        {/* Left Column: Adventures & Modules */}
        <div className="flex-1 flex flex-col gap-12 overflow-y-auto pr-4 scrollbar-thin">
          
          {/* Section 1: Ongoing Adventures */}
          <section>
            <div className="flex items-center gap-3 mb-8 border-b-[3px] border-[var(--ink-color)] pb-3">
              <span className="w-3 h-8 bg-[var(--accent-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]" />
              <h2 className="text-3xl text-[var(--ink-color)] font-black uppercase tracking-widest riso-title">
                {type === 'dnd' ? '正在进行的冒险' : '正在进行的调查'}
              </h2>
            </div>
            {charAdventures.length === 0 ? (
              <div className="bg-theme-bg border-[3px] border-dashed border-[var(--ink-color)] p-10 text-center text-[var(--ink-color)] opacity-60 font-bold uppercase tracking-widest text-lg">
                {type === 'dnd' ? '这个角色还没有参加过任何冒险' : '这名调查员还没有参与过任何调查'}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {charAdventures.map(adv => (
                  <Link
                    key={adv.id}
                    href={`/game/${adv.id}`}
                    className="group bg-theme-bg border-[3px] border-[var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] overflow-hidden transition-all flex flex-col"
                  >
                    <div className="h-40 relative border-b-[3px] border-[var(--ink-color)] overflow-hidden">
                      <ModuleImagePlaceholder moduleId={adv.moduleId} />
                      <div className="absolute inset-0 bg-[var(--ink-color)] opacity-40 mix-blend-multiply group-hover:opacity-20 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-[var(--bg-color)] opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[2px_2px_0_var(--ink-color)]" weight="fill" />
                      </div>
                    </div>
                    <div className="p-5 bg-[var(--paper-light)] flex-1 flex flex-col justify-between relative">
                      <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                      <div>
                        <h3 className="text-[var(--ink-color)] font-black text-2xl mb-3 uppercase tracking-widest line-clamp-1">{adv.moduleName}</h3>
                        <div className="flex items-center gap-4 text-sm font-bold text-[var(--ink-color)] opacity-80 uppercase mb-5 font-vt323 tracking-widest">
                          <span className="flex items-center gap-1 bg-theme-bg border-[2px] border-[var(--ink-color)] px-2 py-1 shadow-[2px_2px_0_var(--ink-color)]"><MapPin className="w-4 h-4" weight="bold" />{adv.currentLocation}</span>
                          <span className="flex items-center gap-1 bg-theme-bg border-[2px] border-[var(--ink-color)] px-2 py-1 shadow-[2px_2px_0_var(--ink-color)]"><Clock className="w-4 h-4" weight="bold" />{adv.lastPlayed}</span>
                        </div>
                      </div>
                      <div className="w-full bg-theme-bg border-[2px] border-[var(--ink-color)] h-4 shadow-[2px_2px_0_var(--ink-color)]">
                        <div className="bg-[var(--accent-color)] h-full border-r-[2px] border-[var(--ink-color)]" style={{ width: `${adv.progress}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: New Adventures */}
          <section>
            <div className="flex items-center gap-3 mb-8 border-b-[3px] border-[var(--ink-color)] pb-3">
              <span className="w-3 h-8 bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]" />
              <h2 className="text-3xl text-[var(--ink-color)] font-black uppercase tracking-widest riso-title">
                {type === 'dnd' ? '选择新的冒险' : '接手新的案件'}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {compatibleModules.map(module => (
                <Link
                  key={module.id}
                  href={`/game/new?module=${module.id}&character=${selectedChar.id}`}
                  className="group bg-theme-bg border-[3px] border-[var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] overflow-hidden transition-all flex flex-col"
                >
                  <div className="h-40 relative overflow-hidden border-b-[3px] border-[var(--ink-color)]">
                    <ModuleImagePlaceholder moduleId={module.id} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-color)] via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-3 left-3">
                      <span className="px-3 py-1 border-[2px] border-[var(--ink-color)] font-bold uppercase text-sm bg-[var(--accent-color)] text-[var(--bg-color)] shadow-[2px_2px_0_var(--ink-color)] font-vt323 tracking-widest">
                        {module.difficulty === '新手' ? 'NOVICE' : 'VETERAN'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 bg-[var(--paper-light)] flex-1 flex flex-col relative">
                    <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                    <h3 className="text-[var(--ink-color)] font-black text-2xl mb-3 uppercase tracking-widest">{module.name}</h3>
                    <p className="text-lg font-medium text-[var(--ink-color)] opacity-80 line-clamp-2 mb-6 flex-1">{module.description}</p>
                    <div className="flex items-center text-[var(--bg-color)] bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 text-sm font-bold uppercase tracking-widest gap-2 shadow-[2px_2px_0_var(--ink-color)] self-start group-hover:-translate-y-0.5 group-hover:shadow-[4px_4px_0_var(--ink-color)] transition-all">
                      <Plus className="w-5 h-5" weight="bold" /> {type === 'dnd' ? '使用此角色开启冒险' : '派此调查员接手案件'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {compatibleModules.length === 0 && (
              <div className="bg-theme-bg border-[3px] border-dashed border-[var(--ink-color)] p-10 text-center text-[var(--ink-color)] opacity-60 font-bold uppercase tracking-widest text-lg">
                暂无适合该体系的模组
              </div>
            )}
          </section>

        </div>

        {/* Right Column: Character Panel */}
        <div className="w-96 bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[-4px_0_0_var(--ink-color)] flex-shrink-0 hidden md:block z-10 relative font-huiwen overflow-hidden">
          <CharacterPanel character={selectedChar} />
        </div>
      </div>
    </div>
  );
}
