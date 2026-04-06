"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COC_BASELINE_MODULE_ID, COC_BASELINE_MODULE_NAME } from "@/lib/domain/coc";
import { getAdminTokenFromBrowser } from "../AdminTokenBar";

type ImportTask = {
  task_id: string;
  module_id: string;
  parser_type: string;
  source_file_name: string;
  status: string;
  status_label: string;
  stage: string;
  stage_label: string;
  result_source?: string | null;
  result_source_label?: string | null;
  error_type?: string | null;
  error_label?: string | null;
  error_message?: string | null;
  output_summary?: string | null;
  raw_output_summary?: string | null;
  next_action?: string | null;
  normalized_output?: Record<string, unknown> | null;
  draft_ready: boolean;
};

export default function AdminUploadPage() {
  const [moduleId] = useState(COC_BASELINE_MODULE_ID);
  const [file, setFile] = useState<File | null>(null);
  const [parserType, setParserType] = useState<"dify" | "openrouter">("dify");
  const [status, setStatus] = useState("");
  const [task, setTask] = useState<ImportTask | null>(null);
  const [draftPreview, setDraftPreview] = useState<Record<string, unknown> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const isPolling = Boolean(task && !["completed", "failed"].includes(task.status));

  useEffect(() => {
    if (!task || ["completed", "failed"].includes(task.status)) {
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const token = getAdminTokenFromBrowser();
        const response = await fetch(`/api/backend/admin/modules/import-tasks/${task.task_id}`, {
          headers: token ? { "x-admin-token": token } : undefined,
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const json = await response.json();
        const nextTask = json.data as ImportTask;
        setTask(nextTask);
        setDraftPreview((nextTask.normalized_output || null) as Record<string, unknown> | null);
        if (nextTask.status === "completed") {
          setStatus(`✅ ${nextTask.status_label}：${nextTask.output_summary || nextTask.stage_label}`);
          return;
        }
        if (nextTask.status === "failed") {
          setStatus(`❌ ${nextTask.error_label || nextTask.status_label}：${nextTask.error_message || nextTask.output_summary || "任务失败"}`);
          return;
        }
        setStatus(`⏳ ${nextTask.status_label}：${nextTask.stage_label}`);
      } catch (error) {
        setStatus(`❌ 轮询任务失败: ${(error as Error).message}`);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [task]);

  const handleUpload = async () => {
    if (!moduleId || !file) {
      alert("请选择要导入的 DOCX/PDF 文件");
      return;
    }
    const token = getAdminTokenFromBrowser();
    setIsSubmitting(true);
    setTask(null);
    setDraftPreview(null);
    setStatus("正在上传文件并创建导入任务...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module_id", moduleId);
      formData.append("parser_type", parserType);

      const response = await fetch("/api/backend/admin/modules/import", {
        method: "POST",
        headers: token ? { "x-admin-token": token } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const json = await response.json();
      const nextTask = json.data.task as ImportTask;
      setTask(nextTask);
      setStatus(`✅ ${nextTask.status_label}：${nextTask.output_summary || "任务已入队，正在转入后台处理"}`);
    } catch (error) {
      setStatus(`❌ 错误: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded border border-slate-700 bg-slate-900 p-6">
        <div className="rounded border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
          Dify 只负责把文档先整理成结构化候选 JSON，后端会自动把结果写入 draft、创建版本快照并保留错误摘要；管理员随后进入编辑器继续补字段、扩展 schema，再执行发布校验和正式发布。
        </div>
        <div className="rounded border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100">
          当前单模组基线固定为 {COC_BASELINE_MODULE_NAME}（{COC_BASELINE_MODULE_ID}），导入结果会直接收敛到该模组。
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Module ID
          </label>
          <input
            type="text"
            value={moduleId}
            readOnly
            className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-slate-300"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            解析引擎
          </label>
          <select
            value={parserType}
            onChange={(e) => setParserType(e.target.value as "dify" | "openrouter")}
            className="w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="dify">Dify Workflow</option>
            <option value="openrouter">OpenRouter 本地文本抽取</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            推荐使用 Dify；OpenRouter 适合作为 PDF/DOCX 的后备解析通道。
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            模组文件
          </label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="w-full text-slate-300 file:mr-4 file:rounded file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-500"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={isSubmitting || isPolling}
          className={`w-full rounded px-4 py-3 font-bold transition-colors ${
            isSubmitting || isPolling
              ? "cursor-not-allowed bg-slate-700"
              : "bg-amber-600 hover:bg-amber-500"
          }`}
        >
          {isSubmitting ? "上传中..." : isPolling ? "任务处理中..." : "开始导入并生成草稿"}
        </button>

        {status && (
          <div className={`rounded p-4 ${status.includes("❌") ? "bg-red-950 text-red-200" : "bg-emerald-950 text-emerald-200"}`}>
            {status}
          </div>
        )}
      </div>

      {task && (
        <div className="space-y-4 rounded border border-slate-700 bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-amber-400">导入任务</h2>
              <p className="text-sm text-slate-300">Task: {task.task_id} · 引擎: {task.parser_type} · 状态: {task.status_label}</p>
            </div>
            {task.draft_ready && (
              <Link
                href={`/admin/modules/${task.module_id}/edit`}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
              >
                打开编辑器继续修订
              </Link>
            )}
          </div>
          <div className="grid gap-3 rounded border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200 md:grid-cols-2">
            <div>阶段：{task.stage_label}</div>
            <div>结果来源：{task.result_source_label || "-"}</div>
            <div>文件：{task.source_file_name}</div>
            <div>错误分类：{task.error_label || "-"}</div>
            <div className="md:col-span-2">任务摘要：{task.output_summary || "-"}</div>
            {task.raw_output_summary && <div className="md:col-span-2">响应摘要：{task.raw_output_summary}</div>}
            {task.next_action && <div className="md:col-span-2">下一步：{task.next_action}</div>}
          </div>
          {draftPreview && (
            <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-300">
              {JSON.stringify(draftPreview, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
