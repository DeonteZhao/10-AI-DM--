import { useState, useEffect } from 'react';
import { 
  Heart, Lightning, Shield, Package, Star, CaretDown, CaretUp, 
  Sword, MagicWand, Sparkle, 
  Flask, Key, Backpack, Boot, Diamond
} from '@phosphor-icons/react';
import type { Character } from '@/lib/gameData';

export function CharacterPanel({ 
  character,
  onUseResource,
  onEquipItem,
}: { 
  character: Character;
  onUseResource?: (type: 'action' | 'bonus_action' | 'spell_slot', name: string, level?: number) => void;
  onEquipItem?: (itemId: string, type: 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace') => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [openSection, setOpenSection] = useState<string>('combat');

  // Use useEffect to handle hydration mismatch by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-full overflow-y-auto p-4 space-y-5 scrollbar-thin bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">Loading character...</div>;
  }

  const hpPercent = (character.hp / character.maxHp) * 100;
  const mpPercent = (character.mp / character.maxMp) * 100;

  const toggle = (s: string) => setOpenSection(prev => prev === s ? '' : s);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 scrollbar-thin bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      {/* Character Header */}
      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-5 shadow-[4px_4px_0_var(--ink-color)] relative">
        <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-[var(--ink-color)] text-[var(--bg-color)] flex items-center justify-center text-3xl border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]">
            {character.avatar}
          </div>
          <div>
            <h3 className="text-[var(--ink-color)] font-black uppercase text-xl tracking-widest mb-1">{character.name}</h3>
            <p className="text-sm font-bold text-[var(--ink-color)] opacity-70 uppercase tracking-widest font-vt323">
              {character.type === 'dnd'
                ? `${character.race} ${character.class} LV.${character.level}`
                : `${character.occupation} (${character.age}YRS)`
              }
            </p>
          </div>
        </div>
        
        {/* HP / MP bars */}
        <div className="space-y-4 mb-3">
          <div>
            <div className="flex justify-between text-sm mb-1.5 font-black uppercase tracking-widest font-vt323">
              <span className="text-[var(--accent-color)] flex items-center gap-1"><Heart className="w-4 h-4" weight="fill" /> HP</span>
              <span className="text-[var(--ink-color)]">{character.hp}/{character.maxHp}</span>
            </div>
            <div className="w-full bg-theme-bg border-[2px] border-[var(--ink-color)] h-4 shadow-[2px_2px_0_var(--ink-color)]">
              <div className="bg-[var(--accent-color)] h-full border-r-[2px] border-[var(--ink-color)] transition-all" style={{ width: `${hpPercent}%` }} />
            </div>
          </div>
          {character.type === 'coc' && (
            <div>
              <div className="flex justify-between text-sm mb-1.5 font-black uppercase tracking-widest font-vt323">
                <span className="text-[var(--ink-color)] flex items-center gap-1"><Lightning className="w-4 h-4" weight="fill" /> SAN</span>
                <span className="text-[var(--ink-color)]">{character.mp}/{character.maxMp}</span>
              </div>
              <div className="w-full bg-theme-bg border-[2px] border-[var(--ink-color)] h-4 shadow-[2px_2px_0_var(--ink-color)]">
                <div className="bg-[var(--ink-color)] h-full border-r-[2px] border-[var(--ink-color)] transition-all" style={{ width: `${mpPercent}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Combat Stats (AC, Init, Speed) */}
        {character.combatStats && (
           <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t-[3px] border-dashed border-[var(--ink-color)] font-vt323">
             <div className="text-center">
               <div className="text-xs font-black text-[var(--ink-color)] opacity-60 uppercase tracking-widest">AC 护甲</div>
               <div className="text-2xl font-black text-[var(--ink-color)] flex justify-center items-center gap-1 mt-1">
                 <Shield weight="fill" className="text-[var(--accent-color)] w-5 h-5" />
                 {character.combatStats.ac}
               </div>
             </div>
             <div className="text-center border-l-[2px] border-dashed border-[var(--ink-color)]">
               <div className="text-xs font-black text-[var(--ink-color)] opacity-60 uppercase tracking-widest">INIT 先攻</div>
               <div className="text-2xl font-black text-[var(--ink-color)] mt-1">
                 {character.combatStats.initiative >= 0 ? '+' : ''}{character.combatStats.initiative}
               </div>
             </div>
             <div className="text-center border-l-[2px] border-dashed border-[var(--ink-color)]">
               <div className="text-xs font-black text-[var(--ink-color)] opacity-60 uppercase tracking-widest">SPD 速度</div>
               <div className="text-2xl font-black text-[var(--ink-color)] mt-1">{character.combatStats.speed}</div>
             </div>
           </div>
        )}
      </div>

      {/* Combat Resources Section */}
      {character.combatStats && (
        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
          <button onClick={() => toggle('combat')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
            <span className="flex items-center gap-2"><Sword className="w-5 h-5" weight="fill" /> 战斗资源</span>
            {openSection === 'combat' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
          </button>
          
          {openSection === 'combat' && (
            <div className="px-4 pb-5 pt-4 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] space-y-5">
              {/* Actions */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm tracking-widest flex items-center gap-2">
                  <span className="w-3 h-3 bg-[var(--ink-color)] border border-[var(--ink-color)]"></span> 动作
                </span>
                <div className="flex gap-1.5">
                  {Array.from({ length: character.combatStats.actions.max }).map((_, i) => (
                    <div key={i} className={`w-6 h-6 border-[2px] border-[var(--ink-color)] ${i < character.combatStats!.actions.current ? 'bg-[var(--ink-color)] shadow-[1px_1px_0_var(--ink-color)]' : 'bg-transparent opacity-30'}`} />
                  ))}
                </div>
              </div>
              
              {/* Bonus Actions */}
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm tracking-widest flex items-center gap-2">
                  <span className="w-3 h-3 bg-[var(--accent-color)] border border-[var(--ink-color)]"></span> 附赠
                </span>
                <div className="flex gap-1.5">
                  {Array.from({ length: character.combatStats.bonusActions.max }).map((_, i) => (
                    <div key={i} className={`w-6 h-6 border-[2px] border-[var(--ink-color)] ${i < character.combatStats!.bonusActions.current ? 'bg-[var(--accent-color)] shadow-[1px_1px_0_var(--ink-color)]' : 'bg-transparent opacity-30'}`} />
                  ))}
                </div>
              </div>

              {/* Spell Slots */}
              {(character.combatStats.spellSlots[1].max > 0) && (
                 <div className="pt-4 border-t-[2px] border-dashed border-[var(--ink-color)]">
                   <p className="text-xs font-black opacity-60 uppercase mb-3 flex items-center gap-1 tracking-widest">
                     <MagicWand weight="fill" /> 法术位
                   </p>
                   <div className="space-y-3">
                     {[1, 2, 3, 4, 5].map(level => {
                       const slot = character.combatStats!.spellSlots[level as 1|2|3|4|5];
                       if (slot.max === 0) return null;
                       return (
                         <div key={level} className="flex justify-between items-center text-sm font-vt323 tracking-widest">
                           <span className="font-black text-lg">{level} 环</span>
                           <div className="flex gap-1.5">
                             {Array.from({ length: slot.max }).map((_, i) => (
                               <div key={i} className={`w-8 h-4 border-[2px] border-[var(--ink-color)] ${i < slot.current ? 'bg-[var(--ink-color)] shadow-[1px_1px_0_var(--ink-color)]' : 'bg-transparent opacity-30'}`} />
                             ))}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Section */}
      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => toggle('stats')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Shield className="w-5 h-5" weight="fill" /> 属性</span>
          {openSection === 'stats' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'stats' && (
          <div className="px-4 pb-5 pt-4 grid grid-cols-2 gap-4 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            {character.type === 'dnd' ? (
              <>
                {[
                  { k: 'strength', l: '力量' }, { k: 'dexterity', l: '敏捷' },
                  { k: 'constitution', l: '体质' }, { k: 'intelligence', l: '智力' },
                  { k: 'wisdom', l: '感知' }, { k: 'charisma', l: '魅力' },
                ].map(({ k, l }) => (
                  <div key={k} className="bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] p-3 text-center flex flex-col items-center">
                    <p className="text-xs opacity-60 font-black uppercase tracking-widest mb-1">{l}</p>
                    <p className="font-black text-2xl font-vt323">{(character.stats as Record<string, number>)[k] ?? '—'}</p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { k: 'str', l: '力量' }, { k: 'con', l: '体质' }, { k: 'dex', l: '敏捷' },
                  { k: 'int', l: '智力' }, { k: 'pow', l: '意志' }, { k: 'edu', l: '教育' },
                ].map(({ k, l }) => (
                  <div key={k} className="bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] p-3 text-center flex flex-col items-center">
                    <p className="text-xs opacity-60 font-black uppercase tracking-widest mb-1">{l}</p>
                    <p className="font-black text-2xl font-vt323">{(character.stats as Record<string, number>)[k] ?? '—'}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Items & Equipment Section */}
      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => toggle('items')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Package className="w-5 h-5" weight="fill" /> 装备与物品</span>
          {openSection === 'items' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'items' && (
          <div className="px-4 pb-5 pt-4 space-y-5 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            
            {/* Equipment Slots (Only for DND) */}
            {character.type === 'dnd' && (
              <div>
                <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 tracking-widest">已装备</h4>
                <div className="space-y-3">
                  {[
                    { key: 'weapon', label: '武器', icon: <Sword className="w-5 h-5 text-[var(--ink-color)]" weight="fill" /> },
                    { key: 'armor', label: '护甲', icon: <Shield className="w-5 h-5 text-[var(--ink-color)]" weight="fill" /> },
                    { key: 'boots', label: '靴子', icon: <Boot className="w-5 h-5 text-[var(--ink-color)]" weight="fill" /> },
                    { key: 'ring', label: '戒指', icon: <Diamond className="w-5 h-5 text-[var(--ink-color)]" weight="fill" /> },
                    { key: 'necklace', label: '项链', icon: <Sparkle className="w-5 h-5 text-[var(--ink-color)]" weight="fill" /> }
                  ].map(({ key, label, icon }) => {
                    // Fallback for old equipment object format or new inventory format
                    let equippedItem = character.equipment?.[key as keyof typeof character.equipment];
                    if (!equippedItem && character.inventory) {
                        equippedItem = character.inventory.find(i => i.category === key && i.is_equipped) as any;
                    }
                    return (
                      <div key={key} className="flex items-center justify-between bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0">{icon}</span>
                          <span className={`text-sm font-bold tracking-widest ${equippedItem ? '' : 'opacity-40'}`}>
                            {equippedItem ? equippedItem.name : `[未装备 ${label}]`}
                          </span>
                        </div>
                        {equippedItem && onEquipItem && (
                          <button 
                            onClick={() => onEquipItem(equippedItem!.id, key as 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace')}
                            className="text-[10px] bg-[var(--accent-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                          >
                            卸下
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inventory */}
            <div>
              <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 tracking-widest">
                {character.type === 'dnd' ? '背包' : '持有物品'}
              </h4>
              <div className="space-y-3">
                {(character.inventory || character.items || []).filter(i => character.type === 'coc' ? true : (!i.is_equipped && !i.equipped)).map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] px-4 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 opacity-80">{
                          item.category === 'weapon' || item.type === 'weapon' ? <Sword className="w-5 h-5" weight="fill" /> : 
                          item.category === 'armor' || item.type === 'armor' ? <Shield className="w-5 h-5" weight="fill" /> :
                          item.category === 'boots' || item.type === 'boots' ? <Boot className="w-5 h-5" weight="fill" /> : 
                          item.category === 'ring' || item.type === 'ring' ? <Diamond className="w-5 h-5" weight="fill" /> :
                          item.category === 'necklace' || item.type === 'necklace' ? <Sparkle className="w-5 h-5" weight="fill" /> :
                          item.category === 'consumable' || item.type === 'consumable' ? <Flask className="w-5 h-5" weight="fill" /> : 
                          item.category === 'key' || item.type === 'key' ? <Key className="w-5 h-5" weight="fill" /> : 
                          <Backpack className="w-5 h-5" weight="fill" />
                        }</span>
                        <span className="text-sm font-bold uppercase tracking-widest">{item.name}</span>
                        <span className="text-xs font-black text-[var(--bg-color)] bg-[var(--ink-color)] px-2 py-0.5 border border-[var(--ink-color)] font-vt323 tracking-widest">x{item.quantity}</span>
                      </div>
                      <span className="text-[11px] opacity-60 mt-2 font-medium tracking-wide leading-tight">{item.description}</span>
                    </div>
                    {character.type === 'dnd' && onEquipItem && ['weapon', 'armor', 'boots', 'ring', 'necklace'].includes(item.category || item.type || '') && (
                      <button 
                        onClick={() => onEquipItem(item.id, (item.category || item.type) as 'weapon' | 'armor' | 'boots' | 'ring' | 'necklace')}
                        className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1 font-bold uppercase tracking-widest hover:opacity-90 active:translate-y-px border-[2px] border-[var(--ink-color)]"
                      >
                        装备
                      </button>
                    )}
                  </div>
                ))}
                {(character.inventory || character.items || []).filter(i => character.type === 'coc' ? true : (!i.is_equipped && !i.equipped)).length === 0 && (
                  <div className="text-sm opacity-50 font-bold text-center py-4 tracking-widest">空空如也</div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Abilities & Spells Section */}
      {(character.features || character.spells) && (
        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
          <button onClick={() => toggle('abilities')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
            <span className="flex items-center gap-2"><Sparkle className="w-5 h-5" weight="fill" /> 能力与法术</span>
            {openSection === 'abilities' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
          </button>
          
          {openSection === 'abilities' && (
            <div className="px-4 pb-5 pt-4 space-y-5 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
              
              {/* Features */}
              {character.features && character.features.length > 0 && (
                <div>
                  <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 flex items-center gap-1 tracking-widest">
                    特性
                  </h4>
                  <div className="space-y-3">
                    {character.features.map(feat => (
                      <div key={feat.id} className="bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold tracking-widest text-[var(--ink-color)]">{feat.name}</h4>
                          <div className="flex gap-2">
                            {feat.type === 'action' && <span className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 py-0.5 font-bold tracking-widest">动作</span>}
                            {feat.type === 'bonus_action' && <span className="text-[10px] bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 py-0.5 font-bold tracking-widest">附赠</span>}
                            {feat.type === 'passive' && <span className="text-[10px] bg-[var(--paper-light)] border-[2px] border-[var(--ink-color)] px-2 py-0.5 font-bold tracking-widest">被动</span>}
                          </div>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed flex-1 tracking-wide">{feat.description}</p>
                        
                        <div className="mt-3 flex items-center justify-between border-t-[2px] border-dashed border-[var(--ink-color)] pt-3">
                          {feat.uses ? (
                            <>
                              <span className="text-[10px] opacity-60 uppercase font-black tracking-widest">
                                {feat.reset === 'short_rest' ? '短休恢复' : '长休恢复'}
                              </span>
                              <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                  {Array.from({ length: feat.uses.max }).map((_, i) => (
                                    <div key={i} className={`w-3.5 h-3.5 border-[2px] border-[var(--ink-color)] ${i < feat.uses!.current ? 'bg-[var(--accent-color)]' : 'bg-transparent opacity-30'}`} />
                                  ))}
                                </div>
                                {onUseResource && feat.uses.current > 0 && feat.type !== 'passive' && (
                                  <button 
                                    onClick={() => onUseResource(feat.type as 'action' | 'bonus_action', feat.name)}
                                    className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1 font-bold tracking-widest border-[2px] border-[var(--ink-color)] hover:opacity-90 active:translate-y-px"
                                  >
                                    使用
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="w-full flex justify-end">
                              {onUseResource && feat.type !== 'passive' && (
                                <button 
                                  onClick={() => onUseResource(feat.type as 'action' | 'bonus_action', feat.name)}
                                  className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1 font-bold tracking-widest border-[2px] border-[var(--ink-color)] hover:opacity-90 active:translate-y-px"
                                >
                                  使用
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cantrips */}
              {character.spells && character.spells.filter(s => s.level === 0).length > 0 && (
                <div>
                  <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 tracking-widest">戏法 (无限使用)</h4>
                  <div className="space-y-3">
                    {character.spells.filter(s => s.level === 0).map(spell => (
                      <div key={spell.id} className="bg-theme-bg border-[2px] border-[var(--ink-color)] p-4 shadow-[2px_2px_0_var(--ink-color)]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold tracking-widest flex items-center gap-2">
                            {spell.name} <span className="text-[10px] bg-[var(--paper-light)] border-[2px] border-[var(--ink-color)] px-2 py-0.5">戏法</span>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 font-bold tracking-widest border-[2px] border-[var(--ink-color)] ${spell.castingTime === 'action' ? 'bg-[var(--ink-color)] text-[var(--bg-color)]' : spell.castingTime === 'bonus_action' ? 'bg-[var(--accent-color)] text-[var(--bg-color)]' : 'bg-theme-bg'}`}>
                            {spell.castingTime === 'action' ? '动作' : spell.castingTime === 'bonus_action' ? '附赠' : '反应'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed tracking-wide">{spell.description}</p>
                        <div className="mt-3 flex items-center justify-between border-t-[2px] border-dashed border-[var(--ink-color)] pt-3">
                          {spell.damageOrHealing ? (
                            <div className="text-xs font-black text-[var(--accent-color)] tracking-widest">效果: {spell.damageOrHealing}</div>
                          ) : <div />}
                          {onUseResource && (
                            <button 
                              onClick={() => onUseResource(spell.castingTime as 'action' | 'bonus_action', spell.name)}
                              className="text-[10px] bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1 font-bold tracking-widest border-[2px] border-[var(--ink-color)] hover:opacity-90 active:translate-y-px"
                            >
                              施放
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leveled Spells */}
              {character.spells && [1, 2, 3, 4, 5].map(level => {
                const levelSpells = character.spells!.filter(s => s.level === level);
                if (levelSpells.length === 0) return null;
                
                // Check if has slots available for this level
                const hasSlots = (character.combatStats?.spellSlots[level as 1|2|3|4|5]?.current || 0) > 0;
                
                return (
                  <div key={`spell-level-${level}`}>
                    <h4 className="text-xs font-black opacity-60 uppercase mb-3 border-b-[2px] border-dashed border-[var(--ink-color)] pb-2 tracking-widest">{level} 环法术 (消耗法术位)</h4>
                    <div className="space-y-3">
                      {levelSpells.map(spell => (
                        <div key={spell.id} className="bg-theme-bg border-[2px] border-[var(--ink-color)] p-4 shadow-[2px_2px_0_var(--ink-color)]">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold tracking-widest flex items-center gap-2">
                              {spell.name} <span className="text-[10px] bg-[var(--paper-light)] border-[2px] border-[var(--ink-color)] px-2 py-0.5">{level}环</span>
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 font-bold tracking-widest border-[2px] border-[var(--ink-color)] ${spell.castingTime === 'action' ? 'bg-[var(--ink-color)] text-[var(--bg-color)]' : spell.castingTime === 'bonus_action' ? 'bg-[var(--accent-color)] text-[var(--bg-color)]' : 'bg-theme-bg'}`}>
                              {spell.castingTime === 'action' ? '动作' : spell.castingTime === 'bonus_action' ? '附赠' : '反应'}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 leading-relaxed tracking-wide">{spell.description}</p>
                          <div className="mt-3 flex items-center justify-between border-t-[2px] border-dashed border-[var(--ink-color)] pt-3">
                            {spell.damageOrHealing ? (
                              <div className="text-xs font-black text-[var(--accent-color)] tracking-widest">效果: {spell.damageOrHealing}</div>
                            ) : <div />}
                            {onUseResource && (
                              <button 
                                onClick={() => onUseResource('spell_slot', spell.name, level)}
                                disabled={!hasSlots}
                                className={`text-[10px] px-3 py-1 font-bold tracking-widest border-[2px] border-[var(--ink-color)] active:translate-y-px ${hasSlots ? 'bg-[var(--ink-color)] text-[var(--bg-color)] hover:opacity-90' : 'bg-transparent opacity-40 cursor-not-allowed'}`}
                              >
                                施放
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Skills Section */}
      <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]">
        <button onClick={() => toggle('skills')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] transition-colors font-black uppercase border-b-[3px] border-transparent tracking-widest">
          <span className="flex items-center gap-2"><Star className="w-5 h-5" weight="fill" /> 技能</span>
          {openSection === 'skills' ? <CaretUp className="w-5 h-5" weight="bold" /> : <CaretDown className="w-5 h-5" weight="bold" />}
        </button>
        {openSection === 'skills' && (
          <div className="px-4 pb-5 pt-5 flex flex-wrap gap-3 border-t-[3px] border-[var(--ink-color)] bg-[var(--paper-light)]">
            {Array.isArray(character.skills) 
              ? character.skills.map(skill => (
                  <span key={skill} className="px-3 py-1.5 bg-theme-bg border-[2px] border-[var(--ink-color)] font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 transition-transform cursor-default tracking-widest">{skill}</span>
                ))
              : Object.entries(character.skills).map(([skill, val]) => (
                  <span key={skill} className="px-3 py-1.5 bg-theme-bg border-[2px] border-[var(--ink-color)] font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 transition-transform cursor-default flex gap-2 items-center tracking-widest">
                    {skill} <span className="text-[var(--accent-color)] font-black font-vt323">{val}</span>
                  </span>
                ))
            }
          </div>
        )}
      </div>
    </div>
  );
}