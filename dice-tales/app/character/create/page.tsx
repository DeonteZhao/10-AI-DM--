"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CaretLeft, CaretRight, DiceFive } from "@phosphor-icons/react";
import { useBetaAccess } from "@/components/BetaAccessGate";
import {
  COC_BASELINE_MODULE_ID,
  COC_BASELINE_MODULE_NAME,
  type CocCharacteristics,
  type CocInvestigatorCreatePayload,
  type CocModuleSummary,
} from "@/lib/domain/coc";

type Step = "basic" | "stats" | "skills" | "confirm";

type OccupationDetail = {
  skills: string[];
  creditRating: [number, number];
  pointFormula: "EDU*4" | "EDU*2+(STR|DEX)*2";
};

const OCCUPATION_DETAILS: Record<string, OccupationDetail> = {
  私家侦探: { skills: ["艺术/手艺(摄影)", "乔装", "法律", "图书馆利用", "聆听", "心理学", "侦查"], creditRating: [9, 30], pointFormula: "EDU*2+(STR|DEX)*2" },
  教授: { skills: ["图书馆利用", "其他语言", "母语", "心理学", "外语"], creditRating: [20, 70], pointFormula: "EDU*4" },
  记者: { skills: ["艺术/手艺(摄影)", "历史", "图书馆利用", "母语", "心理学"], creditRating: [9, 30], pointFormula: "EDU*4" },
  医生: { skills: ["急救", "医学", "拉丁语", "心理学", "科学(生物学)", "科学(药学)"], creditRating: [30, 80], pointFormula: "EDU*4" },
  作家: { skills: ["艺术/手艺(文学)", "历史", "图书馆利用", "自然界", "外语", "心理学"], creditRating: [9, 30], pointFormula: "EDU*4" },
  古董商: { skills: ["估价", "艺术/手艺", "历史", "图书馆利用", "外语", "侦查"], creditRating: [30, 70], pointFormula: "EDU*4" },
  警察: { skills: ["斗殴", "射击(手枪)", "急救", "法律", "心理学", "侦查"], creditRating: [9, 30], pointFormula: "EDU*2+(STR|DEX)*2" },
  图书管理员: { skills: ["会计", "图书馆利用", "外语", "母语"], creditRating: [9, 30], pointFormula: "EDU*4" },
};

const OCCUPATIONS = Object.keys(OCCUPATION_DETAILS);

const BASE_SKILLS: Record<string, number> = {
  侦查: 25,
  图书馆利用: 20,
  聆听: 20,
  心理学: 10,
  急救: 30,
  潜行: 20,
  斗殴: 25,
  "射击(手枪)": 20,
  闪避: 0,
  话术: 5,
  说服: 10,
  恐吓: 15,
  魅力: 15,
  历史: 5,
  医学: 1,
  自然界: 10,
  "科学(生物学)": 1,
  "科学(药学)": 1,
  "艺术/手艺(摄影)": 5,
  "艺术/手艺(文学)": 5,
  乔装: 5,
  法律: 5,
  外语: 1,
  母语: 0,
  估价: 5,
  机械维修: 10,
  电气维修: 10,
  信用评级: 0,
  拉丁语: 1,
  其他语言: 1,
  会计: 5,
};

const STEP_LABELS: Record<Step, string> = {
  basic: "基本信息",
  stats: "属性",
  skills: "技能",
  confirm: "确认",
};

const STEP_ORDER: Step[] = ["basic", "stats", "skills", "confirm"];

const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;
const roll3d6 = () => (rollDie(6) + rollDie(6) + rollDie(6)) * 5;
const roll2d6Plus6 = () => (rollDie(6) + rollDie(6) + 6) * 5;

const createRolledCharacteristics = (): CocCharacteristics => {
  const next: CocCharacteristics = {
    str: roll3d6(),
    con: roll3d6(),
    siz: roll2d6Plus6(),
    dex: roll3d6(),
    app: roll3d6(),
    int: roll2d6Plus6(),
    pow: roll3d6(),
    edu: roll2d6Plus6(),
    luck: roll3d6(),
  };
  return next;
};

function getSkillBaseValue(skill: string, characteristics: CocCharacteristics) {
  if (skill === "闪避") {
    return Math.floor((characteristics.dex || 0) / 2);
  }
  if (skill === "母语") {
    return characteristics.edu || 0;
  }
  return BASE_SKILLS[skill] || 0;
}

function CharacterCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady } = useBetaAccess();
  const requestedModuleId = searchParams.get("module");
  const [moduleSummary, setModuleSummary] = useState<CocModuleSummary | null>(null);
  const [activeModuleId, setActiveModuleId] = useState(requestedModuleId || COC_BASELINE_MODULE_ID);
  const [loadingModule, setLoadingModule] = useState(true);
  const [moduleError, setModuleError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("basic");
  const [name, setName] = useState("");
  const [occupation, setOccupation] = useState(OCCUPATIONS[0]);
  const [age, setAge] = useState(25);
  const [characteristics, setCharacteristics] = useState<CocCharacteristics>({});
  const [allocations, setAllocations] = useState<Record<string, { occ: number; per: number }>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let disposed = false;

    const loadModule = async (moduleId: string, fallbackUsed: boolean) => {
      try {
        const res = await fetch(`/api/backend/modules/${moduleId}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const json = await res.json();
        if (!disposed) {
          setActiveModuleId(moduleId);
          setModuleSummary((json.module as CocModuleSummary) || null);
          setModuleError(null);
        }
      } catch (error) {
        if (!fallbackUsed && moduleId !== COC_BASELINE_MODULE_ID) {
          await loadModule(COC_BASELINE_MODULE_ID, true);
          return;
        }
        if (!disposed) {
          setModuleError((error as Error).message || "案件信息加载失败");
          setModuleSummary(null);
        }
      } finally {
        if (!disposed) {
          setLoadingModule(false);
        }
      }
    };

    setLoadingModule(true);
    void loadModule(requestedModuleId || COC_BASELINE_MODULE_ID, false);
    return () => {
      disposed = true;
    };
  }, [isReady, requestedModuleId]);

  const occupationDetail = OCCUPATION_DETAILS[occupation];
  const occPointsTotal = useMemo(() => {
    if (!characteristics.edu) {
      return 0;
    }
    if (occupationDetail.pointFormula === "EDU*2+(STR|DEX)*2") {
      return characteristics.edu * 2 + Math.max(characteristics.str || 0, characteristics.dex || 0) * 2;
    }
    return characteristics.edu * 4;
  }, [characteristics.dex, characteristics.edu, characteristics.str, occupationDetail.pointFormula]);

  const personalPointsTotal = (characteristics.int || 0) * 2;
  const occPointsSpent = Object.values(allocations).reduce((sum, item) => sum + item.occ, 0);
  const personalPointsSpent = Object.values(allocations).reduce((sum, item) => sum + item.per, 0);
  const currentStepIndex = STEP_ORDER.indexOf(step);

  const handleRollCharacteristics = () => {
    setCharacteristics(createRolledCharacteristics());
    setAllocations({});
    setSubmitError(null);
  };

  const adjustSkill = (skill: string, target: "occ" | "per", delta: number) => {
    setAllocations((prev) => {
      const current = prev[skill] || { occ: 0, per: 0 };
      const nextValue = current[target] + delta;
      if (nextValue < 0) {
        return prev;
      }
      const nextOccSpent = occPointsSpent + (target === "occ" ? delta : 0);
      const nextPersonalSpent = personalPointsSpent + (target === "per" ? delta : 0);
      if (delta > 0 && target === "occ" && nextOccSpent > occPointsTotal) {
        return prev;
      }
      if (delta > 0 && target === "per" && nextPersonalSpent > personalPointsTotal) {
        return prev;
      }
      const nextOcc = target === "occ" ? nextValue : current.occ;
      const nextPer = target === "per" ? nextValue : current.per;
      const total = getSkillBaseValue(skill, characteristics) + nextOcc + nextPer;
      if (delta > 0 && total > 99) {
        return prev;
      }
      return {
        ...prev,
        [skill]: {
          occ: nextOcc,
          per: nextPer,
        },
      };
    });
  };

  const canAdvanceFromBasic = name.trim().length > 0;
  const canAdvanceFromStats = Boolean(characteristics.str && characteristics.con && characteristics.siz && characteristics.dex && characteristics.app && characteristics.int && characteristics.pow && characteristics.edu && characteristics.luck);
  const canAdvanceFromSkills = occPointsSpent === occPointsTotal && personalPointsSpent === personalPointsTotal && Object.keys(allocations).length > 0;

  const finalSkills = useMemo(() => {
    const next: Record<string, number> = {};
    Object.entries(allocations).forEach(([skill, value]) => {
      const total = getSkillBaseValue(skill, characteristics) + value.occ + value.per;
      if (total > 0) {
        next[skill] = total;
      }
    });
    return next;
  }, [allocations, characteristics]);

  const maxHp = Math.max(1, Math.floor(((characteristics.con || 0) + (characteristics.siz || 0)) / 10));
  const maxMp = Math.max(0, Math.floor((characteristics.pow || 0) / 5));
  const maxSan = characteristics.pow || 0;

  const handleNext = () => {
    if (step === "basic" && canAdvanceFromBasic) {
      setStep("stats");
      return;
    }
    if (step === "stats" && canAdvanceFromStats) {
      setStep("skills");
      return;
    }
    if (step === "skills" && canAdvanceFromSkills) {
      setStep("confirm");
    }
  };

  const handleBack = () => {
    if (currentStepIndex <= 0) {
      return;
    }
    setStep(STEP_ORDER[currentStepIndex - 1]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CocInvestigatorCreatePayload = {
        profile: {
          name: name.trim(),
          occupation,
          age,
        },
        characteristics,
        skills: finalSkills,
        inventory: [],
        status: {
          hp: { current: maxHp, maximum: maxHp },
          mp: { current: maxMp, maximum: maxMp },
          san: { current: maxSan, maximum: maxSan },
          conditions: [],
          flags: {},
        },
      };
      const res = await fetch("/api/backend/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      const characterId = json.character?.id as string | undefined;
      if (!characterId) {
        throw new Error("角色创建成功，但未返回调查员编号");
      }
      router.push(`/game/new?module=${activeModuleId}&character=${characterId}`);
    } catch (error) {
      setSubmitError((error as Error).message || "调查员创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-12 relative z-10 font-huiwen">
      <div className="mb-10 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink-color)] hover:bg-[var(--paper-light)] active:translate-y-0 active:shadow-none transition-all text-lg"
        >
          <ArrowLeft weight="bold" /> 返回
        </button>
      </div>

      {activeModuleId && (
        <div className="mb-10 flex items-center gap-4 bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-6 shadow-[4px_4px_0_var(--ink-color)] relative">
          <div className="absolute top-2 right-2 text-theme-ink text-xs leading-none opacity-50 font-vt323 tracking-widest">+</div>
          <div className="w-16 h-20 bg-[var(--ink-color)] border-[3px] border-[var(--ink-color)] overflow-hidden relative flex-shrink-0" />
          <div>
            <p className="text-[var(--ink-color)] opacity-70 text-sm font-bold tracking-widest uppercase mb-1 font-vt323">CREATING INVESTIGATOR FOR CASE</p>
            <h2 className="text-[var(--ink-color)] text-3xl font-black uppercase tracking-widest riso-title">
              {loadingModule ? "正在读取案件…" : moduleSummary?.name || COC_BASELINE_MODULE_NAME}
            </h2>
            {moduleError && <p className="mt-2 text-sm font-bold text-[var(--accent-color)] tracking-widest">{moduleError}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-12 px-4 relative">
        <div className="absolute top-1/2 left-0 right-0 h-[3px] bg-[var(--ink-color)] opacity-30 -z-10 -translate-y-1/2 border-dashed border-t-[3px] border-transparent" style={{ borderTopColor: "var(--ink-color)" }} />
        {STEP_ORDER.map((value, index) => (
          <div key={value} className="flex flex-col items-center gap-3">
            <div className={`w-10 h-10 flex items-center justify-center border-[3px] font-black text-xl tracking-widest font-vt323 ${
              index <= currentStepIndex
                ? "border-[var(--ink-color)] text-[var(--bg-color)] bg-[var(--ink-color)]"
                : "bg-[var(--bg-color)] border-[var(--ink-color)] text-[var(--ink-color)] opacity-50"
            }`}>
              {index + 1}
            </div>
            <span className={`text-sm font-bold tracking-widest uppercase ${
              index <= currentStepIndex ? "text-[var(--ink-color)]" : "text-[var(--ink-color)] opacity-50"
            }`}>
              {STEP_LABELS[value]}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-10 shadow-[8px_8px_0_var(--ink-color)] text-[var(--ink-color)] relative">
        {step === "basic" && (
          <div className="space-y-8 max-w-xl mx-auto">
            <h2 className="text-4xl font-black mb-8 text-center uppercase tracking-widest riso-title">基本信息</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">调查员姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)]"
                  placeholder="输入一个名字..."
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">职业</label>
                  <select
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value)}
                    className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)] cursor-pointer"
                  >
                    {OCCUPATIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--ink-color)] font-black mb-3 text-xl uppercase tracking-widest">年龄</label>
                  <input
                    type="number"
                    value={age}
                    min={15}
                    max={90}
                    onChange={(event) => setAge(Number(event.target.value))}
                    className="w-full bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 font-bold text-xl focus:outline-none focus:shadow-[4px_4px_0_var(--ink-color)] transition-all font-huiwen text-[var(--ink-color)]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "stats" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8 border-b-[3px] border-[var(--ink-color)] pb-4">
              <h2 className="text-4xl font-black uppercase tracking-widest riso-title">属性值</h2>
              <button
                type="button"
                onClick={handleRollCharacteristics}
                className="flex items-center gap-3 bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-8 py-4 font-black uppercase hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] active:translate-y-0 active:shadow-none transition-all text-2xl tracking-widest"
              >
                <DiceFive className="w-8 h-8" weight="fill" />
                掷骰生成
              </button>
            </div>
            {Object.keys(characteristics).length === 0 ? (
              <div className="text-center py-16 border-[3px] border-dashed border-[var(--ink-color)] bg-theme-bg opacity-70">
                <DiceFive className="w-20 h-20 text-[var(--ink-color)] mx-auto mb-6 opacity-50" />
                <p className="text-[var(--ink-color)] font-bold text-xl tracking-widest">点击上方按钮生成 COC 属性</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  ["str", "力量 STR"],
                  ["con", "体质 CON"],
                  ["siz", "体型 SIZ"],
                  ["dex", "敏捷 DEX"],
                  ["app", "外貌 APP"],
                  ["int", "智力 INT"],
                  ["pow", "意志 POW"],
                  ["edu", "教育 EDU"],
                  ["luck", "幸运 LUCK"],
                ].map(([key, label]) => (
                  <div key={key} className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-5 flex flex-col relative overflow-hidden group shadow-[4px_4px_0_var(--ink-color)]">
                    <span className="text-[var(--ink-color)] font-black text-lg tracking-widest uppercase">{label}</span>
                    <div className="mt-6 text-4xl font-black text-[var(--ink-color)] font-vt323">
                      {characteristics[key as keyof CocCharacteristics] || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "skills" && (
          <div className="space-y-8">
            <div className="border-b-[3px] border-[var(--ink-color)] pb-4">
              <h2 className="text-4xl font-black uppercase tracking-widest riso-title">技能分配</h2>
              <p className="mt-4 font-bold tracking-widest">
                本职点数 {occPointsSpent} / {occPointsTotal} · 兴趣点数 {personalPointsSpent} / {personalPointsTotal}
              </p>
              <p className="mt-2 font-bold tracking-widest opacity-70">
                本职技能：{occupationDetail.skills.join("、")}
              </p>
            </div>
            <div className="grid gap-4">
              {Object.keys(BASE_SKILLS).map((skill) => {
                const allocation = allocations[skill] || { occ: 0, per: 0 };
                const base = getSkillBaseValue(skill, characteristics);
                const total = base + allocation.occ + allocation.per;
                const isOccupationSkill = occupationDetail.skills.includes(skill);
                return (
                  <div key={skill} className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 shadow-[4px_4px_0_var(--ink-color)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xl font-black tracking-widest">{skill}</div>
                        <div className="mt-2 text-sm font-bold tracking-widest opacity-70">
                          基础 {base} · 总值 {total} {isOccupationSkill ? "· 本职" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => adjustSkill(skill, "occ", -5)} className="w-10 h-10 border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] font-black text-xl">-</button>
                          <span className="min-w-16 text-center font-black tracking-widest">本职 {allocation.occ}</span>
                          <button type="button" onClick={() => adjustSkill(skill, "occ", 5)} className="w-10 h-10 border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] font-black text-xl">+</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => adjustSkill(skill, "per", -5)} className="w-10 h-10 border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] font-black text-xl">-</button>
                          <span className="min-w-16 text-center font-black tracking-widest">兴趣 {allocation.per}</span>
                          <button type="button" onClick={() => adjustSkill(skill, "per", 5)} className="w-10 h-10 border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] font-black text-xl">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-8">
            <h2 className="text-4xl font-black uppercase tracking-widest riso-title text-center">确认调查员</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-6 shadow-[4px_4px_0_var(--ink-color)]">
                <div className="text-3xl font-black tracking-widest">{name}</div>
                <div className="mt-3 font-bold tracking-widest opacity-70">
                  {occupation} · {age} 岁
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ["HP", maxHp],
                    ["MP", maxMp],
                    ["SAN", maxSan],
                  ].map(([label, value]) => (
                    <div key={label} className="border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] p-4 text-center">
                      <div className="text-sm font-black tracking-widest opacity-70">{label}</div>
                      <div className="text-3xl font-black font-vt323">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-6 shadow-[4px_4px_0_var(--ink-color)]">
                <div className="text-xl font-black tracking-widest mb-4">已分配技能</div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(finalSkills).map(([skill, value]) => (
                    <span key={skill} className="px-3 py-2 border-[2px] border-[var(--ink-color)] bg-[var(--paper-light)] font-bold tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                      {skill} {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {submitError && (
              <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 text-[var(--accent-color)] font-bold tracking-widest">
                {submitError}
              </div>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="w-full bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] p-5 font-black uppercase text-2xl hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] transition-all tracking-widest disabled:opacity-60"
            >
              {submitting ? "正在创建调查员…" : "确认并开始"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
          className="flex items-center gap-2 bg-theme-bg text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] px-5 py-3 font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] disabled:opacity-40"
        >
          <CaretLeft weight="bold" /> 上一步
        </button>
        {step !== "confirm" && (
          <button
            type="button"
            onClick={handleNext}
            disabled={
              (step === "basic" && !canAdvanceFromBasic)
              || (step === "stats" && !canAdvanceFromStats)
              || (step === "skills" && !canAdvanceFromSkills)
            }
            className="flex items-center gap-2 bg-[var(--ink-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-5 py-3 font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--ink-color)] disabled:opacity-40"
          >
            下一步 <CaretRight weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CharacterCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>}>
      <CharacterCreateContent />
    </Suspense>
  );
}
