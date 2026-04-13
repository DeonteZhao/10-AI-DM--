from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from backend.domain.coc.core import CocScenario

MODULE_ID = "coc_zhuishuren"
MODULE_TITLE = "追书人"
SOURCE_TYPE = "seed_docx"
FALLBACK_SOURCE_TYPE = "seed_builtin"
DOCX_FILE_NAME = "入门套装：模组追书人.docx"

FALLBACK_SECTIONS = {
  "keeper_background": "道格拉斯·金博尔是一位与世隔绝的爱书人。他在墓地附近长期研究禁忌知识，最终主动投向食尸鬼的地下世界。如今地下通路即将封闭，他回到旧居，只想悄悄取回自己最珍视的书，不愿再伤害任何人。",
  "player_hook": "请向玩家朗读或转述以下文字：托马斯·金博尔焦虑地请调查员调查一起离奇的偷书案，并顺便查明叔叔道格拉斯一年前失踪的原因。最近连续几晚，都有人潜入书房，只取走道格拉斯生前最珍视的一批书。托马斯愿意承担调查开销，并提供十美元酬金与暂住的房间。",
  "opening_investigation": "调查从金博尔家开始。书房窗户留有夜间入侵的痕迹，失窃书目则全都与道格拉斯有关。调查员很快会意识到，这不像普通窃贼随机作案，更像熟悉环境的人在取回旧物。",
  "neighbors": "附近居民大多不愿多谈，但老妇人莉拉·奥黛尔记得，道格拉斯生前经常抱着书走向墓地，在墓碑旁一坐就是大半天。她还听说，近来夜里偶尔有人影在墓地周边活动。",
  "cemetery": "白天的公墓看似平静，只有老树与墓碑投下阴影。守墓人梅洛迪亚斯·杰弗逊起初不愿合作，但会承认自己见过深夜徘徊的人影，地点正靠近道格拉斯最喜欢停留的那块旧墓碑。",
  "library": "阿诺兹堡图书馆保存着旧报纸与地方档案。调查员能找到十多年前关于墓地怪异脚印、深夜怪人和道格拉斯失踪的零散记录，这些材料暗示墓地下方可能藏着不为人知的通路。",
  "police": "警方档案显示，附近并无相似的连续盗窃案，既有嫌犯也与本案作案方式不符。值班警官对旧案兴趣不大，却无意间证实墓地与道格拉斯失踪案都曾被人上报。",
  "next_steps": "随着线索汇合，调查重点会集中到金博尔家、公墓、旧墓碑与夜间监视。调查员需要决定是继续白天取证，还是在夜里守候人影现身。",
  "gravestone": "道格拉斯最喜欢的旧墓碑附近留有怪异足迹，像成年人留下的偶蹄状赤足印，并一路延伸到一座尘封陵墓。陵墓后方隐藏着通往地下泥土隧道的入口。",
  "stakeout": "夜里监视时，调查员会看见一个瘦长而扭曲的人影自公墓而来，熟练地潜入金博尔家书房取书，再试图抱着书返回墓地。若跟踪或拦截他，故事便进入高潮。",
  "epilogue": "真相揭开后，调查员可以选择与道格拉斯交谈、攻击他、隐瞒事实，或把一切告诉托马斯与外界。不同选择会改变理智损失、人情后果与这个夜晚留下的余波。",
  "appendix": "托马斯·金博尔是委托人；莉拉·奥黛尔是目击证人；梅洛迪亚斯·杰弗逊是守墓人；道格拉斯·金博尔则是保有人性的半食尸鬼。模组核心不是战斗，而是调查、判断与如何面对非人的真相。"
}


def project_root() -> Path:
  return Path(__file__).resolve().parents[3]


def default_docx_path() -> Path:
  return project_root() / "模组" / "COC" / DOCX_FILE_NAME


def extract_docx_paragraphs(path: str | Path) -> list[str]:
  resolved = Path(path)
  try:
    with zipfile.ZipFile(resolved) as archive:
      data = archive.read("word/document.xml")
  except (FileNotFoundError, KeyError, zipfile.BadZipFile) as exc:
    raise ValueError(f"DOCX 读取失败: {resolved}") from exc
  ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
  root = ET.fromstring(data)
  raw_paragraphs = [
    "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
    for paragraph in root.findall(".//w:p", ns)
  ]
  normalized_paragraphs: list[str] = []
  for paragraph in raw_paragraphs:
    cleaned = compact_text(paragraph)
    if not cleaned:
      continue
    if cleaned in {"追书人", "第三卷", "左", "对页"}:
      continue
    if re.fullmatch(r"\d+", cleaned):
      continue
    normalized_paragraphs.append(cleaned)
  return normalized_paragraphs


def compact_text(value: str) -> str:
  return re.sub(r"\s+", " ", value).strip()


def join_paragraphs(paragraphs: list[str]) -> str:
  return "\n\n".join(item for item in paragraphs if item).strip()


def split_paragraph_blocks(value: str) -> list[str]:
  return [item.strip() for item in re.split(r"\n\s*\n", value) if item.strip()]


def first_paragraph(value: str) -> str:
  blocks = split_paragraph_blocks(value)
  return blocks[0] if blocks else compact_text(value)


def sanitize_player_summary(value: str) -> str:
  summary = first_paragraph(value)
  marker = "请向玩家朗读或转述以下文字："
  if marker in summary:
    summary = summary.split(marker, 1)[1].strip()
  return compact_text(summary)


def remaining_paragraphs(value: str) -> str:
  blocks = split_paragraph_blocks(value)
  return join_paragraphs(blocks[1:]) if len(blocks) > 1 else ""


def find_heading_index(paragraphs: list[str], heading: str, start: int = 0) -> int:
  for index in range(start, len(paragraphs)):
    if heading in paragraphs[index]:
      return index
  raise ValueError(f"未找到标题: {heading}")


def section_between(paragraphs: list[str], start_heading: str, end_headings: list[str] | None = None) -> str:
  start_index = find_heading_index(paragraphs, start_heading) + 1
  end_index = len(paragraphs)
  for heading in end_headings or []:
    try:
      candidate = find_heading_index(paragraphs, heading, start_index)
    except ValueError:
      continue
    end_index = min(end_index, candidate)
  return join_paragraphs(paragraphs[start_index:end_index])


def require_expected_docx(paragraphs: list[str]) -> None:
  required_markers = [
    MODULE_TITLE,
    "托马斯·金博尔",
    "道格拉斯·金博尔",
    "监视屋子或墓地",
    "尾声",
  ]
  for marker in required_markers:
    if not any(marker in paragraph for paragraph in paragraphs):
      raise ValueError(f"DOCX 内容校验失败，缺少关键标记: {marker}")


def extract_sections(paragraphs: list[str]) -> dict[str, str]:
  return {
    "keeper_background": section_between(paragraphs, "守秘人信息：模组背景", ["玩家信息"]),
    "player_hook": section_between(paragraphs, "玩家信息", ["开始调查"]),
    "opening_investigation": section_between(paragraphs, "开始调查", ["询问附近居民"]),
    "neighbors": section_between(paragraphs, "询问附近居民", ["查看墓地周边"]),
    "cemetery": section_between(paragraphs, "查看墓地周边", ["图书馆中的调查"]),
    "library": section_between(paragraphs, "图书馆中的调查", ["询问警方"]),
    "police": section_between(paragraphs, "询问警方", ["接下来的行动"]),
    "next_steps": section_between(paragraphs, "接下来的行动", ["检查道格拉斯·金博尔最喜欢的墓碑"]),
    "gravestone": section_between(paragraphs, "检查道格拉斯·金博尔最喜欢的墓碑", ["监视屋子或墓地"]),
    "stakeout": section_between(paragraphs, "监视屋子或墓地", ["尾声"]),
    "epilogue": section_between(paragraphs, "尾声", ["追书人：非玩家角色与怪物"]),
    "appendix": section_between(paragraphs, "追书人：非玩家角色与怪物"),
  }


def load_seed_sections(docx_path: str | Path | None = None) -> tuple[dict[str, str], str, Path, int, str | None]:
  resolved_docx_path = Path(docx_path or default_docx_path()).resolve()
  try:
    paragraphs = extract_docx_paragraphs(resolved_docx_path)
    require_expected_docx(paragraphs)
    sections = extract_sections(paragraphs)
    return sections, SOURCE_TYPE, resolved_docx_path, len(paragraphs), None
  except ValueError as exc:
    return dict(FALLBACK_SECTIONS), FALLBACK_SOURCE_TYPE, resolved_docx_path, 0, str(exc)


def build_scenario_from_sections(
  sections: dict[str, str],
  source_type: str,
  source_path: str | Path,
  paragraph_count: int,
  fallback_reason: str | None = None
) -> CocScenario:
  player_summary = sanitize_player_summary(sections["player_hook"])
  player_opening_context = remaining_paragraphs(sections["player_hook"])
  resolved_source_path = Path(source_path).resolve()
  payload: dict[str, Any] = {
    "module_id": MODULE_ID,
    "source_type": source_type,
    "status": "draft",
    "rule_system": "coc",
    "title": MODULE_TITLE,
    "tone": "调查、怪诞、克制恐怖",
    "core_conflict": "调查员受托追查失踪叔叔与失窃藏书，却发现道格拉斯·金博尔已经以食尸鬼形态返回旧居，只想在地下世界封路前取回自己的书。",
    "themes": ["COC", "调查", "失踪", "墓地", "食尸鬼", "书籍"],
    "background": player_summary,
    "locations": [
      {
        "id": "loc_kimball_house",
        "name": "金博尔家",
        "description": compact_text(f"{sections['player_hook']} {sections['stakeout'][:180]}"),
        "connections": ["loc_study", "loc_neighborhood", "loc_cemetery"],
        "npcs": ["托马斯·金博尔"],
        "type": "residence",
        "atmosphere": "看似平静的民宅被夜间失窃与失踪谜团笼罩。"
      },
      {
        "id": "loc_study",
        "name": "书房",
        "description": "失窃现场。窗户是夜间入侵的关键通道，缺失的全是道格拉斯·金博尔最珍视的书籍。",
        "connections": ["loc_kimball_house"],
        "npcs": [],
        "type": "interior",
        "hidden_clues": "从被拿走的书目与窗户痕迹里能看出窃贼十分熟悉这里。"
      },
      {
        "id": "loc_neighborhood",
        "name": "墓地周边住宅",
        "description": sections["neighbors"],
        "connections": ["loc_kimball_house", "loc_cemetery"],
        "npcs": ["莉拉·奥黛尔"],
        "type": "street",
        "atmosphere": "邻里冷清，只偶尔有人记得过去总抱着书走向墓地的道格拉斯。"
      },
      {
        "id": "loc_library",
        "name": "阿诺兹堡图书馆",
        "description": sections["library"],
        "connections": ["loc_kimball_house", "loc_police"],
        "npcs": [],
        "type": "archive",
        "atmosphere": "旧报纸与地方档案能把多年以前的异闻拼起来。"
      },
      {
        "id": "loc_police",
        "name": "阿诺兹堡警局",
        "description": sections["police"],
        "connections": ["loc_library", "loc_kimball_house"],
        "npcs": [],
        "type": "office",
        "atmosphere": "官方记录平淡，却间接确认墓地与道格拉斯失踪案都曾引起注意。"
      },
      {
        "id": "loc_cemetery",
        "name": "公墓",
        "description": compact_text(f"{sections['cemetery']} {sections['next_steps'][:220]}"),
        "connections": ["loc_kimball_house", "loc_neighborhood", "loc_mausoleum"],
        "npcs": ["梅洛迪亚斯·杰弗逊", "道格拉斯·金博尔"],
        "type": "graveyard",
        "atmosphere": "老树、灌木和墓碑之间隐藏着夜行者与地下入口的痕迹。"
      },
      {
        "id": "loc_mausoleum",
        "name": "旧陵墓",
        "description": sections["gravestone"],
        "connections": ["loc_cemetery", "loc_tunnels"],
        "npcs": [],
        "type": "mausoleum",
        "atmosphere": "门后积着腐臭与闷气，入口通往更不该被人看见的世界。"
      },
      {
        "id": "loc_tunnels",
        "name": "墓地下隧道",
        "description": sections["gravestone"],
        "connections": ["loc_mausoleum"],
        "npcs": ["道格拉斯·金博尔"],
        "type": "underground",
        "atmosphere": "泥土迷宫与食尸鬼通路相连，光线与方向感都会被迅速吞没。"
      }
    ],
    "npcs": [
      {
        "id": "npc_thomas_kimball",
        "name": "托马斯·金博尔",
        "description": "失主与委托人，道格拉斯的侄子，担心叔叔下落，也担心夜里再有人闯进书房。",
        "type": "client",
        "personality": "礼貌、焦虑、愿意付酬金解决问题。",
        "secrets": "他只知道叔叔已经失踪一年，不知道叔叔如今与公墓和食尸鬼相连。",
        "appearance": "白发秃顶、戴圆框眼镜的描述来自他对叔叔的回忆，而他本人更显疲惫与紧张。"
      },
      {
        "id": "npc_lila_odell",
        "name": "莉拉·奥黛尔",
        "description": "住在附近的老妇人，记得道格拉斯常常抱着书走向墓地。",
        "type": "witness",
        "personality": "看重体面，愿意和顺眼的人短暂交谈。",
        "secrets": "她不知道真相，但能证明道格拉斯与墓地有长期联系。"
      },
      {
        "id": "npc_jefferson",
        "name": "梅洛迪亚斯·杰弗逊",
        "description": "守墓人，认识道格拉斯，也知道墓地里夜里曾出现可疑人影。",
        "type": "gatekeeper",
        "personality": "粗鲁、警惕，但并非恶意。",
        "secrets": "他害怕自己看见的是道格拉斯的鬼魂，因此刻意隐瞒更多细节。",
        "appearance": "58 岁，穿着打补丁的衣服，手边常带铁铲。",
        "extra": {
          "stats": {
            "hp": 12,
            "fighting_brawl": "30%",
            "shovel": "30%",
            "dodge": "25%"
          }
        }
      },
      {
        "id": "npc_douglas_kimball",
        "name": "道格拉斯·金博尔",
        "description": "曾是离群索居的爱书人，如今以半食尸鬼的形态往返于墓地与地下世界，只想取回自己的书。",
        "type": "truth_bearer",
        "subtype": "ghoul",
        "personality": "友善、执拗、仍保留人性与求知欲。",
        "secrets": "他主动投向食尸鬼生活，准备在地下世界继续阅读与写作，并不打算再回到人类社会。",
        "appearance": "赤裸、满身泥土与霉菌，长着蹄状双足与犬科面部特征，却仍与失踪前的道格拉斯相似。",
        "combat_behavior": "若被逼迫会闪避、抓挠并尽快逃回墓地。",
        "extra": {
          "stats": {
            "hp": 12,
            "claw": "50%",
            "bite": "50%",
            "dodge": "30%",
            "armor": "枪械伤害减半"
          },
          "sanity_loss": "目击食尸鬼 0/1D6"
        }
      }
    ],
    "events": [
      {
        "trigger": "调查员从邻居、图书馆、警局或守墓人处拼出同一条线索链。",
        "result": "注意力被集中到金博尔家、公墓、道格拉斯最喜欢的墓碑与夜间监视上。",
        "type": "investigation"
      },
      {
        "trigger": "调查员打开陵墓或深入隧道。",
        "result": "会暴露恶臭、迷路风险，以及与地下世界相连的真相。",
        "type": "exploration"
      },
      {
        "trigger": "调查员在夜间监视或对抗人影。",
        "result": "故事进入高潮，可能导向交谈、战斗、失踪或平静收场。",
        "type": "climax"
      }
    ],
    "quests": [
      {
        "name": "查明失窃与失踪",
        "goal": "确认谁在偷书、道格拉斯·金博尔是否还活着，以及此案是否与墓地有关。",
        "status": "active"
      },
      {
        "name": "锁定墓地真相",
        "goal": "从墓碑、守墓人、旧报纸和警方记录中找出能把夜间人影与墓地下隧道联系起来的证据。"
      },
      {
        "name": "决定结局",
        "goal": "在交谈、攻击、隐瞒或公开真相之间做出选择，并承担理智与后果。"
      }
    ],
    "sequence": [
      {
        "id": "scene_arrival",
        "title": "抵达金博尔家",
        "location_id": "loc_kimball_house",
        "order": 0,
        "description": sections["player_hook"],
        "prerequisites": []
      },
      {
        "id": "scene_neighbors",
        "title": "询问附近居民",
        "location_id": "loc_neighborhood",
        "order": 1,
        "description": sections["neighbors"],
        "prerequisites": ["scene_arrival"]
      },
      {
        "id": "scene_library",
        "title": "翻查图书馆旧报",
        "location_id": "loc_library",
        "order": 2,
        "description": sections["library"],
        "prerequisites": ["scene_arrival"]
      },
      {
        "id": "scene_police",
        "title": "询问警局记录",
        "location_id": "loc_police",
        "order": 3,
        "description": sections["police"],
        "prerequisites": ["scene_arrival"]
      },
      {
        "id": "scene_cemetery_day",
        "title": "白天调查公墓",
        "location_id": "loc_cemetery",
        "order": 4,
        "description": sections["cemetery"],
        "prerequisites": ["scene_arrival"]
      },
      {
        "id": "scene_study",
        "title": "检查失窃书房",
        "location_id": "loc_study",
        "order": 5,
        "description": "调查员重新检查入室路径、失窃书目与窗户痕迹，为夜间守候做准备。",
        "prerequisites": ["scene_arrival"]
      },
      {
        "id": "scene_gravestone",
        "title": "检查道格拉斯最喜欢的墓碑",
        "location_id": "loc_cemetery",
        "order": 6,
        "description": sections["gravestone"],
        "prerequisites": ["scene_cemetery_day"]
      },
      {
        "id": "scene_mausoleum",
        "title": "打开旧陵墓",
        "location_id": "loc_mausoleum",
        "order": 7,
        "description": sections["gravestone"],
        "prerequisites": ["scene_gravestone"]
      },
      {
        "id": "scene_tunnels",
        "title": "探索墓地下隧道",
        "location_id": "loc_tunnels",
        "order": 8,
        "description": sections["gravestone"],
        "prerequisites": ["scene_mausoleum"]
      },
      {
        "id": "scene_stakeout",
        "title": "监视屋子或墓地",
        "location_id": "loc_kimball_house",
        "order": 9,
        "description": sections["stakeout"],
        "prerequisites": ["scene_cemetery_day"]
      },
      {
        "id": "scene_confrontation",
        "title": "与夜间人影对峙",
        "location_id": "loc_cemetery",
        "order": 10,
        "description": sections["stakeout"],
        "prerequisites": ["scene_stakeout"]
      },
      {
        "id": "scene_epilogue",
        "title": "尾声与收束",
        "location_id": "loc_kimball_house",
        "order": 11,
        "description": sections["epilogue"],
        "prerequisites": ["scene_confrontation"]
      }
    ],
    "triggers": [
      {
        "id": "trigger_inspect_gravestone",
        "name": "在墓地检查墓碑",
        "once": True,
        "conditions": [
          {"type": "location", "value": "loc_cemetery"},
          {"type": "action", "value": "墓碑"}
        ],
        "actions": [
          {"type": "reveal_clue", "target_id": "clue_gravestone_footprints"},
          {"type": "branch_scene", "target_id": "scene_gravestone"}
        ]
      },
      {
        "id": "trigger_open_mausoleum",
        "name": "撬开陵墓入口",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_gravestone"},
          {"type": "action", "value": "陵墓"}
        ],
        "actions": [
          {"type": "reveal_clue", "target_id": "clue_tunnel_entrance"},
          {"type": "branch_scene", "target_id": "scene_mausoleum"},
          {"type": "move_location", "target_id": "loc_mausoleum"}
        ]
      },
      {
        "id": "trigger_enter_tunnels",
        "name": "深入墓地下隧道",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_mausoleum"},
          {"type": "action", "value": "隧道"}
        ],
        "actions": [
          {"type": "branch_scene", "target_id": "scene_tunnels"},
          {"type": "move_location", "target_id": "loc_tunnels"}
        ]
      },
      {
        "id": "trigger_watch_figure",
        "name": "夜里监视并发现人影",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_stakeout"},
          {"type": "action", "value": "监视"}
        ],
        "actions": [
          {"type": "reveal_clue", "target_id": "clue_night_figure"},
          {"type": "grant_handout", "target_id": "handout_case_brief"},
          {"type": "branch_scene", "target_id": "scene_confrontation"},
          {"type": "move_location", "target_id": "loc_cemetery"}
        ]
      },
      {
        "id": "trigger_talk_douglas",
        "name": "与道格拉斯交谈",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_confrontation"},
          {"type": "action", "value": "道格拉斯"}
        ],
        "actions": [
          {"type": "reveal_clue", "target_id": "clue_douglas_truth"},
          {"type": "grant_handout", "target_id": "handout_douglas_confession"},
          {"type": "update_state", "payload": {"ending_hint": "truth", "douglas_outcome": "talked"}},
          {"type": "branch_scene", "target_id": "scene_epilogue"},
          {"type": "move_location", "target_id": "loc_kimball_house"}
        ]
      },
      {
        "id": "trigger_attack_figure",
        "name": "攻击夜间人影",
        "once": True,
        "conditions": [
          {"type": "scene", "value": "scene_confrontation"},
          {"type": "action", "value": "攻击"}
        ],
        "actions": [
          {"type": "update_state", "payload": {"ending_hint": "violence", "douglas_outcome": "attacked"}},
          {"type": "branch_scene", "target_id": "scene_epilogue"},
          {"type": "move_location", "target_id": "loc_kimball_house"}
        ]
      }
    ],
    "clues": [
      {
        "id": "clue_missing_books",
        "title": "被盗目标是道格拉斯的旧书",
        "content": "窃贼只取走道格拉斯·金博尔最喜欢的那批书，说明他的目标不是钱，而是特定藏书。",
        "source": "金博尔家书房",
        "visibility": "explicit",
        "discovery_conditions": ["scene:scene_study", "action:书"],
        "discovery_method": "调查失窃现场"
      },
      {
        "id": "clue_douglas_loved_cemetery",
        "title": "道格拉斯经常抱书去墓地",
        "content": "邻居确认道格拉斯生前经常抱着书走向墓地，并在那儿长时间阅读。",
        "source": "莉拉·奥黛尔",
        "visibility": "explicit",
        "discovery_conditions": ["scene:scene_neighbors", "action:金博尔"],
        "discovery_method": "询问附近居民"
      },
      {
        "id": "clue_jefferson_hid_figure",
        "title": "守墓人见过深夜人影",
        "content": "梅洛迪亚斯·杰弗逊承认曾在道格拉斯常坐的墓碑附近见到深夜人影，却不敢接近。",
        "source": "梅洛迪亚斯·杰弗逊",
        "visibility": "explicit",
        "discovery_conditions": ["scene:scene_cemetery_day", "action:杰弗逊"],
        "discovery_method": "交谈或施压守墓人"
      },
      {
        "id": "clue_newspaper_footprints",
        "title": "旧报纸记录了墓地怪异脚印",
        "content": "十多年前就有人报告墓地深夜有怪人狂欢，警方虽未抓到人，却找到形状怪异的脚印。",
        "source": "《阿诺兹堡广告报》",
        "visibility": "explicit",
        "discovery_conditions": ["scene:scene_library", "action:报纸"],
        "discovery_method": "图书馆使用"
      },
      {
        "id": "clue_police_archive",
        "title": "警方记录与盗窃习惯不符",
        "content": "附近近年没有同类盗窃案，既有窃贼也仍在服刑，这让本案更像熟人取回旧物而非普通飞贼作案。",
        "source": "警局记录",
        "visibility": "explicit",
        "discovery_conditions": ["scene:scene_police", "action:警"],
        "discovery_method": "询问值班警官"
      },
      {
        "id": "clue_gravestone_footprints",
        "title": "墓碑旁有偶蹄状赤足印",
        "content": "道格拉斯最喜欢的墓碑周围留有奇怪足迹，像偶蹄状的成年人赤足印，并一路通向陵墓。",
        "source": "墓碑周边",
        "visibility": "hidden",
        "trigger_ref": "trigger_inspect_gravestone",
        "discovery_method": "侦查或追踪"
      },
      {
        "id": "clue_tunnel_entrance",
        "title": "陵墓后方藏着地底入口",
        "content": "陵墓门后是一条徒手挖掘出的隧道，通向遍布墓地地下的泥土迷宫。",
        "source": "旧陵墓",
        "visibility": "hidden",
        "trigger_ref": "trigger_open_mausoleum",
        "discovery_method": "强行打开陵墓"
      },
      {
        "id": "clue_night_figure",
        "title": "夜里的人影会回书房偷书",
        "content": "监视能确认人影从公墓进入金博尔家书房，并在片刻后抱着书返回墓地。",
        "source": "夜间监视",
        "visibility": "explicit",
        "trigger_ref": "trigger_watch_figure",
        "discovery_method": "幸运检定后的蹲守"
      },
      {
        "id": "clue_douglas_truth",
        "title": "人影正是食尸鬼化的道格拉斯",
        "content": "道格拉斯坦承自己已投向食尸鬼世界，只是想在入口封闭前取回旧书，并不打算再扰乱侄子的生活。",
        "source": "与道格拉斯交谈",
        "visibility": "explicit",
        "trigger_ref": "trigger_talk_douglas",
        "discovery_method": "礼貌对话",
        "gm_notes": "该真相会伴随理智损失，也可能带来克苏鲁神话增长。"
      }
    ],
    "handouts": [
      {
        "id": "handout_case_brief",
        "title": "托马斯的委托",
        "content": sections["player_hook"],
        "type": "text",
        "grant_conditions": ["scene:scene_arrival", "action:委托"],
        "add_to_inventory": True
      },
      {
        "id": "handout_newspaper_clip",
        "title": "旧报纸剪报",
        "content": sections["library"],
        "type": "text",
        "grant_conditions": ["scene:scene_library", "action:报纸"],
        "add_to_inventory": True
      },
      {
        "id": "handout_douglas_confession",
        "title": "道格拉斯的真相",
        "content": sections["stakeout"],
        "type": "text",
        "grant_conditions": ["trigger:trigger_talk_douglas"],
        "add_to_inventory": True
      }
    ],
    "scene_items": [
      {
        "id": "item_study_window",
        "name": "书房窗户",
        "location_id": "loc_study",
        "description": "夜里的人影正是通过这扇窗户进出书房取书。",
        "interactions": ["检查窗户", "搜索书房", "确认失窃书目"],
        "linked_clue_ids": ["clue_missing_books"]
      },
      {
        "id": "item_favorite_gravestone",
        "name": "道格拉斯最喜欢的墓碑",
        "location_id": "loc_cemetery",
        "description": "一块因长期风化而难辨墓主的旧墓碑，也是道格拉斯过去最常坐着读书的地方。",
        "interactions": ["检查墓碑", "寻找足迹", "等待夜晚"],
        "linked_clue_ids": ["clue_gravestone_footprints", "clue_jefferson_hid_figure"]
      },
      {
        "id": "item_jefferson_shovel",
        "name": "守墓人的铁铲",
        "location_id": "loc_cemetery",
        "description": "杰弗逊工作时离不开的工具，也提醒调查员他并不怕动手赶人。",
        "interactions": ["交谈", "观察酒瓶", "施压"],
        "linked_clue_ids": ["clue_jefferson_hid_figure"]
      },
      {
        "id": "item_mausoleum_door",
        "name": "陵墓石门",
        "location_id": "loc_mausoleum",
        "description": "沉重石门后封着恶臭与一条直通地下的通道。",
        "interactions": ["撬开陵墓", "屏住呼吸", "进入隧道"],
        "linked_clue_ids": ["clue_tunnel_entrance"]
      },
      {
        "id": "item_tunnel_junction",
        "name": "泥土岔路",
        "location_id": "loc_tunnels",
        "description": "墓地地下的泥土迷宫，缺乏方向感会让人被黑暗吞没。",
        "interactions": ["导航", "追踪", "聆听"],
        "linked_clue_ids": ["clue_douglas_truth"]
      }
    ],
    "assets": [],
    "extensions": {
      "keeper_background": sections["keeper_background"],
      "player_hook": sections["player_hook"],
      "player_summary": player_summary,
      "player_opening_context": player_opening_context,
      "player_opening_statement": "托马斯·金博尔搓了搓手，语气里满是掩不住的焦虑：“我想请你调查这起偷书案，也看看能不能查明我叔叔道格拉斯失踪的原因。我会承担你在调查期间的各类花销，另外再付你整整 10 美元作为报酬。说实话，我还没有把这起入室盗窃案报给警方——丢的只是一些书，他们多半不会认真追查，也不值得为这点事投入太多资源。至于我叔叔，道格拉斯·金博尔，白发、秃顶、中等身高，总戴着一副圆框眼镜。要是你愿意接手这件事，也可以直接住在我家空着的房间里，调查起来总归方便些。”",
      "player_opening_options": [
        "询问附近居民",
        "查看墓地周边",
        "在图书馆调查本地消息",
        "询问警方",
        "查阅本地报纸《阿诺兹堡广告报》的旧刊",
        "查看金博尔家周边"
      ],
      "docx_seed": {
        "source_name": resolved_source_path.name,
        "source_path": str(resolved_source_path),
        "paragraph_count": paragraph_count,
        "module_id": MODULE_ID,
        "fallback_used": fallback_reason is not None,
        "fallback_reason": fallback_reason
      },
      "raw_sections": sections
    },
    "custom_types": [],
    "schema_version": 3
  }
  return CocScenario.model_validate(payload)


def build_scenario_from_docx(docx_path: str | Path | None = None) -> CocScenario:
  sections, source_type, resolved_docx_path, paragraph_count, fallback_reason = load_seed_sections(docx_path)
  return build_scenario_from_sections(
    sections=sections,
    source_type=source_type,
    source_path=resolved_docx_path,
    paragraph_count=paragraph_count,
    fallback_reason=fallback_reason
  )


def write_seed_scenario_to_system(
  docx_path: str | Path | None = None,
  storage_dir: str | Path | None = None
) -> dict[str, Any]:
  import backend.main as backend_main

  resolved_storage_dir = Path(storage_dir).resolve() if storage_dir else None
  original_storage_dir = backend_main.storage_dir
  if resolved_storage_dir:
    resolved_storage_dir.mkdir(parents=True, exist_ok=True)
    backend_main.storage_dir = str(resolved_storage_dir)
  try:
    backend_main.init_db()
    backend_main.load_structured_modules()
    scenario = build_scenario_from_docx(docx_path)
    scenario_source_type = scenario.source_type or SOURCE_TYPE
    draft = backend_main.normalize_structured_module(MODULE_ID, scenario, scenario_source_type, "draft")
    published = backend_main.normalize_structured_module(MODULE_ID, scenario, scenario_source_type, "published")
    validation_errors = backend_main.validate_module_for_publish(draft)
    if validation_errors:
      raise ValueError("；".join(validation_errors))

    existing_draft = backend_main.get_module_draft(MODULE_ID)
    existing_published = backend_main.get_published_scenario(MODULE_ID)
    changed = (
      existing_draft is None
      or existing_published is None
      or existing_draft.model_dump() != draft.model_dump()
      or existing_published.model_dump() != published.model_dump()
    )

    backend_main.draft_modules[MODULE_ID] = draft
    backend_main.structured_modules[MODULE_ID] = published
    backend_main.save_module_draft(MODULE_ID, draft)
    backend_main.save_structured_module(MODULE_ID, published)

    version = None
    if changed:
      version = backend_main.create_module_version(MODULE_ID, published, "published", "seed docx baseline")

    return {
      "module_id": MODULE_ID,
      "title": published.title,
      "draft_saved": True,
      "published_saved": True,
      "version_created": version is not None,
      "version": version,
      "storage_dir": backend_main.storage_dir,
      "docx_path": str(Path(docx_path or default_docx_path()).resolve()),
      "validation_errors": validation_errors
    }
  finally:
    if resolved_storage_dir:
      backend_main.storage_dir = original_storage_dir


def main() -> None:
  result = write_seed_scenario_to_system()
  print(f"module_id={result['module_id']}")
  print(f"title={result['title']}")
  print(f"storage_dir={result['storage_dir']}")
  print(f"docx_path={result['docx_path']}")
  print(f"version_created={result['version_created']}")


if __name__ == "__main__":
  main()
