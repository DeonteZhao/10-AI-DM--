"use client";

import { useState } from "react";
import { BookOpenText, DiceFive, MapPin, PaperPlaneRight, X } from "@phosphor-icons/react";
import { CharacterPanel } from "@/components/CharacterPanel";
import type { CocCheckRequest, CocCheckResult, CocInvestigatorRecord } from "@/lib/domain/coc";

type PreviewMessage = {
  id: string;
  sender: "player" | "dm";
  content: string;
  type: "dialog" | "narrative" | "system" | "roll";
  rollResult?: CocCheckResult;
  requiredCheck?: CocCheckRequest;
};

const previewCharacter: CocInvestigatorRecord = {
  id: "preview_arthur_conan",
  rule_system: "coc",
  created_at: new Date().toISOString(),
  profile: {
    name: "亚瑟·柯南",
    occupation: "私家侦探",
    age: 34,
    residence: "伦敦",
    avatar: "🕵️",
  },
  characteristics: {
    str: 60,
    con: 50,
    siz: 65,
    dex: 70,
    app: 55,
    int: 80,
    pow: 65,
    edu: 75,
    luck: 48,
  },
  skills: {
    潜行: 40,
    侦查: 75,
    图书馆使用: 70,
    聆听: 62,
    话术: 55,
    手枪: 68,
    心理学: 58,
  },
  inventory: [
    {
      id: "revolver_38",
      item_ref_id: "revolver_38",
      name: ".38左轮手枪",
      description: "陪伴多年的防身武器，枪柄边缘有轻微磨损。",
      category: "weapon",
      quantity: 1,
      is_equipped: true,
    },
    {
      id: "notebook",
      item_ref_id: "base_notebook",
      name: "破旧的日记本",
      description: "封皮起翘，内页夹着几张被潮气浸过的旧便条。",
      category: "document",
      quantity: 1,
      is_equipped: false,
    },
    {
      id: "lighter",
      item_ref_id: "lighter",
      name: "煤油打火机",
      description: "能点亮短暂火光，也能让紧张时的手稍微不那么发抖。",
      category: "tool",
      quantity: 1,
      is_equipped: false,
    },
    {
      id: "ammo",
      item_ref_id: "ammo_38",
      name: "子弹",
      description: "黄铜弹壳在昏暗中泛着暗哑金属光。",
      category: "misc",
      quantity: 12,
      is_equipped: false,
    },
  ],
  status: {
    hp: { current: 6, maximum: 10 },
    mp: { current: 9, maximum: 13 },
    san: { current: 55, maximum: 65 },
    conditions: ["右腿擦伤", "神经紧绷"],
    flags: {},
  },
};

const previewMessages: PreviewMessage[] = [
  {
    id: "m1",
    sender: "dm",
    type: "narrative",
    content:
      "你推开了古宅沉重的大门。空气中弥漫着发霉的纸张和某种难以名状的腐败气味。大厅中央的枝形吊灯已经坠落，碎玻璃散落一地。通向二楼的楼梯在黑暗中若隐若现。\n\n突然，你听到楼上主卧的方向传来了一阵有节奏的“叩、叩、叩”的敲击声。",
  },
  {
    id: "m2",
    sender: "player",
    type: "dialog",
    content: "我拔出腰间的左轮手枪，深吸一口气，尽量放轻脚步，慢慢向楼梯上走去。我想看看是谁在敲击。",
  },
  {
    id: "m3",
    sender: "dm",
    type: "dialog",
    content: "楼梯的木板因为年久失修而变得非常脆弱。如果你想悄无声息地上楼，你需要进行一次潜行检定。",
    requiredCheck: {
      check_id: "stealth_preview",
      action: "stealth",
      kind: "skill",
      key: "潜行",
      name: "潜行",
      difficulty: "regular",
      target_override: 40,
      reason: "避免惊动楼上的未知存在",
    },
  },
  {
    id: "m4",
    sender: "dm",
    type: "roll",
    content: "SYSTEM: 亚瑟·柯南 执行了 [潜行] 检定 (1d100) 🎲 85 / 40 -> 失败",
    rollResult: {
      check_id: "stealth_preview",
      action: "stealth",
      kind: "skill",
      key: "潜行",
      name: "潜行",
      target: 40,
      required_threshold: 40,
      difficulty: "regular",
      passed: false,
      level: "failure",
      roll: { expression: "1d100", value: 85, details: [85] },
      narrative: "木板突然发出断裂声。",
    },
  },
  {
    id: "m5",
    sender: "dm",
    type: "system",
    content: "系统记录：古宅内的某个存在已经注意到你的动静",
  },
  {
    id: "m6",
    sender: "dm",
    type: "narrative",
    content:
      "你刚踏上第三级台阶，“咔嚓”一声巨响，木板在你脚下断裂了。你的腿陷了进去，灰尘四起。\n\n楼上的敲击声戛然而止。死一般的寂静笼罩了整座古宅。接着，你听到了某种沉重的东西在木地板上拖行的声音，正朝着楼梯口靠近……",
  },
];

const previewLocations = [
  { id: "hall", name: "玄关大厅" },
  { id: "staircase", name: "破损楼梯" },
  { id: "study", name: "书房" },
];

const previewScenes = [
  { id: "scene_entry", title: "踏入古宅", status: "completed" as const },
  { id: "scene_staircase", title: "楼梯异响", status: "active" as const },
  { id: "scene_bedroom", title: "主卧异象", status: "active" as const },
];

const CHECK_LEVEL_LABELS: Record<CocCheckResult["level"], string> = {
  critical: "大成功",
  extreme: "极难成功",
  hard: "困难成功",
  regular: "常规成功",
  failure: "失败",
  fumble: "大失败",
};

function PreviewChatPanel() {
  return (
    <div className="flex h-full flex-col bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="flex h-[74px] items-center gap-3 border-b-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.22)] px-6">
        <BookOpenText className="h-7 w-7 text-[var(--ink-color)]" weight="fill" />
        <div>
          <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Conversation Archive</div>
          <div className="text-lg font-black uppercase tracking-[0.22em]">调查日志 / Keeper Transcript</div>
        </div>
        <span className="ml-auto border border-[var(--ink-color)] bg-theme-bg px-3 py-1 font-vt323 text-sm uppercase tracking-[0.2em]">
          Preview
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin">
        <div className="space-y-10">
          {previewMessages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[88%] ${
                message.type === "system"
                  ? "mx-auto w-full max-w-full text-center"
                  : message.sender === "player"
                    ? "ml-auto border-r-[3px] border-[var(--accent-color)] pr-5 text-right"
                    : "border-l-[3px] border-[var(--ink-color)] pl-5"
              }`}
            >
              {message.type !== "system" && (
                <div
                  className={`mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] ${
                    message.sender === "player" ? "justify-end text-[var(--accent-color)]" : "text-[var(--ink-color)]"
                  }`}
                >
                  {message.type === "roll" ? <DiceFive className="h-4 w-4" weight="fill" /> : <span className="font-vt323 text-base">{"///"}</span>}
                  <span>{message.type === "roll" ? "ROLL LOG" : message.sender === "player" ? "调查员记录" : "Keeper"}</span>
                </div>
              )}
              <div
                className={`${
                  message.type === "system"
                    ? "inline-block border-y border-dashed border-[var(--ink-color)] px-5 py-2 font-vt323 text-lg uppercase tracking-[0.18em]"
                    : message.type === "roll"
                      ? "riso-panel-soft max-w-full px-4 py-4"
                      : "max-w-full"
                }`}
              >
                {message.type === "roll" && message.rollResult && (
                  <div className="mb-3 inline-flex items-center gap-2 border border-[var(--ink-color)] bg-theme-bg px-3 py-1.5 font-vt323 text-base tracking-[0.18em]">
                    <DiceFive className="h-5 w-5 text-[var(--ink-color)]" weight="fill" />
                    <span className={message.rollResult.passed ? "text-[var(--success-color)]" : "text-[var(--accent-color)]"}>
                      {message.rollResult.roll.value} / {message.rollResult.target} · {CHECK_LEVEL_LABELS[message.rollResult.level]}
                    </span>
                  </div>
                )}
                <p
                  className={`whitespace-pre-wrap leading-8 ${
                    message.type === "system"
                      ? `${message.content.includes("注意") ? "text-[var(--accent-color)]" : "text-[var(--success-color)]"}`
                      : message.sender === "player"
                        ? "text-lg italic tracking-[0.02em]"
                        : "text-lg tracking-[0.01em]"
                  }`}
                >
                  {message.content}
                </p>
                {message.requiredCheck && (
                  <div className="mt-5 border border-[var(--ink-color)] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(31,32,65,0.05)_10px,rgba(31,32,65,0.05)_11px)] p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent-color)]">
                      <span className="font-vt323 text-lg">►</span>
                      ACTION REQUIRED
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-base font-bold tracking-[0.08em]">{message.requiredCheck.name} 检定</div>
                        <div className="mt-1 font-vt323 text-[15px] uppercase tracking-[0.2em] opacity-70">
                          Target {message.requiredCheck.target_override}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 border border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-2 font-vt323 text-base uppercase tracking-[0.2em] text-[var(--paper-light)] transition hover:bg-[var(--accent-color)]"
                      >
                        <DiceFive className="h-5 w-5" weight="fill" />
                        Roll D100
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="border-t-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.22)] px-6 py-5">
        <div className="riso-panel relative flex items-end gap-3 p-3 shadow-[5px_5px_0_rgba(31,32,65,0.8)]">
          <textarea
            defaultValue=""
            placeholder="你打算怎么做？……"
            className="min-h-[70px] max-h-40 flex-1 resize-none border-none border-b-2 border-[var(--ink-color)] bg-transparent px-2 py-3 text-lg leading-8 tracking-[0.02em] text-[var(--ink-color)] placeholder:text-[var(--ink-color)] placeholder:opacity-40 focus:ring-0"
            rows={1}
          />
          <button
            type="button"
            className="inline-flex h-12 shrink-0 items-center gap-2 border border-[var(--ink-color)] bg-transparent px-4 font-vt323 text-base uppercase tracking-[0.2em] text-[var(--ink-color)] transition hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
          >
            <PaperPlaneRight className="h-5 w-5" weight="fill" />
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewMapPanel() {
  return (
    <aside className="flex h-full flex-col bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="border-b-2 border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-4 text-[var(--paper-light)]">
        <div className="text-center text-[11px] font-vt323 uppercase tracking-[0.35em]">ATTACHMENT E</div>
        <div className="mt-1 text-center text-lg font-black uppercase tracking-[0.24em]">Field Map & Scene Notes</div>
      </div>
      <div className="space-y-5 overflow-y-auto px-4 py-5">
        <section className="riso-panel riso-corners relative overflow-hidden p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-[var(--ink-color)] bg-theme-bg">
              <MapPin className="h-5 w-5" weight="fill" />
            </span>
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Current Location</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">场景锚点</div>
            </div>
          </div>
          <div className="mt-4 border-t border-dashed border-[var(--ink-color)] pt-4">
            <div className="text-2xl font-black tracking-[0.1em]">破损楼梯</div>
            <p className="mt-3 text-sm leading-7 opacity-80">拖行的声响正在楼上传来，楼梯和主卧之间的每一步都变得危险。</p>
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-3">
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Visible Places</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">可见地点</div>
            </div>
            <span className="font-vt323 text-sm uppercase tracking-[0.18em]">{previewLocations.length} entries</span>
          </div>
          <div className="space-y-3">
            {previewLocations.map((location) => (
              <button
                key={location.id}
                type="button"
                className={`w-full border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                  location.id === "staircase"
                    ? "border-[var(--accent-color)] bg-[rgba(158,50,35,0.08)] text-[var(--accent-color)]"
                    : "border-[var(--ink-color)] bg-[rgba(255,255,255,0.14)] text-[var(--ink-color)] hover:bg-theme-bg"
                }`}
              >
                <div className="font-black uppercase tracking-[0.15em]">{location.name}</div>
                <div className="mt-1 font-vt323 text-[12px] uppercase tracking-[0.24em] opacity-65">
                  {location.id === "staircase" ? "CURRENT POSITION" : "TRAVEL / OPEN"}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-3">
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Scene Progress</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">场景推进</div>
            </div>
            <span className="font-vt323 text-sm uppercase tracking-[0.18em]">{previewScenes.length} scenes</span>
          </div>
          <div className="space-y-3">
            {previewScenes.map((scene) => (
              <div key={scene.id} className="riso-panel-soft px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-bold tracking-[0.12em]">{scene.title}</div>
                  <span
                    className={`border px-2 py-0.5 font-vt323 text-sm uppercase tracking-[0.16em] ${
                      scene.status === "completed"
                        ? "border-[var(--success-color)] text-[var(--success-color)]"
                        : "border-[var(--accent-color)] text-[var(--accent-color)]"
                    }`}
                  >
                    {scene.status === "completed" ? "Closed" : "Active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-[var(--ink-color)] bg-theme-bg">
              <BookOpenText className="h-5 w-5" weight="fill" />
            </span>
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Preview Notes</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">预览说明</div>
            </div>
          </div>
          <p className="border-t border-dashed border-[var(--ink-color)] pt-3 text-sm leading-7 opacity-80">
            这是一个本地静态预览页，不依赖准入验证、案件参数或调查员参数，只用于校验三栏游戏界面的实际视觉效果。
          </p>
        </section>
      </div>
    </aside>
  );
}

export default function RisographGamePreviewPage() {
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);

  return (
    <div className="riso-page h-[calc(100vh-64px)] overflow-x-auto px-4 py-4">
      <div className="grid h-full min-w-[1200px] grid-cols-[320px_minmax(0,1fr)_340px] overflow-hidden border-x-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.08)] shadow-[0_0_0_1px_rgba(31,32,65,0.15)]">
        <div className="overflow-hidden border-r-2 border-[var(--ink-color)]">
          <CharacterPanel
            character={previewCharacter}
            onOpenNotebook={() => setIsNotebookOpen(true)}
            notebookCount={3}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="border-b-2 border-[var(--ink-color)] bg-[var(--paper-light)] px-6 py-5 text-[var(--ink-color)]">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">FILE COCPREVI // COC</div>
                <div className="mt-2 text-[2rem] font-black uppercase leading-none tracking-[0.08em]">幽灵古宅 // 调查日志</div>
                <div className="mt-3 max-w-3xl border-t border-dashed border-[var(--ink-color)] pt-3 text-sm leading-7 opacity-80">
                  本页用于本地直接查看 risograph 三栏游戏界面的实际呈现效果，不受准入验证和业务参数影响。
                </div>
              </div>
              <div className="shrink-0 border border-[var(--ink-color)] px-4 py-2 text-right">
                <div className="text-[10px] font-vt323 uppercase tracking-[0.32em]">调查日志</div>
                <div className="mt-1 font-vt323 text-base uppercase tracking-[0.18em]">REC. 1924-10-31</div>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <PreviewChatPanel />
          </div>
        </div>
        <div className="overflow-hidden border-l-2 border-[var(--ink-color)]">
          <PreviewMapPanel />
        </div>
      </div>

      {isNotebookOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,17,37,0.35)] px-6">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden border-2 border-[var(--ink-color)] bg-[var(--paper-light)] shadow-[8px_8px_0_rgba(31,32,65,0.85)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.2)] px-6 py-4">
              <div>
                <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Field Notebook</div>
                <div className="mt-1 text-2xl font-black uppercase tracking-[0.14em]">调查笔记本</div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotebookOpen(false)}
                className="border border-[var(--ink-color)] bg-theme-bg p-2 transition hover:-translate-y-0.5"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>
            <div className="max-h-[calc(80vh-88px)] space-y-4 overflow-y-auto p-6">
              {[
                "大厅中央的枝形吊灯已经坠落。",
                "楼上传来有节奏的敲击声。",
                "潜行检定失败后，楼上的存在已经注意到动静。",
              ].map((entry, index) => (
                <div key={entry} className="riso-panel-soft px-4 py-4">
                  <div className="text-[10px] font-vt323 uppercase tracking-[0.32em] opacity-60">记录 {index + 1}</div>
                  <div className="mt-2 whitespace-pre-wrap text-base leading-8">{entry}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
