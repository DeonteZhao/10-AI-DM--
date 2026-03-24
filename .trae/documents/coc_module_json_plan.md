# COC 模组结构化与架构测试计划（含长效自动化方案）

为了将 `CHA23131 Call of Cthulhu 7th Edition Quick-Start Rules.docx` 转换为我们系统支持的 JSON 格式并进行测试，我制定了以下四步计划。该计划将验证当前的 AI DM 跑团架构是否能够无缝承载和运行真实的 COC 官方模组。

同时，针对您提出的**“日后如何高效处理大量类似模组的结构化工作”**，我在本文档末尾补充了长效运营的自动化方案建议。

---

## 阶段一：直接复用您的 Dify 工作流进行提取
既然您已经有了极其完善的 Dify DSL (`dify_workflow\模组提取.yml`)，它内部集成了 `document-extractor`、`llm` 结构化输出以及回调本地的 `http-request`，我们可以直接复用它，省去繁琐的本地脚本开发！
1.  **准备文件**：将 `CHA23131 Call of Cthulhu 7th Edition Quick-Start Rules.docx` 准备好。
2.  **触发工作流**：使用您的 `DIFY_API_KEY` (`app-Ktvy4LjgQ61ExXURGJ1Yo8D5`) 调用云端 Dify 的 API，传入文件和自定义的 `module_id` (如 `coc_the_haunting`)。
3.  **接收数据**：确保本地后端 (`https://dice-tales-dev.loca.lt`) 正在运行并可以接收 Dify 发来的结构化 JSON 回调。

## 阶段二：DSL 调优与系统接入
1.  **评估提取质量**：检查 Dify 传回的 `coc_the_haunting.json`。
2.  **修改 DSL 提示词（如有必要）**：如果发现提取的剧情有缺失，我可以**直接修改您的 `dify_workflow\模组提取.yml`**（例如：在 Prompt 中强化对“理智检定”或“关键线索”的提取要求），然后您可以将更新后的 DSL 导回 Dify 再次运行。
3.  **前端适配**：在 `dice-tales/lib/gameData.ts` 的 `MODULES` 列表加入该模组展示信息。

## 阶段四：架构跑通与验证
在前端创建角色，选择新模组，重点测试地点移动、检定下发（`required_check`）和物品获取。

---

## 🌟 长效运营方案：模组自动化结构化流水线

对于日后收集的大量 COC/DND 模组，为了避免重复性的复制粘贴劳动，建议采用**“大模型解析 + 可视化微调”**的半自动化流水线：

### 0. 引入 Dify MCP 深度联动（全新升级）
为了让 AI 助手能够直接介入您的 Dify 工作流管理，我们将建立 Dify MCP 连接：
*   **配置 Dify MCP Server**：在开发环境中配置接入 Dify 的 MCP Server（如果您已有现成的可以直接添加，若没有我们可以快速编写一个简单的 REST 到 MCP 的桥接服务）。
*   **AI 直连修改**：连接成功后，我将获得直接读取和修改 Dify Workflow/Text Generator 配置的能力。这意味着当我发现 JSON 解析结构有偏差时，我可以**直接修改您 Dify 里的 Prompt 和 Schema 配置**，无需您在 Dify 网页端和代码编辑器之间来回搬运代码。

**✅ Dify 配置信息已确认：**
1.  **环境**：云端版 (dify.ai)
2.  **Base URL**：`https://api.dify.ai/v1`
3.  **API Key**：`app-Ktvy4LjgQ61ExXURGJ1Yo8D5`
4.  **同步方式**：后续您只需将导出的 DSL 文件 (如 `module_parser.yml`) 放入项目中，我即可直接读取并帮您修改 Prompt 和节点配置。修改后您在 Dify 中导入覆盖即可。

### 1. 深度复用 Dify 工作流（Text Generator / Workflow）
既然您已经在 Dify 中跑通了生成 JSON 的流程，我们可以直接将其无缝集成到自动化流水线中，完美复用：
*   **Dify 端配置**：在 Dify 中建立一个“文本生成 (Text Generator)”或“工作流 (Workflow)”应用。将您目前调优好的 Prompt 固化在里面，并利用 Dify 的配置限定其输出标准的 JSON 格式。
*   **后端 API 桥接**：修改当前 `backend/main.py` 中的 `ai_structure_module` 函数。不再直接调用底层的 OpenRouter/Claude，而是通过调用 Dify 的 API（如 `/workflows/run` 或 `/completion-messages`），将解析好的文本（甚至直接是文件）传给 Dify，由 Dify 完成所有解析工作并返回 JSON。
*   **优势**：您可以随时在 Dify 的可视化界面中调整提取 Prompt 和模型参数，无需修改和重启代码服务。

### 2. 开发“可视化模组编辑器 (Admin CMS)”（强烈推荐）
100% 依赖 AI 可能会导致“地点连接不上”或“线索遗漏”。最好的运营工作流是：
1. 运营在后台点击“上传模组文档”。
2. 系统调用 AI 花费 1-2 分钟生成 JSON。
3. **前端渲染出一个“模组编辑台”**：
   * 左侧是提取出的原文。
   * 右侧是可视化的表单（地点节点图、NPC 列表、事件列表）。
4. 运营人员进行快速的人工校验和微调，然后点击“一键上架发布”。

### 3. 建立“规则化提示词库 (Prompt Library)”
根据跑团规则不同，建立针对性的系统提示词：
*   **COC 专属 Prompt**：强制 AI 提取出“核心线索链”、“理智检定触发点 (Sanity Checks)”和“疯狂症状”。
*   **DND 专属 Prompt**：强制 AI 提取出“怪物数值 (AC/HP)”、“战利品掉落 (Loot)”和“环境陷阱豁免 (Traps)”。

通过这套方案，您处理一个 5 万字的模组文档，可能只需要 **AI 处理 2 分钟 + 人工微调 10 分钟** 即可完成上架，极大地降低运营成本。