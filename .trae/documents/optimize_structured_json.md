# 优化结构化模组 JSON 方案

目前的结构化 JSON (StructuredModule) 包含基础的字段（title, background, locations, npcs, events 等）。为了让 AI DM 能够提供更丰富、更沉浸的跑团体验，我们需要在 JSON 结构中补充更多细节信息。

由于 DND 和 CoC 两种规则的侧重点截然不同，我们需要在结构中增加特定的标识，并在内容提取时针对性地补充不同维度的信息。

## 1. 明确模组规则与基调 (Module Meta)

增加全局字段，帮助 AI 把握整体氛围和规则基调。

- **`rule_system` (规则体系)**: 明确是 "dnd" 还是 "coc"。这将影响后续的数据结构和 AI 的判定逻辑。
- **`tone` (氛围/基调)**: 例如 "史诗奇幻" (DND), "洛夫克拉夫特式恐怖" (CoC)。
- **`core_conflict` (核心冲突)**: 一段简短的描述，说明模组的核心矛盾。

## 2. 差异化的地点描述 (StructuredLocation)

不同规则对地点的关注点不同：

- **通用扩展**:
  - **`sensory_details` (感官细节)**: 视觉、听觉、嗅觉描述，增强代入感。
- **DND 侧重 (战斗与探索)**:
  - **`tactical_elements` (战术元素)**: 掩体、高地、危险地形（如岩浆、陷阱）。
  - **`hidden_treasures` (隐藏宝藏)**: 需要察觉检定发现的战利品。
- **CoC 侧重 (调查与恐怖)**:
  - **`atmosphere` (环境压抑度)**: 描述场景如何影响角色的理智（如“令人不安的寂静”）。
  - **`hidden_clues` (隐藏线索)**: 需要侦查或特定知识（如“图书馆利用”）才能发现的线索。

## 3. 差异化的 NPC 设计 (StructuredNpc)

赋予 NPC 更多灵魂，让 AI 扮演时更真实。

- **通用扩展**:
  - **`personality` (性格特征)**: 几个形容词。
  - **`appearance` (外貌特征)**: 显著的外貌特征。
- **DND 侧重 (阵营与战斗)**:
  - **`alignment` (阵营)**: 守序善良、混乱邪恶等。
  - **`combat_behavior` (战斗倾向)**: 懦弱逃跑、死战到底、狡诈偷袭。
- **CoC 侧重 (秘密与动机)**:
  - **`secrets_and_lies` (秘密与谎言)**: NPC 试图隐瞒什么？
  - **`sanity_state` (理智状态)**: 正常、濒临崩溃、已陷入疯狂。

## 4. 细化物品与线索 (StructuredItem & StructuredClue)

- **DND (物品/装备)**:
  - **`magical_properties` (魔法属性)**: 物品的魔法效果和需要“鉴定术”才能知道的信息。
- **CoC (线索/文档)**:
  - **`sanity_cost` (理智代价)**: 阅读该线索（如邪恶典籍）可能造成的 San 值损失（如 1d4/1d8）。
  - **`mythos_knowledge` (克苏鲁神话知识)**: 获得该线索是否会增加克苏鲁神话技能。

## 5. 增强事件与触发器 (StructuredEvent)

- **通用扩展**:
  - **`consequences` (事件后果)**: 对世界状态的影响。
- **DND 侧重**:
  - **`encounter_type` (遭遇类型)**: 战斗、陷阱、社交挑战。
- **CoC 侧重**:
  - **`sanity_check_trigger` (理智检定触发)**: 明确该事件是否会强制触发 San 值检定，以及成功/失败的后果。

## 6. 实施步骤

1.  **修改 Dify Workflow (`模组提取.yml`)**:
    - 更新 Prompt，明确告诉大模型：**“请根据这是 DND 还是 CoC 模组，提取不同侧重点的细节。”**
    - 更新 `structured_output` 的 JSON Schema，使其包含上述新增的差异化字段（可以设计为可选字段，根据 `rule_system` 填充）。
    - **操作说明**：我会在本地修改 `dify_workflow/模组提取.yml` 文件。修改完成后，你需要**手动登录 Dify 网页端**，找到对应的应用（模组提取），选择**“导入”或“恢复”**（Import/Restore from DSL），上传我修改后的 `.yml` 文件来覆盖更新现有的工作流，然后**重新发布**。
2.  **更新后端模型 (`backend/main.py`)**:
    - 更新 Pydantic 模型（如 `StructuredLocation`, `StructuredNpc`, `StructuredModule`），添加新的字段（使用 `Optional` 或特定的子模型）。
3.  **优化 AI DM Context (`build_context_payload`)**:
    - 根据当前游戏的规则类型（DND/CoC），动态选择性地将这些丰富的战术、理智、动机等信息注入到 AI 的 Prompt 中，引导其生成符合规则风格的反馈。

通过这种差异化的结构化设计，DND 的模组会更像一个充满挑战的地下城，而 CoC 的模组则会变成一个充满压抑和未知线索的调查现场。
