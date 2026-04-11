import { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  CaretDown,
  CaretUp,
  Diamond,
  Flask,
  Heart,
  Key,
  Lightning,
  Package,
  Shield,
  Sparkle,
  Star,
  Sword,
} from '@phosphor-icons/react';
import { normalizeCocSkillMap, type CocInvestigatorRecord, type CocItem } from '@/lib/domain/coc';

function getItemIcon(item: CocItem) {
  if (item.category === 'weapon') return <Sword className="w-5 h-5" weight="fill" />;
  if (item.category === 'armor') return <Shield className="w-5 h-5" weight="fill" />;
  if (item.category === 'ring') return <Diamond className="w-5 h-5" weight="fill" />;
  if (item.category === 'necklace') return <Sparkle className="w-5 h-5" weight="fill" />;
  if (item.category === 'consumable') return <Flask className="w-5 h-5" weight="fill" />;
  if (item.category === 'key') return <Key className="w-5 h-5" weight="fill" />;
  return <Backpack className="w-5 h-5" weight="fill" />;
}

export function CharacterPanel({
  character,
  onEquipItem,
  onOpenNotebook,
  notebookCount = 0,
}: {
  character: CocInvestigatorRecord;
  onEquipItem?: (itemId: string, type: 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace') => void;
  onOpenNotebook?: () => void;
  notebookCount?: number;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [openSection, setOpenSection] = useState<string>('stats');
  const normalizedSkills = useMemo(() => normalizeCocSkillMap(character.skills), [character.skills]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hp = character.status.hp.current;
  const hpMax = Math.max(character.status.hp.maximum, 1);
  const mp = character.status.mp.current;
  const mpMax = Math.max(character.status.mp.maximum, 1);
  const san = character.status.san.current;
  const sanMax = Math.max(character.status.san.maximum, 1);
  const equippedItems = useMemo(
    () => character.inventory.filter(item => item.is_equipped),
    [character.inventory]
  );

  if (!isMounted) {
    return <div className="h-full overflow-y-auto p-4 space-y-5 scrollbar-thin bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">Loading character...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 scrollbar-thin bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-5 shadow-[4px_4px_0_var(--ink-color)] relative">
        <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-[var(--ink-color)] text-[var(--bg-color)] flex items-center justify-center text-3xl border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]">
            {character.profile.avatar || '🕵️'}
          </div>
          <div>
            <h3 className="text-[var(--ink-color)] font-black uppercase text-xl tracking-widest mb-1">{character.profile.name}</h3>
            <p className="text-sm font-bold text-[var(--ink-color)] opacity-70 uppercase tracking-widest font-vt323">
              {character.profile.occupation || '调查员'}{typeof character.profile.age === 'number' ? ` (${character.profile.age}YRS)` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-3">
          {[
            { label: 'HP', value: `${hp}/${hpMax}`, percent: (hp / hpMax) * 100, icon: <Heart className="w-4 h-4" weight="fill" />, color: 'bg-[var(--accent-color)] text-[var(--accent-color)]' },
            { label: 'MP', value: `${mp}/${mpMax}`, percent: (mp / mpMax) * 100, icon: <Lightning className="w-4 h-4" weight="fill" />, color: 'bg-[var(--paper-light)] text-[var(--ink-color)]' },
            { label: 'SAN', value: `${san}/${sanMax}`, percent: (san / sanMax) * 100, icon: <Sparkle className="w-4 h-4" weight="fill" />, color: 'bg-[var(--ink-color)] text-[var(--ink-color)]' },
          ].map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-sm mb-1.5 font-black uppercase tracking-widest font-vt323">
                <span className={`flex items-center gap-1 ${bar.color.split(' ')[1]}`}>{bar.icon} {bar.label}</span>
                <span className="text-[var(--ink-color)]">{bar.value}</span>
              </div>
              <div className="w-full bg-theme-bg border-[2px] border-[var(--ink-color)] h-4 shadow-[2px_2px_0_var(--ink-color)]">
                <div className={`${bar.color.split(' ')[0]} h-full border-r-[2px] border-[var(--ink-color)] transition-all`} style={{ width: `${bar.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => setOpenSection(prev => prev === 'stats' ? '' : 'stats')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Shield className="w-5 h-5" weight="fill" /> 属性</span>
          {openSection === 'stats' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'stats' && (
          <div className="px-4 pb-5 pt-4 grid grid-cols-2 gap-4 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            {[
              { k: 'str', l: '力量' },
              { k: 'con', l: '体质' },
              { k: 'siz', l: '体型' },
              { k: 'dex', l: '敏捷' },
              { k: 'app', l: '外貌' },
              { k: 'int', l: '智力' },
              { k: 'pow', l: '意志' },
              { k: 'edu', l: '教育' },
              { k: 'luck', l: '幸运' },
            ].map(({ k, l }) => (
              <div key={k} className="bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] p-3 text-center flex flex-col items-center">
                <p className="text-xs opacity-60 font-black uppercase tracking-widest mb-1">{l}</p>
                <p className="font-black text-2xl font-vt323">{character.characteristics[k as keyof typeof character.characteristics] ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => setOpenSection(prev => prev === 'items' ? '' : 'items')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Package className="w-5 h-5" weight="fill" /> 装备与物品</span>
          {openSection === 'items' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'items' && (
          <div className="px-4 pb-5 pt-4 space-y-5 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            <div>
              <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 tracking-widest">已装备</h4>
              <div className="space-y-3">
                {equippedItems.length > 0 ? equippedItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex-shrink-0 opacity-80">{getItemIcon(item)}</span>
                      <span className="text-sm font-bold tracking-widest">{item.name}</span>
                    </div>
                    {onEquipItem && ['weapon', 'armor', 'boots', 'ring', 'necklace'].includes(item.category) && (
                      <button
                        onClick={() => onEquipItem(item.id, item.category as 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace')}
                        className="text-[10px] bg-[var(--accent-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                      >
                        卸下
                      </button>
                    )}
                  </div>
                )) : (
                  <div className="text-sm opacity-50 font-bold text-center py-4 tracking-widest">暂无装备</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between border-b-[2px] border-dashed border-[var(--ink-color)] pb-2">
                <h4 className="text-xs font-black opacity-60 uppercase tracking-widest">持有物品</h4>
                {onOpenNotebook && (
                  <button
                    onClick={onOpenNotebook}
                    className="text-[10px] bg-[var(--accent-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                  >
                    笔记本{notebookCount > 0 ? `(${notebookCount})` : ''}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {character.inventory.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] px-4 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 opacity-80">{getItemIcon(item)}</span>
                        <span className="text-sm font-bold uppercase tracking-widest">{item.name}</span>
                        <span className="text-xs font-black text-[var(--bg-color)] bg-[var(--ink-color)] px-2 py-0.5 border border-[var(--ink-color)] font-vt323 tracking-widest">x{item.quantity}</span>
                      </div>
                      <span className="text-[11px] opacity-60 mt-2 font-medium tracking-wide leading-tight">{item.description}</span>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {onOpenNotebook && (item.item_ref_id === 'base_notebook' || item.name.includes('笔记本')) && (
                        <button
                          onClick={onOpenNotebook}
                          className="text-[10px] bg-[var(--accent-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                        >
                          查看{notebookCount > 0 ? `(${notebookCount})` : ''}
                        </button>
                      )}
                      {onEquipItem && ['weapon', 'armor', 'boots', 'ring', 'necklace'].includes(item.category) && (
                        <button
                          onClick={() => onEquipItem(item.id, item.category as 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace')}
                          className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                        >
                          {item.is_equipped ? '卸下' : '装备'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {character.inventory.length === 0 && (
                  <div className="text-sm opacity-50 font-bold text-center py-4 tracking-widest">空空如也</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => setOpenSection(prev => prev === 'skills' ? '' : 'skills')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Star className="w-5 h-5" weight="fill" /> 技能</span>
          {openSection === 'skills' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'skills' && (
          <div className="px-4 pb-5 pt-5 flex flex-wrap gap-3 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            {Object.entries(normalizedSkills).map(([skill, value]) => (
              <span key={skill} className="px-3 py-1.5 bg-theme-bg border-[2px] border-[var(--ink-color)] font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 transition-transform cursor-default flex gap-2 items-center tracking-widest">
                {skill} <span className="text-[var(--accent-color)] font-black font-vt323">{value}</span>
              </span>
            ))}
            {Object.keys(normalizedSkills).length === 0 && (
              <div className="text-sm opacity-50 font-bold text-center py-4 tracking-widest w-full">暂无技能分配</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
