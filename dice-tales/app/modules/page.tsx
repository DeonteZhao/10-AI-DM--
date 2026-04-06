"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "@phosphor-icons/react";
import { ModuleImagePlaceholder } from "@/components/ModuleImagePlaceholder";
import type { CocInvestigatorRecord, CocModuleSummary } from "@/lib/domain/coc";

function ModulesContent() {
  const router = useRouter();
  const [modules, setModules] = useState<CocModuleSummary[]>([]);
  const [characters, setCharacters] = useState<CocInvestigatorRecord[]>([]);
  const [selectedModule, setSelectedModule] = useState<CocModuleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadData = async () => {
      try {
        const [modulesRes, charactersRes] = await Promise.all([
          fetch("/api/backend/modules"),
          fetch("/api/backend/characters"),
        ]);
        if (!modulesRes.ok) {
          throw new Error(await modulesRes.text());
        }
        if (!charactersRes.ok) {
          throw new Error(await charactersRes.text());
        }
        const modulesJson = await modulesRes.json();
        const charactersJson = await charactersRes.json();
        if (disposed) {
          return;
        }
        setModules(
          Array.isArray(modulesJson.modules)
            ? (modulesJson.modules as CocModuleSummary[]).filter((item) => item.type === "coc")
            : [],
        );
        setCharacters(
          Array.isArray(charactersJson.characters)
            ? (charactersJson.characters as CocInvestigatorRecord[]).filter((item) => item.rule_system === "coc")
            : [],
        );
        setError(null);
      } catch (nextError) {
        if (!disposed) {
          setError((nextError as Error).message || "加载案件失败");
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
  }, []);

  const handleOpenModule = (module: CocModuleSummary) => {
    if (characters.length > 0) {
      setSelectedModule(module);
      return;
    }
    router.push(`/character/create?module=${module.id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-10 py-12 relative z-10 font-huiwen">
      <div className="mb-10 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-0 active:shadow-none transition-all text-lg"
        >
          <ArrowLeft weight="bold" /> 返回
        </button>
      </div>

      <div
        className="mb-12 border-b-[3px] border-[var(--ink-color)] pb-6 border-dashed riso-border"
        style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
      >
        <h1 className="text-5xl font-black uppercase tracking-widest riso-title text-[var(--ink-color)]">
          选择案件
        </h1>
        <p className="text-[var(--ink-color)] opacity-70 mt-3 font-bold uppercase tracking-widest text-lg">
          当前仅保留 COC 单一路径
        </p>
      </div>

      {loading && (
        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-8 text-center text-[var(--ink-color)] font-bold tracking-widest">
          正在读取案件档案…
        </div>
      )}

      {error && (
        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-8 text-center text-[var(--accent-color)] font-bold tracking-widest">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => handleOpenModule(module)}
              className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] transition-all flex flex-col group overflow-hidden text-left"
            >
              <div className="h-40 relative flex items-center justify-center border-b-[3px] border-[var(--ink-color)] overflow-hidden bg-[var(--paper-light)]">
                <ModuleImagePlaceholder moduleId={module.id} />
                <div className="absolute inset-0 bg-[var(--ink-color)] opacity-20 mix-blend-multiply group-hover:opacity-10 transition-opacity" />
                <span className="absolute top-3 right-3 px-3 py-1 border-[2px] border-[var(--ink-color)] font-bold uppercase text-xs shadow-[2px_2px_0_var(--ink-color)] bg-[var(--ink-color)] text-[var(--bg-color)] font-vt323 tracking-widest">
                  COC 7TH
                </span>
              </div>

              <div className="p-5 bg-theme-bg text-[var(--ink-color)] flex-1 flex flex-col relative">
                <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
                <h3 className="text-2xl font-black mb-3 uppercase tracking-widest leading-tight">{module.name}</h3>
                <p className="text-base font-bold opacity-80 line-clamp-3 mb-6 flex-1 tracking-wide">{module.description}</p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t-[3px] border-dashed border-[var(--ink-color)]">
                  <span className="font-black text-xl tracking-widest font-vt323">{module.price}</span>
                  <span className="bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-3 py-1 text-xs font-bold shadow-[2px_2px_0_var(--ink-color)] font-vt323 tracking-widest uppercase">
                    {module.difficulty}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedModule && (
        <div className="fixed inset-0 bg-[var(--bg-color)]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm font-huiwen">
          <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[8px_8px_0_var(--ink-color)] max-w-2xl w-full max-h-[80vh] flex flex-col relative">
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-[var(--accent-color)] border-[3px] border-[var(--ink-color)] rounded-full z-10 shadow-[2px_2px_0_var(--ink-color)]" />
            <div className="p-6 border-b-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] flex justify-between items-center relative">
              <div className="absolute top-2 left-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
              <h2 className="text-3xl font-black text-[var(--ink-color)] uppercase tracking-widest riso-title">
                选择调查员开始 {selectedModule.name}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedModule(null)}
                className="text-[var(--ink-color)] hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)] font-black text-2xl w-10 h-10 border-[3px] border-transparent hover:border-[var(--ink-color)] transition-all flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-theme-bg">
              <p className="text-[var(--ink-color)] opacity-70 font-bold mb-6 uppercase text-lg tracking-widest border-l-[3px] border-[var(--ink-color)] pl-3">
                已保存的调查员
              </p>
              <div className="grid sm:grid-cols-2 gap-6 mb-10">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => router.push(`/game/new?module=${selectedModule.id}&character=${character.id}`)}
                    className="flex items-center gap-4 bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-4 hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--ink-color)] transition-all text-left group relative"
                  >
                    <div className="absolute top-1 right-1 text-theme-ink text-[10px] leading-none opacity-30 font-vt323 tracking-widest">+</div>
                    <div className="w-14 h-14 bg-theme-bg border-[3px] border-[var(--ink-color)] flex items-center justify-center text-3xl shadow-[2px_2px_0_var(--ink-color)] group-hover:bg-[var(--accent-color)] group-hover:text-[var(--bg-color)] transition-colors">
                      {character.profile.avatar || "🕵️"}
                    </div>
                    <div>
                      <h4 className="font-black text-[var(--ink-color)] uppercase text-xl tracking-widest mb-1">{character.profile.name}</h4>
                      <p className="text-sm text-[var(--ink-color)] opacity-70 font-bold tracking-widest">
                        {character.profile.occupation || "调查员"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="relative flex py-6 items-center">
                <div className="flex-grow border-t-[3px] border-dashed border-[var(--ink-color)] opacity-30" />
                <span className="flex-shrink-0 mx-6 text-[var(--ink-color)] opacity-50 font-black uppercase tracking-widest text-xl">或</span>
                <div className="flex-grow border-t-[3px] border-dashed border-[var(--ink-color)] opacity-30" />
              </div>

              <button
                type="button"
                onClick={() => router.push(`/character/create?module=${selectedModule.id}`)}
                className="w-full flex items-center justify-center gap-3 bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] p-5 font-black uppercase text-2xl hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] transition-all tracking-widest"
              >
                <Plus weight="bold" className="w-8 h-8" /> 创建新调查员
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModulesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-2xl font-black tracking-widest">LOADING...</div>}>
      <ModulesContent />
    </Suspense>
  );
}
