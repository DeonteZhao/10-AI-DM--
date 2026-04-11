import { useEffect, useMemo, useState } from "react";
import {
  Backpack,
  BookOpenText,
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
} from "@phosphor-icons/react";
import { normalizeCocSkillMap, type CocInvestigatorRecord, type CocItem } from "@/lib/domain/coc";

type EquipCategory = "weapon" | "armor" | "boots" | "ring" | "necklace";

function getItemIcon(item: CocItem) {
  if (item.category === "weapon") return <Sword className="h-4 w-4" weight="fill" />;
  if (item.category === "armor") return <Shield className="h-4 w-4" weight="fill" />;
  if (item.category === "ring") return <Diamond className="h-4 w-4" weight="fill" />;
  if (item.category === "necklace") return <Sparkle className="h-4 w-4" weight="fill" />;
  if (item.category === "consumable") return <Flask className="h-4 w-4" weight="fill" />;
  if (item.category === "key") return <Key className="h-4 w-4" weight="fill" />;
  return <Backpack className="h-4 w-4" weight="fill" />;
}

function isEquipCategory(category: CocItem["category"]): category is EquipCategory {
  return ["weapon", "armor", "boots", "ring", "necklace"].includes(category);
}

function DossierSection({
  title,
  subtitle,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="riso-panel relative overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-[var(--paper-light)] px-4 py-3 text-left text-[var(--ink-color)]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-[var(--ink-color)] bg-theme-bg">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-vt323 uppercase tracking-[0.32em] opacity-70">{subtitle}</span>
            <span className="block text-base font-black uppercase tracking-[0.24em]">{title}</span>
          </span>
        </span>
        {isOpen ? <CaretUp className="h-5 w-5 shrink-0" weight="bold" /> : <CaretDown className="h-5 w-5 shrink-0" weight="bold" />}
      </button>
      {isOpen && <div className="border-t border-dashed border-[var(--ink-color)] bg-[rgba(255,255,255,0.14)] px-4 py-4">{children}</div>}
    </section>
  );
}

export function CharacterPanel({
  character,
  onEquipItem,
  onOpenNotebook,
  notebookCount = 0,
}: {
  character: CocInvestigatorRecord;
  onEquipItem?: (itemId: string, type: EquipCategory) => void;
  onOpenNotebook?: () => void;
  notebookCount?: number;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [openSection, setOpenSection] = useState<string>("stats");
  const normalizedSkills = useMemo(() => normalizeCocSkillMap(character.skills), [character.skills]);
  const equippedItems = useMemo(() => character.inventory.filter((item) => item.is_equipped), [character.inventory]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hp = character.status.hp.current;
  const hpMax = Math.max(character.status.hp.maximum, 1);
  const mp = character.status.mp.current;
  const mpMax = Math.max(character.status.mp.maximum, 1);
  const san = character.status.san.current;
  const sanMax = Math.max(character.status.san.maximum, 1);

  const statusBars = [
    {
      key: "hp",
      label: "HIT POINTS",
      shortLabel: "HP",
      value: `${hp}/${hpMax}`,
      percent: Math.min(100, (hp / hpMax) * 100),
      icon: <Heart className="h-4 w-4" weight="fill" />,
      fillClassName: "bg-[var(--accent-color)]",
      textClassName: "text-[var(--accent-color)]",
    },
    {
      key: "mp",
      label: "MAGIC POINTS",
      shortLabel: "MP",
      value: `${mp}/${mpMax}`,
      percent: Math.min(100, (mp / mpMax) * 100),
      icon: <Lightning className="h-4 w-4" weight="fill" />,
      fillClassName: "bg-[var(--accent-muted)]",
      textClassName: "text-[var(--accent-muted)]",
    },
    {
      key: "san",
      label: "SANITY",
      shortLabel: "SAN",
      value: `${san}/${sanMax}`,
      percent: Math.min(100, (san / sanMax) * 100),
      icon: <Sparkle className="h-4 w-4" weight="fill" />,
      fillClassName: "bg-[var(--success-color)]",
      textClassName: "text-[var(--success-color)]",
    },
  ];

  const attributes = [
    { key: "str", label: "力量", code: "STR" },
    { key: "con", label: "体质", code: "CON" },
    { key: "siz", label: "体型", code: "SIZ" },
    { key: "dex", label: "敏捷", code: "DEX" },
    { key: "app", label: "外貌", code: "APP" },
    { key: "int", label: "智力", code: "INT" },
    { key: "pow", label: "意志", code: "POW" },
    { key: "edu", label: "教育", code: "EDU" },
    { key: "luck", label: "幸运", code: "LUCK" },
  ] as const;

  if (!isMounted) {
    return <div className="h-full overflow-y-auto bg-[var(--paper-light)] px-4 py-5 font-huiwen text-lg font-bold tracking-[0.2em] text-[var(--ink-color)]">LOADING FILE...</div>;
  }

  return (
    <aside className="h-full overflow-y-auto bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="border-b-2 border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-4 text-[var(--paper-light)]">
        <div className="text-center text-[11px] font-vt323 uppercase tracking-[0.35em]">ATTACHMENT A</div>
        <div className="mt-1 text-center text-lg font-black uppercase tracking-[0.28em]">Investigator Dossier</div>
      </div>
      <div className="space-y-5 px-4 py-5">
        <section className="riso-panel riso-corners relative overflow-hidden p-4">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center border-2 border-[var(--ink-color)] bg-[rgba(31,32,65,0.08)] text-4xl shadow-[4px_4px_0_rgba(31,32,65,0.85)]">
              {character.profile.avatar || "🕵️"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Case Personnel Record</div>
              <h2 className="mt-2 break-words text-[1.75rem] font-black uppercase leading-none tracking-[0.08em]">{character.profile.name}</h2>
              <div className="mt-3 border-t border-dashed border-[var(--ink-color)] pt-3 text-sm uppercase tracking-[0.18em]">
                <div className="font-bold">{character.profile.occupation || "调查员"}</div>
                <div className="mt-1 font-vt323 text-[15px] tracking-[0.22em] opacity-70">
                  {typeof character.profile.age === "number" ? `AGE ${character.profile.age}` : "AGE UNKNOWN"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t-2 border-[var(--ink-color)] pt-4">
            {statusBars.map((bar) => (
              <div key={bar.key}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] ${bar.textClassName}`}>
                    {bar.icon}
                    {bar.shortLabel}
                  </span>
                  <span className="font-vt323 text-xl tracking-[0.18em]">{bar.value}</span>
                </div>
                <div className="text-[10px] font-vt323 uppercase tracking-[0.32em] opacity-60">{bar.label}</div>
                <div className="relative mt-2 h-3 overflow-hidden border-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.35)]">
                  <div className={`${bar.fillClassName} h-full border-r border-[var(--ink-color)]`} style={{ width: `${bar.percent}%` }} />
                  <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_9%,rgba(31,32,65,0.85)_9%,rgba(31,32,65,0.85)_10%)]" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <DossierSection
          title="属性速览"
          subtitle="Attachment B"
          icon={<Shield className="h-5 w-5" weight="fill" />}
          isOpen={openSection === "stats"}
          onToggle={() => setOpenSection((prev) => (prev === "stats" ? "" : "stats"))}
        >
          <div className="grid grid-cols-1 gap-3">
            {attributes.map(({ key, label, code }) => (
              <div key={key} className="flex items-end justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-2">
                <div>
                  <div className="text-sm font-bold tracking-[0.12em]">{label}</div>
                  <div className="font-vt323 text-[12px] uppercase tracking-[0.3em] opacity-60">{code}</div>
                </div>
                <div className="font-vt323 text-2xl tracking-[0.16em]">
                  {character.characteristics[key as keyof typeof character.characteristics] ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </DossierSection>

        <DossierSection
          title="装备与物品"
          subtitle="Attachment C"
          icon={<Package className="h-5 w-5" weight="fill" />}
          isOpen={openSection === "items"}
          onToggle={() => setOpenSection((prev) => (prev === "items" ? "" : "items"))}
        >
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center justify-between border-b border-dashed border-[var(--ink-color)] pb-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.28em]">已装备</h3>
                <span className="font-vt323 text-[12px] uppercase tracking-[0.24em] opacity-65">Equipped</span>
              </div>
              <div className="space-y-3">
                {equippedItems.length > 0 ? (
                  equippedItems.map((item) => {
                    const equipCategory = isEquipCategory(item.category) ? item.category : null;
                    return (
                    <div key={item.id} className="riso-panel-soft px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-bold tracking-[0.12em]">
                            <span className="flex h-7 w-7 items-center justify-center border border-[var(--ink-color)] bg-[rgba(31,32,65,0.06)]">
                              {getItemIcon(item)}
                            </span>
                            <span className="break-words">{item.name}</span>
                          </div>
                          {item.description && <p className="mt-2 text-xs leading-6 opacity-75">{item.description}</p>}
                        </div>
                        {onEquipItem && equipCategory && (
                          <button
                            type="button"
                            onClick={() => onEquipItem(item.id, equipCategory)}
                            className="shrink-0 border border-[var(--ink-color)] bg-[var(--accent-color)] px-3 py-1 font-vt323 text-sm uppercase tracking-[0.18em] text-[var(--paper-light)] transition hover:-translate-y-0.5"
                          >
                            卸下
                          </button>
                        )}
                      </div>
                    </div>
                  )})
                ) : (
                  <div className="py-4 text-center text-sm font-bold tracking-[0.18em] opacity-55">暂无已装备物品</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-2">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.28em]">随身清单</h3>
                  <div className="font-vt323 text-[12px] uppercase tracking-[0.24em] opacity-65">Inventory / Field Notes</div>
                </div>
                {onOpenNotebook && (
                  <button
                    type="button"
                    onClick={onOpenNotebook}
                    className="inline-flex items-center gap-2 border border-[var(--ink-color)] bg-theme-bg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] transition hover:-translate-y-0.5 hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
                  >
                    <BookOpenText className="h-4 w-4" weight="fill" />
                    笔记本{notebookCount > 0 ? ` ${notebookCount}` : ""}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {character.inventory.length > 0 ? (
                  character.inventory.map((item) => {
                    const equipCategory = isEquipCategory(item.category) ? item.category : null;
                    return (
                    <div key={item.id} className="riso-panel-soft px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center border border-[var(--ink-color)] bg-[rgba(31,32,65,0.06)]">
                              {getItemIcon(item)}
                            </span>
                            <span className="text-sm font-bold uppercase tracking-[0.12em]">{item.name}</span>
                            <span className="border border-[var(--ink-color)] px-2 py-0.5 font-vt323 text-sm tracking-[0.16em]">x{item.quantity}</span>
                            {item.is_equipped && (
                              <span className="border border-[var(--accent-color)] px-2 py-0.5 font-vt323 text-sm tracking-[0.16em] text-[var(--accent-color)]">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          {item.description && <p className="mt-2 text-xs leading-6 opacity-75">{item.description}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {onOpenNotebook && (item.item_ref_id === "base_notebook" || item.name.includes("笔记本")) && (
                            <button
                              type="button"
                              onClick={onOpenNotebook}
                              className="border border-[var(--ink-color)] bg-[var(--paper-light)] px-3 py-1 font-vt323 text-sm uppercase tracking-[0.18em] transition hover:-translate-y-0.5"
                            >
                              查看{notebookCount > 0 ? ` ${notebookCount}` : ""}
                            </button>
                          )}
                          {onEquipItem && equipCategory && (
                            <button
                              type="button"
                              onClick={() => onEquipItem(item.id, equipCategory)}
                              className={`border px-3 py-1 font-vt323 text-sm uppercase tracking-[0.18em] transition hover:-translate-y-0.5 ${
                                item.is_equipped
                                  ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-[var(--paper-light)]"
                                  : "border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)]"
                              }`}
                            >
                              {item.is_equipped ? "卸下" : "装备"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})
                ) : (
                  <div className="py-4 text-center text-sm font-bold tracking-[0.18em] opacity-55">空白清单</div>
                )}
              </div>
            </div>
          </div>
        </DossierSection>

        <DossierSection
          title="技能标签"
          subtitle="Attachment D"
          icon={<Star className="h-5 w-5" weight="fill" />}
          isOpen={openSection === "skills"}
          onToggle={() => setOpenSection((prev) => (prev === "skills" ? "" : "skills"))}
        >
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(normalizedSkills).map(([skill, value]) => (
              <span
                key={skill}
                className="inline-flex items-center gap-2 border border-[var(--ink-color)] bg-theme-bg px-3 py-2 text-sm font-bold uppercase tracking-[0.14em]"
              >
                <span>{skill}</span>
                <span className="font-vt323 text-lg tracking-[0.16em] text-[var(--accent-color)]">{value}</span>
              </span>
            ))}
            {Object.keys(normalizedSkills).length === 0 && (
              <div className="w-full py-4 text-center text-sm font-bold tracking-[0.18em] opacity-55">暂无技能分配</div>
            )}
          </div>
        </DossierSection>
      </div>
    </aside>
  );
}
