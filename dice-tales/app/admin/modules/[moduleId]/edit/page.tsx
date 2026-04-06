"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  CocAsset,
  CocClue,
  CocHandout,
  CocLocation,
  CocNpc,
  CocScene,
  CocSceneItem,
  CocScenario,
  CocTriggerAction,
  CocTriggerCondition,
  CocTriggerRule,
  JsonMap,
} from "@/lib/domain/coc";
import { getAdminTokenFromBrowser } from "../../../AdminTokenBar";

type LocationItem = CocLocation;
type NpcItem = CocNpc;
type SceneStep = CocScene;
type ClueItem = CocClue;
type TriggerCondition = CocTriggerCondition;
type TriggerAction = CocTriggerAction;
type TriggerItem = CocTriggerRule;
type HandoutItem = CocHandout;
type SceneObjectItem = CocSceneItem;
type AssetItem = CocAsset;
type StructuredDraft = CocScenario;

type VersionItem = {
  version_id: string;
  status: string;
  note?: string | null;
  created_at: string;
  title?: string;
  schema_version?: number;
  rule_system?: string;
};

type ImportTaskItem = {
  task_id: string;
  source_file_name: string;
  source_file_type: string;
  parser_type: string;
  parser_version: string;
  status: string;
  status_label: string;
  stage_label: string;
  result_source_label?: string | null;
  error_label?: string | null;
  error_message?: string | null;
  output_summary?: string | null;
  next_action?: string | null;
  draft_ready: boolean;
  created_at: string;
  updated_at: string;
};

const createDefaultDraft = (moduleId: string): StructuredDraft => ({
  module_id: moduleId,
  status: "draft",
  title: moduleId,
  background: "",
  rule_system: "coc",
  tone: "",
  core_conflict: "",
  source_type: "admin",
  themes: [],
  schema_version: 3,
  locations: [],
  npcs: [],
  events: [],
  quests: [],
  sequence: [],
  triggers: [],
  clues: [],
  handouts: [],
  scene_items: [],
  assets: [],
  extensions: {},
  custom_types: [],
});

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyList = (value?: string[]) => (value || []).join(", ");

const parseJsonMap = (value: string, fallback: JsonMap = {}) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonMap)
      : fallback;
  } catch {
    return fallback;
  }
};

const parseJsonArray = <T,>(value: string, fallback: T[]): T[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const prettyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const readErrorText = async (res: Response) => {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed?.detail?.message) {
      return parsed.detail.message as string;
    }
  } catch {
  }
  return text;
};

export default function AdminModuleEditPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [draft, setDraft] = useState<StructuredDraft>(createDefaultDraft(moduleId));
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"form" | "json">("form");
  const [section, setSection] = useState<"overview" | "locations" | "scenes" | "npcs" | "clues" | "items" | "triggers" | "handouts" | "assets">("overview");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [importTasks, setImportTasks] = useState<ImportTaskItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [publishNote, setPublishNote] = useState("");

  const token = useMemo(() => getAdminTokenFromBrowser(), []);
  const latestImportTask = importTasks[0] || null;

  const syncDraft = (nextDraft: StructuredDraft) => {
    setDraft(nextDraft);
    setJsonText(JSON.stringify(nextDraft, null, 2));
  };

  useEffect(() => {
    fetch(`/api/backend/admin/modules/${moduleId}`, {
      headers: token ? { "x-admin-token": token } : undefined
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((json) => {
        const nextDraft = (json.data.draft || json.data.structured || createDefaultDraft(moduleId)) as StructuredDraft;
        syncDraft(nextDraft);
        setVersions(json.data.versions || []);
        setImportTasks(json.data.import_tasks || []);
        setStatus("已加载草稿与版本信息");
      })
      .catch((e) => setStatus(`加载失败: ${e.message}`));
  }, [moduleId, token]);

  const getPayload = () => {
    if (mode === "json") {
      return JSON.parse(jsonText) as StructuredDraft;
    }
    return draft;
  };

  const reloadDetail = async () => {
    const res = await fetch(`/api/backend/admin/modules/${moduleId}`, {
      headers: token ? { "x-admin-token": token } : undefined
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const json = await res.json();
    const nextDraft = (json.data.draft || json.data.structured || createDefaultDraft(moduleId)) as StructuredDraft;
    syncDraft(nextDraft);
    setVersions(json.data.versions || []);
    setImportTasks(json.data.import_tasks || []);
  };

  const handleSaveDraft = async () => {
    try {
      const payload = getPayload();
      const res = await fetch(`/api/backend/admin/modules/${moduleId}/structured`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = await res.json();
      syncDraft((json.data.draft || payload) as StructuredDraft);
      setValidationErrors([]);
      await reloadDetail();
      setStatus("草稿已保存");
    } catch (e) {
      setStatus(`保存失败: ${(e as Error).message}`);
    }
  };

  const handleValidate = async () => {
    const res = await fetch(`/api/backend/admin/modules/${moduleId}/validate`, {
      method: "POST",
      headers: token ? { "x-admin-token": token } : undefined
    });
    if (!res.ok) {
      setStatus(`校验失败: ${await readErrorText(res)}`);
      return;
    }
    const json = await res.json();
    setValidationErrors(json.data.errors || []);
    setStatus(json.data.valid ? "发布校验通过" : "发布校验未通过");
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/backend/admin/modules/${moduleId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {})
        },
        body: JSON.stringify({ note: publishNote })
      });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        let errors: string[] = [];
        try {
          const parsed = JSON.parse(text);
          message = parsed?.detail?.message || parsed?.message || text;
          errors = Array.isArray(parsed?.detail?.errors) ? parsed.detail.errors : [];
        } catch {
        }
        if (errors.length > 0) {
          setValidationErrors(errors);
        }
        throw new Error(message);
      }
      setValidationErrors([]);
      await reloadDetail();
      setStatus("已发布到正式版本");
    } catch (e) {
      setStatus(`发布失败: ${(e as Error).message}`);
    }
  };

  const updateOverview = (patch: Partial<StructuredDraft>) => {
    syncDraft({ ...draft, ...patch });
  };

  const updateLocation = (index: number, patch: Partial<LocationItem>) => {
    const next = [...draft.locations];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, locations: next });
  };

  const updateNpc = (index: number, patch: Partial<NpcItem>) => {
    const next = [...draft.npcs];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, npcs: next });
  };

  const updateScene = (index: number, patch: Partial<SceneStep>) => {
    const next = [...draft.sequence];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, sequence: next });
  };

  const updateClue = (index: number, patch: Partial<ClueItem>) => {
    const next = [...draft.clues];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, clues: next });
  };

  const updateTrigger = (index: number, patch: Partial<TriggerItem>) => {
    const next = [...draft.triggers];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, triggers: next });
  };

  const updateHandout = (index: number, patch: Partial<HandoutItem>) => {
    const next = [...draft.handouts];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, handouts: next });
  };

  const updateSceneItem = (index: number, patch: Partial<SceneObjectItem>) => {
    const next = [...draft.scene_items];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, scene_items: next });
  };

  const updateAsset = (index: number, patch: Partial<AssetItem>) => {
    const next = [...draft.assets];
    next[index] = { ...next[index], ...patch };
    syncDraft({ ...draft, assets: next });
  };

  const removeItem = (key: "locations" | "sequence" | "npcs" | "clues" | "scene_items" | "triggers" | "handouts" | "assets", index: number) => {
    const next = [...draft[key]];
    next.splice(index, 1);
    syncDraft({ ...draft, [key]: next });
  };

  const addLocation = () => {
    syncDraft({
      ...draft,
      locations: [...draft.locations, { name: "", description: "", connections: [], npcs: [], tags: [], extra: {} }]
    });
  };

  const addNpc = () => {
    syncDraft({
      ...draft,
      npcs: [...draft.npcs, { name: "", description: "", secrets: "", personality: "", tags: [], extra: {} }]
    });
  };

  const addScene = () => {
    syncDraft({
      ...draft,
      sequence: [
        ...draft.sequence,
        {
          id: `scene_${Date.now()}`,
          title: "",
          location_id: draft.locations[0]?.id || draft.locations[0]?.name || "",
          order: draft.sequence.length,
          description: "",
          prerequisites: [],
          tags: [],
          extra: {}
        }
      ]
    });
  };

  const addClue = () => {
    syncDraft({
      ...draft,
      clues: [
        ...draft.clues,
        {
          id: `clue_${Date.now()}`,
          title: "",
          content: "",
          source: "",
          visibility: "explicit",
          trigger_ref: "",
          discovery_method: "",
          gm_notes: "",
          discovery_conditions: [],
          tags: [],
          extra: {}
        }
      ]
    });
  };

  const addTrigger = () => {
    syncDraft({
      ...draft,
      triggers: [
        ...draft.triggers,
        {
          id: `trigger_${Date.now()}`,
          name: "",
          once: true,
          type: "",
          subtype: "",
          conditions: [],
          actions: [],
          tags: [],
          extra: {}
        }
      ]
    });
  };

  const addHandout = () => {
    syncDraft({
      ...draft,
      handouts: [
        ...draft.handouts,
        {
          id: `handout_${Date.now()}`,
          title: "",
          content: "",
          type: "text",
          asset_ids: [],
          grant_conditions: [],
          add_to_inventory: true,
          tags: [],
          extra: {}
        }
      ]
    });
  };

  const addSceneItem = () => {
    syncDraft({
      ...draft,
      scene_items: [
        ...draft.scene_items,
        {
          id: `item_${Date.now()}`,
          name: "",
          location_id: draft.locations[0]?.id || draft.locations[0]?.name || "",
          description: "",
          interactions: [],
          linked_clue_ids: [],
          tags: [],
          extra: {}
        }
      ]
    });
  };

  const addAsset = () => {
    syncDraft({
      ...draft,
      assets: [
        ...draft.assets,
        {
          id: `asset_${Date.now()}`,
          name: "",
          type: "document",
          url: "",
          description: "",
          tags: [],
          extra: {}
        }
      ]
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-amber-300">{moduleId}</h2>
          <p className="text-sm text-slate-300">
            Dify 先给出结构化候选结果，后端自动写入 draft 并保留版本；当前页面用于继续编辑、补充扩展字段、执行发布校验与正式发布。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode("form")}
            className={`rounded px-3 py-2 text-sm font-semibold ${mode === "form" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-200"}`}
          >
            表单模式
          </button>
          <button
            onClick={() => setMode("json")}
            className={`rounded px-3 py-2 text-sm font-semibold ${mode === "json" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-200"}`}
          >
            JSON 模式
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <h3 className="mb-3 text-lg font-semibold text-amber-300">导入架构</h3>
          <div className="space-y-2">
            <div>Dify 只负责把文档变成结构化候选 JSON，不直接写正式 published 数据。</div>
            <div>后端会先标准化、保留扩展字段、自动写入 draft，并同步创建版本快照与导入任务记录。</div>
            <div>管理员可以继续增删字段、扩展属性和修改字段值，确认无误后再执行发布校验与正式发布。</div>
          </div>
        </div>
        <div className="rounded border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <h3 className="mb-3 text-lg font-semibold text-amber-300">当前草稿</h3>
          <div className="space-y-2">
            <div>来源：{draft.source_type || "admin"}</div>
            <div>Schema：{draft.schema_version}</div>
            <div>规则：{draft.rule_system.toUpperCase()}</div>
            <div>扩展保存：表单模式处理核心字段，JSON 模式可继续修改任意扩展结构。</div>
            {latestImportTask && (
              <div className="rounded bg-slate-950 px-3 py-2 text-xs text-slate-300">
                最近导入：{latestImportTask.status_label} · {latestImportTask.stage_label}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["overview", "概览"],
          ["locations", "地点"],
          ["scenes", "场景"],
          ["npcs", "NPC"],
          ["clues", "线索"],
          ["items", "物品"],
          ["triggers", "触发器"],
          ["handouts", "资料"],
          ["assets", "资源"]
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSection(value as typeof section)}
            className={`rounded px-3 py-2 text-sm ${section === value ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "json" ? (
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="h-[640px] w-full rounded border border-slate-700 bg-slate-900 p-4 font-mono text-sm text-slate-100"
        />
      ) : (
        <div className="space-y-4">
          {section === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                <label className="block text-sm text-slate-300">
                  标题
                  <input
                    value={draft.title}
                    onChange={(e) => updateOverview({ title: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  规则系统
                  <input
                    value="COC"
                    readOnly
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  氛围
                  <input
                    value={draft.tone || ""}
                    onChange={(e) => updateOverview({ tone: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  核心冲突
                  <input
                    value={draft.core_conflict || ""}
                    onChange={(e) => updateOverview({ core_conflict: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  主题
                  <input
                    value={stringifyList(draft.themes)}
                    onChange={(e) => updateOverview({ themes: parseList(e.target.value) })}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
              </div>
              <div className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                <label className="block text-sm text-slate-300">
                  背景
                  <textarea
                    value={draft.background}
                    onChange={(e) => updateOverview({ background: e.target.value })}
                    className="mt-1 h-40 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  顶层扩展字段
                  <textarea
                    value={prettyJson(draft.extensions)}
                    onChange={(e) => updateOverview({ extensions: parseJsonMap(e.target.value, draft.extensions) })}
                    className="mt-1 h-40 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  自定义类型定义
                  <textarea
                    value={JSON.stringify(draft.custom_types, null, 2)}
                    onChange={(e) => updateOverview({ custom_types: parseJsonArray<JsonMap>(e.target.value, draft.custom_types) })}
                    className="mt-1 h-40 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {section === "locations" && (
            <div className="space-y-4">
              {draft.locations.map((location, index) => (
                <div key={`${location.name}-${index}`} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">地点 {index + 1}</div>
                    <button onClick={() => removeItem("locations", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <input value={location.name} onChange={(e) => updateLocation(index, { name: e.target.value })} placeholder="地点名" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={location.description} onChange={(e) => updateLocation(index, { description: e.target.value })} placeholder="描述" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(location.connections)} onChange={(e) => updateLocation(index, { connections: parseList(e.target.value) })} placeholder="连接地点，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(location.npcs)} onChange={(e) => updateLocation(index, { npcs: parseList(e.target.value) })} placeholder="相关NPC，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(location.extra)} onChange={(e) => updateLocation(index, { extra: parseJsonMap(e.target.value, location.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addLocation} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增地点</button>
            </div>
          )}

          {section === "scenes" && (
            <div className="space-y-4">
              {draft.sequence.map((scene, index) => (
                <div key={scene.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">场景 {scene.id}</div>
                    <button onClick={() => removeItem("sequence", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={scene.id} onChange={(e) => updateScene(index, { id: e.target.value })} placeholder="ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={scene.title} onChange={(e) => updateScene(index, { title: e.target.value })} placeholder="标题" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={scene.order ?? index} onChange={(e) => updateScene(index, { order: Number(e.target.value) || 0 })} placeholder="顺序" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  </div>
                  <input value={scene.location_id || ""} onChange={(e) => updateScene(index, { location_id: e.target.value })} placeholder="地点 ID" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={scene.description} onChange={(e) => updateScene(index, { description: e.target.value })} placeholder="场景描述" className="h-28 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(scene.prerequisites)} onChange={(e) => updateScene(index, { prerequisites: parseList(e.target.value) })} placeholder="前置场景 ID，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(scene.extra)} onChange={(e) => updateScene(index, { extra: parseJsonMap(e.target.value, scene.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addScene} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增场景</button>
            </div>
          )}

          {section === "npcs" && (
            <div className="space-y-4">
              {draft.npcs.map((npc, index) => (
                <div key={`${npc.name}-${index}`} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">NPC {index + 1}</div>
                    <button onClick={() => removeItem("npcs", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <input value={npc.name} onChange={(e) => updateNpc(index, { name: e.target.value })} placeholder="姓名" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={npc.description} onChange={(e) => updateNpc(index, { description: e.target.value })} placeholder="描述" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={npc.secrets || ""} onChange={(e) => updateNpc(index, { secrets: e.target.value })} placeholder="秘密" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(npc.extra)} onChange={(e) => updateNpc(index, { extra: parseJsonMap(e.target.value, npc.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addNpc} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增 NPC</button>
            </div>
          )}

          {section === "clues" && (
            <div className="space-y-4">
              {draft.clues.map((clue, index) => (
                <div key={clue.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">线索 {clue.id}</div>
                    <button onClick={() => removeItem("clues", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <input value={clue.id} onChange={(e) => updateClue(index, { id: e.target.value })} placeholder="ID" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={clue.title} onChange={(e) => updateClue(index, { title: e.target.value })} placeholder="标题" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={clue.content} onChange={(e) => updateClue(index, { content: e.target.value })} placeholder="内容" className="h-28 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={clue.source || ""} onChange={(e) => updateClue(index, { source: e.target.value })} placeholder="来源" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <select value={clue.visibility || ""} onChange={(e) => updateClue(index, { visibility: (e.target.value || null) as "explicit" | "hidden" | null })} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white">
                      <option value="">可见性</option>
                      <option value="explicit">显性</option>
                      <option value="hidden">隐性</option>
                    </select>
                    <input value={clue.trigger_ref || ""} onChange={(e) => updateClue(index, { trigger_ref: e.target.value })} placeholder="触发器引用" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  </div>
                  <input value={clue.discovery_method || ""} onChange={(e) => updateClue(index, { discovery_method: e.target.value })} placeholder="发现方式" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={clue.gm_notes || ""} onChange={(e) => updateClue(index, { gm_notes: e.target.value })} placeholder="守秘人提示" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(clue.discovery_conditions)} onChange={(e) => updateClue(index, { discovery_conditions: parseList(e.target.value) })} placeholder="发现条件，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(clue.extra)} onChange={(e) => updateClue(index, { extra: parseJsonMap(e.target.value, clue.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addClue} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增线索</button>
            </div>
          )}

          {section === "items" && (
            <div className="space-y-4">
              {draft.scene_items.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">物品 {item.id}</div>
                    <button onClick={() => removeItem("scene_items", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input value={item.id} onChange={(e) => updateSceneItem(index, { id: e.target.value })} placeholder="ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={item.name} onChange={(e) => updateSceneItem(index, { name: e.target.value })} placeholder="名称" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  </div>
                  <input value={item.location_id} onChange={(e) => updateSceneItem(index, { location_id: e.target.value })} placeholder="地点 ID" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={item.description} onChange={(e) => updateSceneItem(index, { description: e.target.value })} placeholder="描述" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(item.interactions)} onChange={(e) => updateSceneItem(index, { interactions: parseList(e.target.value) })} placeholder="可交互动作，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(item.linked_clue_ids)} onChange={(e) => updateSceneItem(index, { linked_clue_ids: parseList(e.target.value) })} placeholder="关联线索 ID，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(item.extra)} onChange={(e) => updateSceneItem(index, { extra: parseJsonMap(e.target.value, item.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addSceneItem} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增物品</button>
            </div>
          )}

          {section === "triggers" && (
            <div className="space-y-4">
              {draft.triggers.map((trigger, index) => (
                <div key={trigger.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">触发器 {trigger.id}</div>
                    <button onClick={() => removeItem("triggers", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={trigger.id} onChange={(e) => updateTrigger(index, { id: e.target.value })} placeholder="ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={trigger.name} onChange={(e) => updateTrigger(index, { name: e.target.value })} placeholder="名称" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <label className="flex items-center gap-2 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                      <input type="checkbox" checked={trigger.once} onChange={(e) => updateTrigger(index, { once: e.target.checked })} />
                      一次性触发
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input value={trigger.type || ""} onChange={(e) => updateTrigger(index, { type: e.target.value })} placeholder="类型" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={trigger.subtype || ""} onChange={(e) => updateTrigger(index, { subtype: e.target.value })} placeholder="子类型" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  </div>
                  <label className="block text-sm text-slate-300">
                    Conditions JSON
                    <textarea
                      value={JSON.stringify(trigger.conditions, null, 2)}
                      onChange={(e) => updateTrigger(index, { conditions: parseJsonArray<TriggerCondition>(e.target.value, trigger.conditions) })}
                      className="mt-1 h-40 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Actions JSON
                    <textarea
                      value={JSON.stringify(trigger.actions, null, 2)}
                      onChange={(e) => updateTrigger(index, { actions: parseJsonArray<TriggerAction>(e.target.value, trigger.actions) })}
                      className="mt-1 h-40 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white"
                    />
                  </label>
                  <textarea value={prettyJson(trigger.extra)} onChange={(e) => updateTrigger(index, { extra: parseJsonMap(e.target.value, trigger.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addTrigger} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增触发器</button>
            </div>
          )}

          {section === "handouts" && (
            <div className="space-y-4">
              {draft.handouts.map((handout, index) => (
                <div key={handout.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">资料 {handout.id}</div>
                    <button onClick={() => removeItem("handouts", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={handout.id} onChange={(e) => updateHandout(index, { id: e.target.value })} placeholder="ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={handout.title} onChange={(e) => updateHandout(index, { title: e.target.value })} placeholder="标题" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <select value={handout.type} onChange={(e) => updateHandout(index, { type: e.target.value as HandoutItem["type"] })} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white">
                      <option value="text">text</option>
                      <option value="image">image</option>
                      <option value="mixed">mixed</option>
                    </select>
                  </div>
                  <textarea value={handout.content} onChange={(e) => updateHandout(index, { content: e.target.value })} placeholder="内容" className="h-28 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(handout.asset_ids)} onChange={(e) => updateHandout(index, { asset_ids: parseList(e.target.value) })} placeholder="关联资源ID，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <input value={stringifyList(handout.grant_conditions)} onChange={(e) => updateHandout(index, { grant_conditions: parseList(e.target.value) })} placeholder="发放条件，逗号分隔" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={handout.add_to_inventory} onChange={(e) => updateHandout(index, { add_to_inventory: e.target.checked })} />
                    发放后加入背包
                  </label>
                  <textarea value={prettyJson(handout.extra)} onChange={(e) => updateHandout(index, { extra: parseJsonMap(e.target.value, handout.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addHandout} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增资料</button>
            </div>
          )}

          {section === "assets" && (
            <div className="space-y-4">
              {draft.assets.map((asset, index) => (
                <div key={asset.id} className="space-y-3 rounded border border-slate-700 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-amber-300">资源 {asset.id}</div>
                    <button onClick={() => removeItem("assets", index)} className="text-sm text-red-300">删除</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input value={asset.id} onChange={(e) => updateAsset(index, { id: e.target.value })} placeholder="ID" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <input value={asset.name} onChange={(e) => updateAsset(index, { name: e.target.value })} placeholder="名称" className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                    <select value={asset.type} onChange={(e) => updateAsset(index, { type: e.target.value as AssetItem["type"] })} className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white">
                      <option value="image">image</option>
                      <option value="map">map</option>
                      <option value="document">document</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                  <input value={asset.url} onChange={(e) => updateAsset(index, { url: e.target.value })} placeholder="URL" className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={asset.description} onChange={(e) => updateAsset(index, { description: e.target.value })} placeholder="描述" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
                  <textarea value={prettyJson(asset.extra)} onChange={(e) => updateAsset(index, { extra: parseJsonMap(e.target.value, asset.extra) })} placeholder="extra" className="h-24 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-white" />
                </div>
              ))}
              <button onClick={addAsset} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">新增资源</button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSaveDraft}
          className="rounded bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-500"
        >
          保存草稿
        </button>
        <button onClick={handleValidate} className="rounded bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600">发布校验</button>
        <input
          value={publishNote}
          onChange={(e) => setPublishNote(e.target.value)}
          placeholder="发布说明"
          className="min-w-52 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <button onClick={handlePublish} className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500">发布正式版本</button>
        <span className="text-sm text-slate-300">{status}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 text-lg font-semibold text-amber-300">发布校验</h3>
          {validationErrors.length === 0 ? (
            <div className="text-sm text-slate-300">暂无校验错误，点击“发布校验”后会显示最新结果。</div>
          ) : (
            <ul className="space-y-2 text-sm text-red-200">
              {validationErrors.map((item) => (
                <li key={item} className="rounded bg-red-950 px-3 py-2">{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-slate-700 bg-slate-900 p-4">
          <h3 className="mb-3 text-lg font-semibold text-amber-300">版本历史</h3>
          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.version_id} className="rounded bg-slate-950 px-3 py-2 text-sm text-slate-200">
                <div className="font-medium">{version.status} · {version.version_id}</div>
                <div className="text-xs text-slate-400">{version.created_at}</div>
                {version.note && <div className="text-xs text-slate-300">{version.note}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-3 text-lg font-semibold text-amber-300">导入记录</h3>
        <div className="space-y-2">
          {importTasks.map((task) => (
            <div key={task.task_id} className="rounded bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <div className="font-medium">{task.source_file_name}</div>
              <div className="text-xs text-slate-400">{task.parser_type} · {task.status_label} · {task.created_at}</div>
              <div className="mt-1 text-xs text-slate-300">{task.stage_label}</div>
              <div className="mt-1 text-xs text-slate-400">
                来源：{task.result_source_label || "-"} · 最近更新：{task.updated_at}
              </div>
              {task.output_summary && <div className="mt-1 text-xs text-slate-300">{task.output_summary}</div>}
              {task.error_label && <div className="mt-1 text-xs text-red-300">{task.error_label}</div>}
              {task.error_message && <div className="text-xs text-red-300">{task.error_message}</div>}
              {task.next_action && <div className="mt-1 text-xs text-slate-400">{task.next_action}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
