"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, Brain, CircleNotch, DiceFive, MapPin, PaperPlaneRight, X } from "@phosphor-icons/react";
import { useBetaAccess } from "@/components/BetaAccessGate";
import { CharacterPanel } from "@/components/CharacterPanel";
import {
  COC_BASELINE_MODULE_ID,
  type CocCheckRequest,
  type CocCheckResult,
  type CocInvestigatorRecord,
  type CocScenario,
} from "@/lib/domain/coc";

type UiMessage = {
  id: string;
  sender: "player" | "dm";
  content: string;
  type: "dialog" | "narrative" | "system" | "roll";
  rollResult?: CocCheckResult;
  requiredCheck?: CocCheckRequest;
  choices?: string[];
};

type PendingReply = {
  content: string;
  status: "loading" | "streaming";
};

type NotebookEntry = {
  id: string;
  messageId: string;
  text: string;
  start: number;
  end: number;
};

type ContextMenuState =
  | {
      x: number;
      y: number;
      action: "add";
      messageId: string;
      text: string;
      start: number;
      end: number;
    }
  | {
      x: number;
      y: number;
      action: "remove";
      noteId: string;
    };

type PlayerScenarioView = Pick<CocScenario, "module_id" | "rule_system" | "title" | "background" | "themes"> & {
  opening_options?: string[];
};

type SceneProgress = {
  id: string;
  title: string;
  status: "active" | "completed";
};

type VisibleLocation = {
  id: string;
  name: string;
};

class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
  }
}

const CHECK_LEVEL_LABELS: Record<CocCheckResult["level"], string> = {
  critical: "大成功",
  extreme: "极难成功",
  hard: "困难成功",
  regular: "常规成功",
  failure: "失败",
  fumble: "大失败",
};

async function readApiError(response: Response, fallbackMessage: string) {
  const text = await response.text();
  let message = text.trim() || fallbackMessage;
  let code: string | undefined;
  try {
    const parsed = JSON.parse(text) as {
      detail?: unknown;
      message?: unknown;
      code?: unknown;
    };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      message = parsed.detail;
    } else if (
      parsed.detail
      && typeof parsed.detail === "object"
      && "message" in parsed.detail
      && typeof parsed.detail.message === "string"
      && parsed.detail.message.trim()
    ) {
      message = parsed.detail.message;
    } else if (typeof parsed.message === "string" && parsed.message.trim()) {
      message = parsed.message;
    }
    if (typeof parsed.code === "string" && parsed.code.trim()) {
      code = parsed.code;
    }
  } catch {
  }
  return new ApiError(message, { status: response.status, code });
}

async function ensureApiOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }
  throw await readApiError(response, fallbackMessage);
}

function getFriendlyErrorMessage(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
  const status = error instanceof ApiError ? error.status : undefined;
  const code = error instanceof ApiError ? error.code : undefined;
  const lowerMessage = message.toLowerCase();

  if (
    code === "BETA_ACCESS_REQUIRED"
    || status === 401
    || message.includes("未通过内测准入验证")
    || lowerMessage.includes("unauthorized")
  ) {
    return "当前准入状态已失效，请刷新页面并重新完成验证后再继续。";
  }

  if (code === "SESSION_NOT_FOUND" || message.includes("Session not found")) {
    return "当前调查会话不存在或已失效，请返回案件列表重新进入。";
  }

  if (
    code === "INVESTIGATOR_NOT_FOUND"
    || message.includes("Investigator not found")
    || message.includes("Character not found")
  ) {
    return "当前调查员档案不存在或无权访问，请返回名录重新选择。";
  }

  if (code === "MODULE_NOT_FOUND" || message.includes("Scenario not found")) {
    return "当前案件档案不存在或尚未开放，请返回案件列表重新选择。";
  }

  if (
    code === "UPSTREAM_UNREACHABLE"
    || lowerMessage.includes("failed to fetch")
    || lowerMessage.includes("fetch failed")
    || message.includes("暂时不可达")
  ) {
    return "后端服务暂时不可达，请稍后重试；若持续出现，请确认后端服务已启动。";
  }

  if (
    status === 500
    || (typeof status === "number" && status > 500)
    || code === "UPSTREAM_ERROR"
    || code === "GM_ACTION_FAILED"
    || lowerMessage.includes("internal server error")
  ) {
    return "KP 当前暂时无法回应，请稍后重试；若持续出现，请联系管理员检查服务日志。";
  }

  if (status === 404 || code === "RESOURCE_NOT_FOUND") {
    return "你访问的调查资源不存在，可能已失效或无权访问。";
  }

  return message || fallbackMessage;
}

function getScenarioReference(scenario: PlayerScenarioView) {
  const fileCode = scenario.module_id ? scenario.module_id.slice(0, 8).toUpperCase() : "UNKNOWN";
  const ruleLabel = scenario.rule_system ? scenario.rule_system.toUpperCase() : "SYSTEM";
  return `FILE ${fileCode} // ${ruleLabel}`;
}

function getNarrativeDate() {
  return "REC. 1924-10-31";
}

function sanitizeScenarioBackground(value: string) {
  const marker = "请向玩家朗读或转述以下文字：";
  if (!value) {
    return "";
  }
  if (value.includes(marker)) {
    return value.split(marker)[1]?.trim() || "";
  }
  return value.trim();
}

function buildDmMessage(result: Record<string, unknown>) {
  return {
    id: `dm_${Date.now()}`,
    sender: "dm" as const,
    content: typeof result.narration === "string" ? result.narration : "KP 暂时沉默了下来。",
    type: "narrative" as const,
    requiredCheck: result.required_check as CocCheckRequest | undefined,
    choices: Array.isArray(result.choices)
      ? result.choices.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
  };
}

function buildRewardMessages(result: Record<string, unknown>) {
  const rewards: UiMessage[] = [];
  if (Array.isArray(result.revealed_clues)) {
    result.revealed_clues.forEach((clue) => {
      if (!clue || typeof clue !== "object" || !("id" in clue) || !("title" in clue)) {
        return;
      }
      rewards.push({
        id: `clue_${String(clue.id)}_${Date.now()}`,
        sender: "dm",
        content: `你获得线索【${String(clue.title)}】`,
        type: "system",
      });
    });
  }
  if (Array.isArray(result.granted_handouts)) {
    result.granted_handouts.forEach((handout) => {
      if (!handout || typeof handout !== "object" || !("id" in handout) || !("title" in handout)) {
        return;
      }
      rewards.push({
        id: `handout_${String(handout.id)}_${Date.now()}`,
        sender: "dm",
        content: `你获得资料【${String(handout.title)}】`,
        type: "system",
      });
    });
  }
  return rewards;
}

function getTextOffset(container: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function getSelectionInContainer(container: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }
  const text = selection.toString().trim();
  if (!text) {
    return null;
  }
  const start = getTextOffset(container, range.startContainer, range.startOffset);
  const end = getTextOffset(container, range.endContainer, range.endOffset);
  if (start === end) {
    return null;
  }
  return {
    text,
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function renderMessageWithNotes(content: string, notes: NotebookEntry[]) {
  if (!notes.length) {
    return content;
  }
  const sortedNotes = [...notes].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sortedNotes.forEach((note) => {
    if (note.start > cursor) {
      parts.push(<span key={`plain_${cursor}`}>{content.slice(cursor, note.start)}</span>);
    }
    parts.push(
      <span
        key={note.id}
        data-note-id={note.id}
        className="bg-[var(--accent-color)] text-[var(--bg-color)] px-1 rounded-[2px] shadow-[0_0_0_2px_var(--ink-color)] underline decoration-[var(--bg-color)] decoration-[3px] underline-offset-4 cursor-pointer font-bold"
      >
        {content.slice(note.start, note.end)}
      </span>,
    );
    cursor = note.end;
  });
  if (cursor < content.length) {
    parts.push(<span key={`plain_tail_${cursor}`}>{content.slice(cursor)}</span>);
  }
  return parts;
}

function getMessageLabel(message: UiMessage) {
  if (message.type === "system") {
    return "SYSTEM";
  }
  if (message.type === "roll") {
    return "ROLL LOG";
  }
  return message.sender === "player" ? "调查员记录" : "Keeper";
}

function InvestigatorPanelFallback({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}) {
  return (
    <aside className="flex h-full flex-col bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="border-b-2 border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-4 text-[var(--paper-light)]">
        <div className="text-center text-[11px] font-vt323 uppercase tracking-[0.35em]">ATTACHMENT A</div>
        <div className="mt-1 text-center text-lg font-black uppercase tracking-[0.28em]">Investigator Dossier</div>
      </div>
      <div className="space-y-5 px-4 py-5">
        <section className="riso-panel riso-corners relative overflow-hidden p-4">
          <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Case Personnel Record</div>
          <h2 className="mt-2 text-[1.65rem] font-black uppercase leading-none tracking-[0.08em]">{title}</h2>
          <div className="mt-3 border-t border-dashed border-[var(--ink-color)] pt-3 text-sm uppercase tracking-[0.18em] font-bold">
            {subtitle}
          </div>
          <p className="mt-4 border-t border-dashed border-[var(--ink-color)] pt-4 text-sm leading-7 opacity-80">
            {body}
          </p>
        </section>
        <section className="riso-panel p-4">
          <div className="mb-3 text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Vitals</div>
          <div className="space-y-4">
            {["HP", "MP", "SAN"].map((label) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.24em]">
                  <span>{label}</span>
                  <span className="font-vt323 text-lg tracking-[0.18em]">-- / --</span>
                </div>
                <div className="relative h-3 overflow-hidden border-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.35)]">
                  <div className="h-full w-1/3 border-r border-[var(--ink-color)] bg-[rgba(31,32,65,0.16)]" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function MapPanelFallback({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <aside className="flex h-full flex-col bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="border-b-2 border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-4 text-[var(--paper-light)]">
        <div className="text-center text-[11px] font-vt323 uppercase tracking-[0.35em]">ATTACHMENT E</div>
        <div className="mt-1 text-center text-lg font-black uppercase tracking-[0.24em]">Field Map & Scene Notes</div>
      </div>
      <div className="space-y-5 px-4 py-5">
        <section className="riso-panel riso-corners relative overflow-hidden p-4">
          <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Status</div>
          <div className="mt-2 text-base font-black uppercase tracking-[0.18em]">{title}</div>
          <p className="mt-4 border-t border-dashed border-[var(--ink-color)] pt-4 text-sm leading-7 opacity-80">{body}</p>
        </section>
        <section className="riso-panel p-4">
          <div className="mb-3 text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Visible Places</div>
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="border border-[var(--ink-color)] bg-[rgba(255,255,255,0.14)] px-4 py-3">
                <div className="h-4 w-3/4 bg-[rgba(31,32,65,0.12)]" />
                <div className="mt-2 h-3 w-1/2 bg-[rgba(31,32,65,0.08)]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function GameStatusShell({
  title,
  subtitle,
  body,
  actions,
}: {
  title: string;
  subtitle: string;
  body: string;
  actions?: Array<{ label: string; onClick: () => void }>;
}) {
  return (
    <div className="riso-page h-[calc(100vh-64px)] overflow-x-auto px-4 py-4">
      <div className="grid h-full min-w-[1200px] grid-cols-[320px_minmax(0,1fr)_340px] overflow-hidden border-x-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.08)] shadow-[0_0_0_1px_rgba(31,32,65,0.15)]">
        <div className="overflow-hidden border-r-2 border-[var(--ink-color)]">
          <InvestigatorPanelFallback title="待接案调查员" subtitle="档案待补全" body="先完成案件与调查员的匹配，调查员档案将以附卷形式装订在此处。" />
        </div>
        <div className="flex min-w-0 flex-col bg-[var(--paper-light)] text-[var(--ink-color)]">
          <div className="border-b-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.22)] px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">FILE PENDING // COC</div>
                <div className="mt-2 text-[2rem] font-black uppercase leading-none tracking-[0.08em]">{title}</div>
                <div className="mt-3 max-w-3xl border-t border-dashed border-[var(--ink-color)] pt-3 text-sm leading-7 opacity-80">
                  {subtitle}
                </div>
              </div>
              <div className="shrink-0 border border-[var(--ink-color)] px-4 py-2 text-right">
                <div className="text-[10px] font-vt323 uppercase tracking-[0.32em]">调查日志</div>
                <div className="mt-1 font-vt323 text-base uppercase tracking-[0.18em]">{getNarrativeDate()}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center px-8 py-10">
            <section className="riso-panel riso-corners relative w-full max-w-3xl overflow-hidden p-6">
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">System Notice</div>
              <div className="mt-2 text-3xl font-black uppercase leading-tight tracking-[0.1em]">{title}</div>
              <p className="mt-5 border-t border-dashed border-[var(--ink-color)] pt-5 text-base leading-8 opacity-85">{body}</p>
              {actions && actions.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3 border-t border-dashed border-[var(--ink-color)] pt-5">
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="border border-[var(--ink-color)] bg-transparent px-4 py-2 font-vt323 text-base uppercase tracking-[0.18em] transition hover:-translate-y-0.5 hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
        <div className="overflow-hidden border-l-2 border-[var(--ink-color)]">
          <MapPanelFallback title="等待现场建立" body="待案件初始化完成后，这里会继续显示地点、线索节点与场景推进记录。" />
        </div>
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  pendingReply,
  notes,
  onSend,
  onRoll,
  onMessageContextMenu,
  disabled,
}: {
  messages: UiMessage[];
  pendingReply: PendingReply | null;
  notes: NotebookEntry[];
  onSend: (msg: string, checkResult?: CocCheckResult) => Promise<void>;
  onRoll: (check: CocCheckRequest) => Promise<void>;
  onMessageContextMenu: (event: React.MouseEvent<HTMLElement>, messageId: string) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || disabled) {
      return;
    }
    const nextInput = input.trim();
    setInput("");
    await onSend(nextInput);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--paper-light)] font-huiwen text-[var(--ink-color)]">
      <div className="flex h-[74px] items-center gap-3 border-b-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.22)] px-6">
        <Brain className="h-7 w-7 text-[var(--ink-color)]" weight="fill" />
        <div>
          <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Conversation Archive</div>
          <div className="text-lg font-black uppercase tracking-[0.22em]">调查日志 / Keeper Transcript</div>
        </div>
        <span className="ml-auto border border-[var(--ink-color)] bg-theme-bg px-3 py-1 font-vt323 text-sm uppercase tracking-[0.2em]">
          AI KP
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-thin">
        <div className="space-y-10">
        {messages.map((message) => (
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
                <span>{getMessageLabel(message)}</span>
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
                data-message-id={message.id}
                onContextMenu={(event) => onMessageContextMenu(event, message.id)}
                className={`whitespace-pre-wrap leading-8 ${
                  message.type === "system"
                    ? `${message.content.includes("失败") ? "text-[var(--accent-color)]" : "text-[var(--success-color)]"}`
                    : message.sender === "player"
                      ? "text-lg italic tracking-[0.02em]"
                      : "text-lg tracking-[0.01em]"
                }`}
              >
                {renderMessageWithNotes(
                  message.content,
                  notes.filter((item) => item.messageId === message.id),
                )}
              </p>
              {message.choices && message.choices.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-dashed border-[var(--ink-color)] pt-4">
                  {message.choices.map((choice) => (
                    <button
                      key={`${message.id}_${choice}`}
                      type="button"
                      onClick={() => onSend(choice)}
                      disabled={disabled}
                      className="border border-[var(--ink-color)] bg-[rgba(255,255,255,0.16)] px-3 py-2 text-sm font-bold tracking-[0.12em] transition hover:-translate-y-0.5 hover:bg-theme-bg disabled:opacity-60"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              {message.requiredCheck && message.sender === "dm" && (
                <div className="mt-5 border border-[var(--ink-color)] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(31,32,65,0.05)_10px,rgba(31,32,65,0.05)_11px)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--accent-color)]">
                    <span className="font-vt323 text-lg">►</span>
                    ACTION REQUIRED
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-base font-bold tracking-[0.08em]">{message.requiredCheck.name} 检定</div>
                      <div className="mt-1 font-vt323 text-[15px] uppercase tracking-[0.2em] opacity-70">
                        {message.requiredCheck.target_override
                          ? `Target ${message.requiredCheck.target_override}`
                          : `${message.requiredCheck.kind.toUpperCase()} CHECK`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRoll(message.requiredCheck!)}
                      disabled={disabled}
                      className="inline-flex items-center justify-center gap-2 border border-[var(--ink-color)] bg-[var(--ink-color)] px-4 py-2 font-vt323 text-base uppercase tracking-[0.2em] text-[var(--paper-light)] transition hover:bg-[var(--accent-color)] disabled:opacity-60"
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
        {pendingReply && (
          <article className="max-w-[88%] border-l-[3px] border-[var(--ink-color)] pl-5">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em]">
              <span className="font-vt323 text-base">{"///"}</span>
              <span>Keeper</span>
            </div>
            <div className="riso-panel-soft px-4 py-4">
              {pendingReply.status === "loading" ? (
                <div className="flex items-center gap-3 text-lg">
                  <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                  <span>KP 正在思考…</span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-lg leading-8 tracking-[0.01em]">{pendingReply.content}</p>
              )}
            </div>
          </article>
        )}
        <div ref={chatEndRef} />
        </div>
      </div>

      <div className="border-t-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.22)] px-6 py-5">
        <div className="riso-panel relative flex items-end gap-3 p-3 shadow-[5px_5px_0_rgba(31,32,65,0.8)]">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="你打算怎么做？……"
            className="min-h-[70px] max-h-40 flex-1 resize-none border-none border-b-2 border-[var(--ink-color)] bg-transparent px-2 py-3 text-lg leading-8 tracking-[0.02em] text-[var(--ink-color)] placeholder:text-[var(--ink-color)] placeholder:opacity-40 focus:ring-0"
            rows={1}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || disabled}
            className="inline-flex h-12 shrink-0 items-center gap-2 border border-[var(--ink-color)] bg-transparent px-4 font-vt323 text-base uppercase tracking-[0.2em] text-[var(--ink-color)] transition hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)] disabled:opacity-50"
          >
            <PaperPlaneRight className="h-5 w-5" weight="fill" />
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

function MapPanel({
  locations,
  currentLocationId,
  scenes,
  onTravel,
}: {
  locations: VisibleLocation[];
  currentLocationId: string | null;
  scenes: SceneProgress[];
  onTravel: (locationId: string) => Promise<void>;
}) {
  const currentLocation = useMemo(
    () => locations.find((item) => item.id === currentLocationId) || null,
    [currentLocationId, locations],
  );

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
            <div className="text-2xl font-black tracking-[0.1em]">{currentLocation?.name || "未知地点"}</div>
            <p className="mt-3 text-sm leading-7 opacity-80">地点细节由 KP 在叙事中逐步呈现，当前位置会随着行动推进同步更新。</p>
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-3">
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Visible Places</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">可见地点</div>
            </div>
            <span className="font-vt323 text-sm uppercase tracking-[0.18em]">{locations.length} entries</span>
          </div>
          <div className="space-y-3">
            {locations.length > 0 ? locations.map((location) => (
              <button
                key={location.id || location.name}
                type="button"
                onClick={() => location.id && onTravel(location.id)}
                className={`w-full border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                  location.id === currentLocationId
                    ? "border-[var(--accent-color)] bg-[rgba(158,50,35,0.08)] text-[var(--accent-color)]"
                    : "border-[var(--ink-color)] bg-[rgba(255,255,255,0.14)] text-[var(--ink-color)] hover:bg-theme-bg"
                }`}
              >
                <div className="font-black uppercase tracking-[0.15em]">{location.name}</div>
                <div className="mt-1 font-vt323 text-[12px] uppercase tracking-[0.24em] opacity-65">
                  {location.id === currentLocationId ? "CURRENT POSITION" : "TRAVEL / OPEN"}
                </div>
              </button>
            )) : (
              <div className="py-4 text-center text-sm font-bold tracking-[0.18em] opacity-55">尚未显露其他地点</div>
            )}
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashed border-[var(--ink-color)] pb-3">
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Scene Progress</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">场景推进</div>
            </div>
            <span className="font-vt323 text-sm uppercase tracking-[0.18em]">{scenes.length} scenes</span>
          </div>
          <div className="space-y-3">
            {scenes.length > 0 ? scenes.map((scene) => (
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
            )) : (
              <div className="py-4 text-center text-sm font-bold tracking-[0.18em] opacity-55">等待首个场景推进</div>
            )}
          </div>
        </section>

        <section className="riso-panel p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-[var(--ink-color)] bg-theme-bg">
              <BookOpenText className="h-5 w-5" weight="fill" />
            </span>
            <div>
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">Field Notes</div>
              <div className="text-base font-black uppercase tracking-[0.18em]">操作提示</div>
            </div>
          </div>
          <p className="border-t border-dashed border-[var(--ink-color)] pt-3 text-sm leading-7 opacity-80">
            在聊天记录中框选文本后右键，可将关键线索收入笔记本。已记录内容会以油印色标记保留。
          </p>
        </section>
      </div>
    </aside>
  );
}

function GameContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { isReady } = useBetaAccess();
  const adventureId = params.adventureId as string;
  const requestedModuleId = searchParams.get("module");
  const characterId = searchParams.get("character");

  const [scenario, setScenario] = useState<PlayerScenarioView | null>(null);
  const [character, setCharacter] = useState<CocInvestigatorRecord | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(adventureId !== "new" ? adventureId : null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [locations, setLocations] = useState<VisibleLocation[]>([]);
  const [scenes, setScenes] = useState<SceneProgress[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [pendingReply, setPendingReply] = useState<PendingReply | null>(null);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncSessionState = async (nextSessionId: string, preserveMessages = false) => {
    const res = await fetch(`/api/backend/sessions/${nextSessionId}/state`);
    await ensureApiOk(res, "读取调查状态失败");
    const json = await res.json();
    const nextScenario = (json.scenario as PlayerScenarioView) || null;
    if (!preserveMessages && Array.isArray(json.messages)) {
      const nextMessages = (json.messages as Array<{ role: "ai" | "player"; content: string }>).map((item, index) => ({
        id: `session_${nextSessionId}_${index}`,
        sender: item.role === "player" ? "player" : "dm",
        content: item.content,
        type: item.role === "player" ? "dialog" : "narrative",
      })) as UiMessage[];
      const pendingCheck = json.state?.flags?.pending_check as CocCheckRequest | undefined;
      const lastDmIndex = nextMessages.findLastIndex((item) => item.sender === "dm");
      if (
        nextScenario?.opening_options?.length &&
        lastDmIndex >= 0 &&
        !nextMessages.some((item) => item.sender === "player")
      ) {
        nextMessages[lastDmIndex] = {
          ...nextMessages[lastDmIndex],
          choices: nextScenario.opening_options,
        };
      }
      if (pendingCheck && lastDmIndex >= 0) {
        nextMessages[lastDmIndex] = {
          ...nextMessages[lastDmIndex],
          requiredCheck: pendingCheck,
        };
      }
      setMessages(nextMessages);
    }
    setScenario(nextScenario);
    setLocations(Array.isArray(json.locations) ? (json.locations as VisibleLocation[]) : []);
    setScenes(Array.isArray(json.scenes) ? (json.scenes as SceneProgress[]) : []);
    setCurrentLocationId((json.state?.current_location_id as string | null) || null);
  };

  const refreshInvestigator = async (nextSessionId: string) => {
    const res = await fetch(`/api/backend/sessions/${nextSessionId}`);
    await ensureApiOk(res, "读取调查员档案失败");
    const json = await res.json();
    setCharacter((json.investigator as CocInvestigatorRecord) || null);
  };

  const streamDmReply = async (content: string) => {
    if (!content.trim()) {
      return;
    }
    setPendingReply({ content: "", status: "streaming" });
    await new Promise<void>((resolve) => {
      let cursor = 0;
      const step = Math.max(1, Math.ceil(content.length / 90));
      const timer = window.setInterval(() => {
        cursor = Math.min(content.length, cursor + step);
        setPendingReply({ content: content.slice(0, cursor), status: "streaming" });
        if (cursor >= content.length) {
          window.clearInterval(timer);
          resolve();
        }
      }, 20);
    });
    setPendingReply(null);
  };

  useEffect(() => {
    setContextMenu(null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setNotebookEntries([]);
      return;
    }
    try {
      const saved = window.localStorage.getItem(`dice-tales-notes:${sessionId}`);
      setNotebookEntries(saved ? (JSON.parse(saved) as NotebookEntry[]) : []);
    } catch {
      setNotebookEntries([]);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    window.localStorage.setItem(`dice-tales-notes:${sessionId}`, JSON.stringify(notebookEntries));
  }, [notebookEntries, sessionId]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let disposed = false;

    const initialize = async () => {
      try {
        if (adventureId !== "new") {
          const sessionRes = await fetch(`/api/backend/sessions/${adventureId}`);
          await ensureApiOk(sessionRes, "读取调查会话失败");
          const sessionJson = await sessionRes.json();
          if (disposed) {
            return;
          }
          setCharacter((sessionJson.investigator as CocInvestigatorRecord) || null);
          setSessionId(adventureId);
          await syncSessionState(adventureId);
          return;
        }

        if (!characterId) {
          throw new Error("缺少调查员参数");
        }

        const targetModuleId = requestedModuleId || COC_BASELINE_MODULE_ID;
        const [charactersRes, scenarioRes] = await Promise.all([
          fetch("/api/backend/characters"),
          fetch(`/api/backend/modules/${targetModuleId}/structured`),
        ]);
        await ensureApiOk(charactersRes, "读取调查员列表失败");
        await ensureApiOk(scenarioRes, "读取案件档案失败");
        const charactersJson = await charactersRes.json();
        const scenarioJson = await scenarioRes.json();
        const nextCharacter = Array.isArray(charactersJson.characters)
          ? (charactersJson.characters as CocInvestigatorRecord[]).find((item) => item.id === characterId) || null
          : null;
        if (!nextCharacter) {
          throw new Error("调查员不存在");
        }
        if (disposed) {
          return;
        }
        setCharacter(nextCharacter);
        setScenario((scenarioJson.module as PlayerScenarioView) || null);

        const createSessionRes = await fetch("/api/backend/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_id: targetModuleId,
            investigator_id: characterId,
          }),
        });
        await ensureApiOk(createSessionRes, "创建调查会话失败");
        const createSessionJson = await createSessionRes.json();
        const nextSessionId = createSessionJson.session?.id as string | undefined;
        if (!nextSessionId) {
          throw new Error("会话创建成功，但未返回会话编号");
        }
        if (disposed) {
          return;
        }
        setSessionId(nextSessionId);
        await syncSessionState(nextSessionId);
      } catch (nextError) {
        if (!disposed) {
          setError(getFriendlyErrorMessage(nextError, "游戏初始化失败"));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    initialize();
    return () => {
      disposed = true;
    };
  }, [adventureId, characterId, isReady, requestedModuleId]);

  const handleSend = async (text: string, checkResult?: CocCheckResult) => {
    if (!sessionId || !text.trim() || (processing && !checkResult)) {
      return;
    }
    const optimisticMessage: UiMessage = {
      id: `local_${Date.now()}`,
      sender: "player",
      content: text,
      type: "dialog",
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setProcessing(true);
    setPendingReply({ content: "", status: "loading" });
    try {
      const res = await fetch("/api/backend/gm/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          check_result: checkResult,
        }),
      });
      await ensureApiOk(res, "向 KP 提交行动失败");
      const json = await res.json();
      const result = (json.result || {}) as Record<string, unknown>;
      const dmMessage = buildDmMessage(result);
      await streamDmReply(dmMessage.content);
      setMessages((prev) => {
        return [...prev, dmMessage, ...buildRewardMessages(result)];
      });
      const refreshResults = await Promise.allSettled([
        syncSessionState(sessionId, true),
        refreshInvestigator(sessionId),
      ]);
      const refreshErrors = refreshResults
        .filter((item): item is PromiseRejectedResult => item.status === "rejected")
        .map((item) => getFriendlyErrorMessage(item.reason, "卷宗刷新失败"));
      if (refreshErrors.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: `refresh_error_${Date.now()}`,
            sender: "dm",
            content: `KP 已给出回应，但调查卷宗刷新失败：${refreshErrors[0]}`,
            type: "system",
          },
        ]);
      }
    } catch (nextError) {
      setPendingReply(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          sender: "dm",
          content: `KP 暂时失联：${getFriendlyErrorMessage(nextError, "行动提交失败，请稍后重试。")}`,
          type: "system",
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleRoll = async (check: CocCheckRequest) => {
    if (!sessionId || processing) {
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/backend/sessions/${sessionId}/checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check }),
      });
      await ensureApiOk(res, "执行检定失败");
      const json = await res.json();
      const result = json.result as CocCheckResult;
      setMessages((prev) => [
        ...prev,
        {
          id: `roll_${Date.now()}`,
          sender: "dm",
          content: result.narrative || `你进行了 ${check.name} 检定。`,
          type: "roll",
          rollResult: result,
        },
      ]);
      await handleSend(`我完成了【${check.name}】检定。`, result);
    } catch (nextError) {
      setMessages((prev) => [
        ...prev,
        {
          id: `roll_error_${Date.now()}`,
          sender: "dm",
          content: `检定失败：${getFriendlyErrorMessage(nextError, "请稍后重试。")}`,
          type: "system",
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const handleTravel = async (locationId: string) => {
    const target = locations.find((item) => item.id === locationId);
    await handleSend(`我前往【${target?.name || locationId}】。`);
  };

  const handleMessageContextMenu = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    const target = event.target as HTMLElement;
    const highlighted = target.closest("[data-note-id]") as HTMLElement | null;
    if (highlighted?.dataset.noteId) {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        action: "remove",
        noteId: highlighted.dataset.noteId,
      });
      return;
    }
    const container = event.currentTarget as HTMLElement;
    const selection = getSelectionInContainer(container);
    if (!selection) {
      return;
    }
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      action: "add",
      messageId,
      text: selection.text,
      start: selection.start,
      end: selection.end,
    });
  };

  const addNotebookEntry = () => {
    if (!contextMenu || contextMenu.action !== "add") {
      return;
    }
    setNotebookEntries((prev) => {
      if (prev.some((item) => item.messageId === contextMenu.messageId && !(item.end <= contextMenu.start || item.start >= contextMenu.end))) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `note_${Date.now()}`,
          messageId: contextMenu.messageId,
          text: contextMenu.text,
          start: contextMenu.start,
          end: contextMenu.end,
        },
      ];
    });
    window.getSelection()?.removeAllRanges();
    setContextMenu(null);
  };

  const removeNotebookEntry = (noteId: string) => {
    setNotebookEntries((prev) => prev.filter((item) => item.id !== noteId));
    setContextMenu(null);
  };

  const jumpToNotebookEntry = (entry: NotebookEntry) => {
    setIsNotebookOpen(false);
    requestAnimationFrame(() => {
      const messageNode = document.querySelector(`[data-message-id="${entry.messageId}"]`);
      if (!(messageNode instanceof HTMLElement)) {
        return;
      }
      messageNode.scrollIntoView({ behavior: "smooth", block: "center" });
      const noteNode = messageNode.querySelector(`[data-note-id="${entry.id}"]`);
      if (noteNode instanceof HTMLElement) {
        noteNode.animate(
          [
            { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
            { transform: "scale(1.04)", boxShadow: "0 0 0 4px rgba(255,255,255,0.65)" },
            { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
          ],
          { duration: 1200, easing: "ease-out" },
        );
      }
    });
  };

  const handleEquip = async (itemId: string) => {
    if (!character) {
      return;
    }
    try {
      const res = await fetch(`/api/backend/characters/${character.id}/equip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      await ensureApiOk(res, "切换装备失败");
      const json = await res.json();
      setCharacter(json.character as CocInvestigatorRecord);
    } catch (nextError) {
      setMessages((prev) => [
        ...prev,
        {
          id: `equip_error_${Date.now()}`,
          sender: "dm",
          content: `装备切换失败：${getFriendlyErrorMessage(nextError, "请稍后重试。")}`,
          type: "system",
        },
      ]);
    }
  };

  if (loading) {
    return (
      <GameStatusShell
        title="正在整理调查卷宗"
        subtitle="系统正在装订案件记录、调查员档案与现场附卷。"
        body="请稍候片刻，调查日志、调查员附卷与场景地图会在卷宗整理完毕后完整展开。"
      />
    );
  }

  if (error || !character || !scenario) {
    const missingCharacter = !characterId;
    const missingScenario = !requestedModuleId && adventureId === "new";
    const title = missingCharacter ? "缺少调查员参数" : missingScenario ? "缺少案件参数" : "无法载入当前调查";
    const subtitle = missingCharacter
      ? "尚未为这起案件指定调查员，档案暂时无法装订。"
      : missingScenario
        ? "还没有选定要调查的案件，因此现场卷宗尚未建立。"
        : "系统未能完成当前案件的初始化。";
    const body = error
      ? `系统回报：${error}`
      : missingCharacter
        ? "请先从案件列表选择一名调查员，或新建调查员后再进入现场。"
        : missingScenario
          ? "请先从案件档案中选择一宗案件，再进入正式的调查现场。"
          : "请返回案件列表重新进入，或从调查员名录重新发起一次接案流程。";
    return (
      <GameStatusShell
        title={title}
        subtitle={subtitle}
        body={body}
        actions={[
          { label: "查看案件", onClick: () => router.push("/modules") },
          { label: "调查员名录", onClick: () => router.push("/coc/characters") },
          { label: "返回大厅", onClick: () => router.push("/") },
        ]}
      />
    );
  }

  const isBusy = processing || Boolean(pendingReply);

  return (
    <div className="riso-page h-[calc(100vh-64px)] overflow-x-auto px-4 py-4">
      <div className="grid h-full min-w-[1200px] grid-cols-[320px_minmax(0,1fr)_340px] overflow-hidden border-x-2 border-[var(--ink-color)] bg-[rgba(255,255,255,0.08)] shadow-[0_0_0_1px_rgba(31,32,65,0.15)]">
      <div className="overflow-hidden border-r-2 border-[var(--ink-color)]">
        <CharacterPanel
          character={character}
          onEquipItem={(itemId) => void handleEquip(itemId)}
          onOpenNotebook={() => setIsNotebookOpen(true)}
          notebookCount={notebookEntries.length}
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="border-b-2 border-[var(--ink-color)] bg-[var(--paper-light)] px-6 py-5 text-[var(--ink-color)]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[10px] font-vt323 uppercase tracking-[0.35em] opacity-70">{getScenarioReference(scenario)}</div>
              <div className="mt-2 text-[2rem] font-black uppercase leading-none tracking-[0.08em]">{scenario.title}</div>
              <div className="mt-3 max-w-3xl border-t border-dashed border-[var(--ink-color)] pt-3 text-sm leading-7 opacity-80">
                {sanitizeScenarioBackground(scenario.background)}
              </div>
            </div>
            <div className="shrink-0 border border-[var(--ink-color)] px-4 py-2 text-right">
              <div className="text-[10px] font-vt323 uppercase tracking-[0.32em]">调查日志</div>
              <div className="mt-1 font-vt323 text-base uppercase tracking-[0.18em]">{getNarrativeDate()}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            messages={messages}
            pendingReply={pendingReply}
            notes={notebookEntries}
            onSend={handleSend}
            onRoll={handleRoll}
            onMessageContextMenu={handleMessageContextMenu}
            disabled={isBusy}
          />
        </div>
      </div>
      <div className="overflow-hidden border-l-2 border-[var(--ink-color)]">
        <MapPanel
          locations={locations}
          currentLocationId={currentLocationId}
          scenes={scenes}
          onTravel={handleTravel}
        />
      </div>
      </div>
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[200px] border-2 border-[var(--ink-color)] bg-[var(--paper-light)] shadow-[5px_5px_0_rgba(31,32,65,0.8)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.action === "add" ? (
            <button
              type="button"
              onClick={addNotebookEntry}
              className="w-full px-4 py-3 text-left text-sm font-bold tracking-[0.14em] transition hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
            >
              划线并记录到笔记本
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeNotebookEntry(contextMenu.noteId)}
              className="w-full px-4 py-3 text-left text-sm font-bold tracking-[0.14em] transition hover:bg-[var(--ink-color)] hover:text-[var(--paper-light)]"
            >
              取消记录
            </button>
          )}
        </div>
      )}
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
              {notebookEntries.length === 0 ? (
                <div className="py-10 text-center text-base font-bold tracking-[0.16em] opacity-60">
                  暂无记录。先在聊天中选中文字，再右键划线记录。
                </div>
              ) : (
                notebookEntries.map((entry, index) => (
                  <div key={entry.id} className="riso-panel-soft px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => jumpToNotebookEntry(entry)}
                        className="flex-1 space-y-2 text-left"
                      >
                        <div className="text-[10px] font-vt323 uppercase tracking-[0.32em] opacity-60">记录 {index + 1}</div>
                        <div className="whitespace-pre-wrap text-base leading-8">{entry.text}</div>
                        <div className="text-[10px] font-vt323 uppercase tracking-[0.28em] opacity-60">点击定位到原聊天</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNotebookEntry(entry.id)}
                        className="border border-[var(--ink-color)] px-3 py-1 font-vt323 text-sm uppercase tracking-[0.16em] transition hover:bg-[var(--accent-color)] hover:text-[var(--paper-light)]"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-huiwen text-xl font-bold tracking-[0.3em] text-[var(--ink-color)] opacity-50">LOADING...</div>}>
      <GameContent />
    </Suspense>
  );
}
