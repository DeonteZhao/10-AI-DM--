"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Brain, CircleNotch, DiceFive, MapPin, PaperPlaneRight, X } from "@phosphor-icons/react";
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

const CHECK_LEVEL_LABELS: Record<CocCheckResult["level"], string> = {
  critical: "大成功",
  extreme: "极难成功",
  hard: "困难成功",
  regular: "常规成功",
  failure: "失败",
  fumble: "大失败",
};

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
    <div className="h-full flex flex-col font-huiwen bg-[var(--paper-light)] z-0">
      <div className="px-6 h-[60px] bg-theme-bg border-b-[3px] border-[var(--ink-color)] flex items-center gap-3 shrink-0 relative z-0">
        <Brain className="w-7 h-7 text-[var(--ink-color)]" weight="fill" />
        <span className="text-[var(--ink-color)] font-black tracking-widest uppercase text-lg">与 KP 的对话</span>
        <span className="text-xs text-[var(--bg-color)] bg-[var(--ink-color)] px-3 py-1 ml-auto font-bold uppercase tracking-widest shadow-[2px_2px_0_var(--accent-color)] font-vt323">AI KP</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.sender === "player" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-5 py-4 border-[3px] relative ${
                message.sender === "player"
                  ? "bg-[var(--ink-color)] border-[var(--ink-color)] text-[var(--bg-color)] ml-8 shadow-[-4px_4px_0_var(--ink-color)]"
                  : message.type === "system"
                    ? "bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] text-center w-full max-w-full shadow-[4px_4px_0_var(--ink-color)] border-dashed"
                    : message.type === "roll"
                      ? "bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]"
                      : "bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] mr-8 shadow-[4px_4px_0_var(--ink-color)]"
              }`}
            >
              {message.sender === "dm" && message.type !== "system" && (
                <div className="absolute -top-3 -left-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 text-xs font-bold uppercase font-vt323 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                  KP
                </div>
              )}
              {message.sender === "player" && (
                <div className="absolute -top-3 -right-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 text-xs font-bold uppercase font-vt323 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                  PLAYER
                </div>
              )}
              {message.type === "roll" && message.rollResult && (
                <div className="flex items-center gap-2 mb-3 bg-[var(--ink-color)] text-[var(--bg-color)] px-3 py-1.5 inline-flex font-vt323 tracking-widest">
                  <DiceFive className="w-5 h-5 text-[var(--bg-color)]" weight="fill" />
                  <span className={`text-base font-black ${message.rollResult.passed ? "text-[#a8e6cf]" : "text-[#ff8b94]"}`}>
                    {message.rollResult.roll.value} / {message.rollResult.target} · {CHECK_LEVEL_LABELS[message.rollResult.level]}
                  </span>
                </div>
              )}
              <p
                data-message-id={message.id}
                onContextMenu={(event) => onMessageContextMenu(event, message.id)}
                className={`text-lg whitespace-pre-wrap leading-relaxed tracking-wide ${
                message.type === "system" ? "font-black tracking-widest uppercase opacity-80" : "font-medium"
              }`}
              >
                {renderMessageWithNotes(
                  message.content,
                  notes.filter((item) => item.messageId === message.id),
                )}
              </p>
              {message.choices && message.choices.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t-[2px] border-dashed border-[var(--ink-color)] pt-4">
                  {message.choices.map((choice) => (
                    <button
                      key={`${message.id}_${choice}`}
                      type="button"
                      onClick={() => onSend(choice)}
                      disabled={disabled}
                      className="px-3 py-2 bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] text-sm font-bold tracking-wide disabled:opacity-60"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
              {message.requiredCheck && message.sender === "dm" && (
                <div className="mt-5 border-t-[3px] border-dashed border-[var(--ink-color)] pt-4">
                  <button
                    type="button"
                    onClick={() => onRoll(message.requiredCheck!)}
                    disabled={disabled}
                    className="flex items-center gap-2 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] px-4 py-2 font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    <DiceFive className="w-6 h-6" weight="fill" />
                    进行 {message.requiredCheck.name} 检定
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {pendingReply && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-5 py-4 border-[3px] relative bg-theme-bg border-[var(--ink-color)] text-[var(--ink-color)] mr-8 shadow-[4px_4px_0_var(--ink-color)]">
              <div className="absolute -top-3 -left-3 bg-[var(--accent-color)] text-[var(--bg-color)] border-[2px] border-[var(--ink-color)] px-2 text-xs font-bold uppercase font-vt323 tracking-widest shadow-[2px_2px_0_var(--ink-color)]">
                KP
              </div>
              {pendingReply.status === "loading" ? (
                <div className="flex items-center gap-3 text-lg font-medium">
                  <CircleNotch className="w-5 h-5 animate-spin" weight="bold" />
                  <span>KP 正在思考…</span>
                </div>
              ) : (
                <p className="text-lg whitespace-pre-wrap leading-relaxed tracking-wide font-medium">{pendingReply.content}</p>
              )}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-6 bg-theme-bg border-t-[3px] border-dashed border-[var(--ink-color)] relative z-10">
        <div className="flex items-end gap-3 bg-[var(--paper-light)] border-[3px] border-[var(--ink-color)] p-2 shadow-[4px_4px_0_var(--ink-color)] focus-within:bg-theme-bg transition-all">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="输入你的行动..."
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[48px] text-[var(--ink-color)] font-bold text-lg p-3 placeholder:text-[var(--ink-color)] placeholder:opacity-40 tracking-wide font-huiwen"
            rows={1}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || disabled}
            className="p-4 bg-[var(--accent-color)] text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] disabled:opacity-50 disabled:bg-[var(--ink-color)] transition-colors shadow-[2px_2px_0_var(--ink-color)]"
          >
            <PaperPlaneRight className="w-6 h-6" weight="fill" />
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
    <div className="h-full flex flex-col bg-[var(--paper-light)] font-huiwen">
      <div className="px-5 h-[60px] bg-theme-bg border-b-[3px] border-[var(--ink-color)] flex items-center gap-3 shrink-0">
        <MapPin className="w-6 h-6 text-[var(--ink-color)]" weight="fill" />
        <span className="text-[var(--ink-color)] font-black tracking-widest uppercase text-lg">场景地图</span>
      </div>
      <div className="p-5 overflow-y-auto space-y-6">
        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 shadow-[4px_4px_0_var(--ink-color)]">
          <div className="text-xs font-black tracking-widest opacity-60 uppercase">当前位置</div>
          <div className="mt-3 text-2xl font-black tracking-widest">{currentLocation?.name || "未知地点"}</div>
          <p className="mt-3 text-sm font-medium opacity-80 leading-relaxed">地点细节由 KP 在叙事中逐步呈现。</p>
        </div>

        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 shadow-[4px_4px_0_var(--ink-color)]">
          <div className="text-xs font-black tracking-widest opacity-60 uppercase mb-4">可见地点</div>
          <div className="space-y-3">
            {locations.map((location) => (
              <button
                key={location.id || location.name}
                type="button"
                onClick={() => location.id && onTravel(location.id)}
                className={`w-full text-left px-4 py-3 border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] ${
                  location.id === currentLocationId ? "bg-[var(--ink-color)] text-[var(--bg-color)]" : "bg-[var(--paper-light)] text-[var(--ink-color)]"
                }`}
              >
                <div className="font-black tracking-widest">{location.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-theme-bg border-[3px] border-[var(--ink-color)] p-4 shadow-[4px_4px_0_var(--ink-color)]">
          <div className="text-xs font-black tracking-widest opacity-60 uppercase mb-4">场景推进</div>
          <div className="space-y-3">
            {scenes.map((scene) => (
              <div key={scene.id} className="border-[2px] border-[var(--ink-color)] bg-[var(--paper-light)] px-4 py-3 shadow-[2px_2px_0_var(--ink-color)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black tracking-widest">{scene.title}</div>
                  <span className="text-xs font-black uppercase tracking-widest">{scene.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameContent() {
  const params = useParams();
  const searchParams = useSearchParams();
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
    if (!res.ok) {
      throw new Error(await res.text());
    }
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
    if (!res.ok) {
      throw new Error(await res.text());
    }
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
    let disposed = false;

    const initialize = async () => {
      try {
        if (adventureId !== "new") {
          const sessionRes = await fetch(`/api/backend/sessions/${adventureId}`);
          if (!sessionRes.ok) {
            throw new Error(await sessionRes.text());
          }
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
        if (!charactersRes.ok) {
          throw new Error(await charactersRes.text());
        }
        if (!scenarioRes.ok) {
          throw new Error(await scenarioRes.text());
        }
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
        if (!createSessionRes.ok) {
          throw new Error(await createSessionRes.text());
        }
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
          setError((nextError as Error).message || "游戏初始化失败");
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
  }, [adventureId, characterId, requestedModuleId]);

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
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      await syncSessionState(sessionId, true);
      await refreshInvestigator(sessionId);
      const result = json.result || {};
      const dmMessage: UiMessage = {
        id: `dm_${Date.now()}`,
        sender: "dm",
        content: typeof result.narration === "string" ? result.narration : "KP 暂时沉默了下来。",
        type: "narrative",
        requiredCheck: result.required_check as CocCheckRequest | undefined,
        choices: Array.isArray(result.choices)
          ? result.choices.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
          : [],
      };
      await streamDmReply(dmMessage.content);
      setMessages((prev) => {
        const next = [...prev, dmMessage];
        if (Array.isArray(result.revealed_clues)) {
          result.revealed_clues.forEach((clue: { id: string; title: string }) => {
            next.push({
              id: `clue_${clue.id}_${Date.now()}`,
              sender: "dm",
              content: `你获得线索【${clue.title}】`,
              type: "system",
            });
          });
        }
        if (Array.isArray(result.granted_handouts)) {
          result.granted_handouts.forEach((handout: { id: string; title: string }) => {
            next.push({
              id: `handout_${handout.id}_${Date.now()}`,
              sender: "dm",
              content: `你获得资料【${handout.title}】`,
              type: "system",
            });
          });
        }
        return next;
      });
    } catch (nextError) {
      setPendingReply(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          sender: "dm",
          content: `KP 暂时失联：${(nextError as Error).message}`,
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
      if (!res.ok) {
        throw new Error(await res.text());
      }
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
          content: `检定失败：${(nextError as Error).message}`,
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
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      setCharacter(json.character as CocInvestigatorRecord);
    } catch (nextError) {
      setMessages((prev) => [
        ...prev,
        {
          id: `equip_error_${Date.now()}`,
          sender: "dm",
          content: `装备切换失败：${(nextError as Error).message}`,
          type: "system",
        },
      ]);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>;
  }

  if (error || !character || !scenario) {
    return (
      <div className="p-8 text-center text-[var(--accent-color)] font-huiwen text-xl font-bold tracking-widest">
        {error || "无法载入当前调查"}
      </div>
    );
  }

  const isBusy = processing || Boolean(pendingReply);

  return (
    <div className="h-[calc(100vh-64px)] grid grid-cols-[320px_minmax(0,1fr)_340px] bg-theme-bg">
      <div className="border-r-[3px] border-[var(--ink-color)] overflow-hidden">
        <CharacterPanel
          character={character}
          onEquipItem={(itemId) => void handleEquip(itemId)}
          onOpenNotebook={() => setIsNotebookOpen(true)}
          notebookCount={notebookEntries.length}
        />
      </div>
      <div className="min-w-0 flex flex-col">
        <div className="px-6 py-4 border-b-[3px] border-[var(--ink-color)] bg-theme-bg text-[var(--ink-color)]">
          <div className="text-xs font-black tracking-widest opacity-60 uppercase">当前案件</div>
          <div className="mt-2 text-2xl font-black tracking-widest">{scenario.title}</div>
          <div className="mt-2 text-sm font-bold opacity-70">{sanitizeScenarioBackground(scenario.background)}</div>
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
      <div className="border-l-[3px] border-[var(--ink-color)] overflow-hidden">
        <MapPanel
          locations={locations}
          currentLocationId={currentLocationId}
          scenes={scenes}
          onTravel={handleTravel}
        />
      </div>
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.action === "add" ? (
            <button
              type="button"
              onClick={addNotebookEntry}
              className="w-full text-left px-4 py-3 text-sm font-bold tracking-wide hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)]"
            >
              划线并记录到笔记本
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeNotebookEntry(contextMenu.noteId)}
              className="w-full text-left px-4 py-3 text-sm font-bold tracking-wide hover:bg-[var(--ink-color)] hover:text-[var(--bg-color)]"
            >
              取消记录
            </button>
          )}
        </div>
      )}
      {isNotebookOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[6px_6px_0_var(--ink-color)]">
            <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-[var(--ink-color)]">
              <div>
                <div className="text-xs font-black tracking-widest opacity-60 uppercase">调查工具</div>
                <div className="mt-1 text-2xl font-black tracking-widest">笔记本</div>
              </div>
              <button
                type="button"
                onClick={() => setIsNotebookOpen(false)}
                className="p-2 border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
            </div>
            <div className="p-6 max-h-[calc(80vh-88px)] overflow-y-auto space-y-4 bg-[var(--paper-light)]">
              {notebookEntries.length === 0 ? (
                <div className="text-center py-10 opacity-60 font-bold tracking-widest">暂无记录。先在聊天中选中文字，再右键划线记录。</div>
              ) : (
                notebookEntries.map((entry, index) => (
                  <div key={entry.id} className="bg-theme-bg border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => jumpToNotebookEntry(entry)}
                        className="space-y-2 text-left flex-1"
                      >
                        <div className="text-xs font-black opacity-60 tracking-widest uppercase">记录 {index + 1}</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{entry.text}</div>
                        <div className="text-xs font-bold tracking-widest opacity-60 uppercase">点击定位到原聊天</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNotebookEntry(entry.id)}
                        className="px-3 py-1 text-xs font-bold tracking-widest border-[2px] border-[var(--ink-color)] shadow-[2px_2px_0_var(--ink-color)]"
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
    <Suspense fallback={<div className="p-8 text-center text-[var(--ink-color)] opacity-50 font-huiwen text-xl font-bold tracking-widest">LOADING...</div>}>
      <GameContent />
    </Suspense>
  );
}
