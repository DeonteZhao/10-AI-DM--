"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { CharacterPanel } from "@/components/CharacterPanel";
import { ModuleImagePlaceholder } from "@/components/ModuleImagePlaceholder";
import type { CocInvestigatorRecord, CocModuleSummary } from "@/lib/domain/coc";

export function CharacterSelectContent() {
  const searchParams = useSearchParams();
  const characterIdFromQuery = searchParams.get("id");
  const [characters, setCharacters] = useState<CocInvestigatorRecord[]>([]);
  const [modules, setModules] = useState<CocModuleSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadData = async () => {
      try {
        const [charactersRes, modulesRes] = await Promise.all([
          fetch("/api/backend/characters"),
          fetch("/api/backend/modules"),
        ]);
        if (!charactersRes.ok) {
          throw new Error(await charactersRes.text());
        }
        if (!modulesRes.ok) {
          throw new Error(await modulesRes.text());
        }
        const charactersJson = await charactersRes.json();
        const modulesJson = await modulesRes.json();
        if (disposed) {
          return;
        }
        const nextCharacters = Array.isArray(charactersJson.characters)
          ? (charactersJson.characters as CocInvestigatorRecord[]).filter((item) => item.rule_system === "coc")
          : [];
        const nextModules = Array.isArray(modulesJson.modules)
          ? (modulesJson.modules as CocModuleSummary[]).filter((item) => item.type === "coc")
          : [];
        setCharacters(nextCharacters);
        setModules(nextModules);
        setSelectedCharacterId(
          characterIdFromQuery && nextCharacters.some((item) => item.id === characterIdFromQuery)
            ? characterIdFromQuery
            : nextCharacters[0]?.id || null,
        );
        setError(null);
      } catch (nextError) {
        if (!disposed) {
          setError((nextError as Error).message || "调查员数据加载失败");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      disposed = true;
    };
  }, [characterIdFromQuery]);

  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId) || null,
    [characters, selectedCharacterId],
  );

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>;
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-10 py-16 text-center font-huiwen">
        <h2 className="text-4xl text-[var(--accent-color)] font-black uppercase tracking-widest mb-10 riso-title">{error}</h2>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] font-bold uppercase shadow-[4px_4px_0_var(--ink-color)]"
        >
          <ArrowLeft className="w-6 h-6" weight="bold" /> 返回大厅
        </Link>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-10 py-16 text-center font-huiwen">
        <h2 className="text-4xl text-[var(--ink-color)] font-black uppercase tracking-widest mb-10 riso-title">你还没有创建任何调查员</h2>
        <Link
          href="/character/create"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] font-bold uppercase shadow-[4px_4px_0_var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] active:translate-y-1 active:shadow-none transition-all text-xl tracking-wider"
        >
          <Plus className="w-6 h-6" weight="bold" /> 创建新调查员
        </Link>
      </div>
    );
  }

  if (!selectedCharacter) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-10 py-8 h-[calc(100vh-56px)] flex flex-col font-huiwen">
      <div className="mb-8 flex justify-between items-center">
        <Link
          href="/"
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-0 active:shadow-none transition-all tracking-widest text-lg"
        >
          <ArrowLeft weight="bold" /> 返回大厅
        </Link>
        <Link
          href="/character/create"
          className="flex items-center gap-2 bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] tracking-widest text-lg"
        >
          <Plus weight="bold" /> 新建调查员
        </Link>
      </div>

      <div className="flex-1 flex gap-10 min-h-0">
        <div className="flex-1 flex flex-col gap-10 overflow-y-auto pr-4 scrollbar-thin">
          <section>
            <div className="flex items-center gap-3 mb-8 border-b-[3px] border-[var(--ink-color)] pb-3">
              <span className="w-3 h-8 bg-[var(--accent-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]" />
              <h2 className="text-3xl text-[var(--ink-color)] font-black uppercase tracking-widest riso-title">调查员名录</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setSelectedCharacterId(character.id)}
                  className={`riso-card flex flex-col group cursor-pointer hover:bg-[var(--paper-light)] relative text-left ${
                    character.id === selectedCharacter.id ? "bg-[var(--paper-light)]" : ""
                  }`}
                >
                  <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                  <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                  <div className="flex items-center gap-4 mb-6 mt-4">
                    <div className="w-16 h-16 bg-theme-bg border-[3px] border-[var(--ink-color)] flex items-center justify-center text-3xl shadow-[2px_2px_0_var(--ink-color)]">
                      {character.profile.avatar || "🕵️"}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase text-[var(--ink-color)] leading-none mb-2 tracking-widest">{character.profile.name}</h3>
                      <p className="text-sm font-bold text-[var(--ink-color)] opacity-80 tracking-widest">
                        {character.profile.occupation || "调查员"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-6">
                    <span className="px-2 py-0.5 border-[2px] border-[var(--ink-color)] text-xs font-bold uppercase shadow-[2px_2px_0_var(--ink-color)] bg-[var(--ink-color)] text-[var(--bg-color)] font-vt323 tracking-widest">
                      COC 7TH
                    </span>
                    <span className="px-2 py-0.5 border-[2px] border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)] text-xs font-bold shadow-[2px_2px_0_var(--ink-color)] font-vt323 tracking-widest">
                      HP {character.status.hp.current}/{character.status.hp.maximum}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-8 border-b-[3px] border-[var(--ink-color)] pb-3">
              <span className="w-3 h-8 bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]" />
              <h2 className="text-3xl text-[var(--ink-color)] font-black uppercase tracking-widest riso-title">接手新的案件</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {modules.map((module) => (
                <Link
                  key={module.id}
                  href={`/game/new?module=${module.id}&character=${selectedCharacter.id}`}
                  className="group bg-theme-bg border-[3px] border-[var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] overflow-hidden transition-all flex flex-col"
                >
                  <div className="h-40 relative overflow-hidden border-b-[3px] border-[var(--ink-color)]">
                    <ModuleImagePlaceholder moduleId={module.id} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-color)] via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-3 left-3">
                      <span className="px-3 py-1 border-[2px] border-[var(--ink-color)] font-bold uppercase text-sm bg-[var(--accent-color)] text-[var(--bg-color)] shadow-[2px_2px_0_var(--ink-color)] font-vt323 tracking-widest">
                        {module.difficulty}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 bg-[var(--paper-light)] flex-1 flex flex-col relative">
                    <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                    <h3 className="text-[var(--ink-color)] font-black text-2xl mb-3 uppercase tracking-widest">{module.name}</h3>
                    <p className="text-lg font-medium text-[var(--ink-color)] opacity-80 line-clamp-2 mb-6 flex-1">{module.description}</p>
                    <div className="flex items-center text-[var(--bg-color)] bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 text-sm font-bold uppercase tracking-widest gap-2 shadow-[2px_2px_0_var(--ink-color)] self-start group-hover:-translate-y-0.5 group-hover:shadow-[4px_4px_0_var(--ink-color)] transition-all">
                      <Plus className="w-5 h-5" weight="bold" /> 派此调查员接手案件
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="w-96 bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[-4px_0_0_var(--ink-color)] flex-shrink-0 hidden md:block z-10 relative font-huiwen overflow-hidden">
          <CharacterPanel character={selectedCharacter} />
        </div>
      </div>
    </div>
  );
}
