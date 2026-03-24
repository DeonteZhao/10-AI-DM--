import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

type ChatMessage = {
  role: "ai" | "player";
  content: string;
};

let cocModuleCache: string | null = null;

const loadCocModuleText = async () => {
  if (cocModuleCache) {
    return cocModuleCache;
  }
  const path = process.env.COC_MODULE_PDF_PATH;
  if (!path) {
    return null;
  }
  const buffer = await readFile(path);
  const parsed = await pdfParse(buffer);
  const text = typeof parsed.text === "string" ? parsed.text : "";
  const normalized = text.replace(/\s+/g, " ").trim();
  const clipped = normalized.slice(0, 4000);
  cocModuleCache = clipped.length > 0 ? clipped : null;
  return cocModuleCache;
};

const buildPrompt = (
  messages: ChatMessage[],
  moduleId: string | null,
  moduleText: string | null
) => {
  const history = messages
    .map((message) =>
      message.role === "ai" ? `DM：${message.content}` : `玩家：${message.content}`
    )
    .join("\n");
  const moduleSection =
    moduleId === "coc_srd_pdf"
      ? `\n[CoC 初始模组]\n${moduleText ?? "使用 CoC SRD 作为初始模组。"}`
      : "";
  return `你是DND与Coc风格的DM，保持简洁叙事。${moduleSection}\n${history}`;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase未配置" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("game_logs")
    .select("player_content, ai_content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "日志读取失败" }, { status: 500 });
  }
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
    sessionId?: string;
    session_id?: string;
    message?: string;
  } | null;
  const messages = Array.isArray(body?.messages) ? body?.messages : [];
  const sessionId = body?.sessionId ?? body?.session_id ?? null;
  const incomingMessage =
    typeof body?.message === "string" && body.message.trim().length > 0
      ? body.message.trim()
      : [...messages].reverse().find((item) => item.role === "player")?.content ??
        null;
  if (!sessionId || !incomingMessage) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      content: "你靠近门口，木板发出细微的吱响，空气里夹着潮湿的味道。",
      choices: ["检查地面痕迹", "轻轻推门", "回头观察四周"]
    });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const supabase =
    supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  let moduleId: string | null = null;
  if (sessionId && supabase) {
    const { data } = await supabase
      .from("sessions")
      .select("module_id")
      .eq("id", sessionId)
      .single();
    moduleId = data?.module_id ?? null;
  }
  const moduleText = moduleId === "coc_srd_pdf" ? await loadCocModuleText() : null;
  let recentMessages: ChatMessage[] = [{ role: "player", content: incomingMessage }];
  if (supabase) {
    const { data: logs } = await supabase
      .from("game_logs")
      .select("id, player_content, ai_content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(5);
    const rebuilt: ChatMessage[] = [];
    if (Array.isArray(logs)) {
      logs
        .slice()
        .reverse()
        .forEach((item) => {
          if (item.player_content) {
            rebuilt.push({ role: "player", content: item.player_content });
          }
          if (item.ai_content) {
            rebuilt.push({ role: "ai", content: item.ai_content });
          }
        });
    }
    recentMessages = [...rebuilt, { role: "player" as const, content: incomingMessage }].slice(
      -10
    );
  } else {
    recentMessages = [...messages, { role: "player" as const, content: incomingMessage }].slice(
      -10
    );
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": request.headers.get("origin") ?? "http://localhost:3000",
      "X-Title": "DiceTales"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: buildPrompt(recentMessages, moduleId, moduleText) },
        ...recentMessages.map((item) => ({
          role: item.role === "ai" ? "assistant" : "user",
          content: item.content
        }))
      ]
    })
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: "DM暂时陷入了沉默，请重试" },
      { status: 500 }
    );
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "风声掠过，未闻回应。";
  if (supabase) {
    await supabase.from("game_logs").insert({
      session_id: sessionId,
      player_content: incomingMessage,
      ai_content: content
    });
    const { data: overflow } = await supabase
      .from("game_logs")
      .select("id, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .range(5, 100);
    const ids = Array.isArray(overflow)
      ? overflow.map((item) => item.id).filter(Boolean)
      : [];
    if (ids.length > 0) {
      await supabase.from("game_logs").delete().in("id", ids);
    }
  }
  return NextResponse.json({ content });
}
