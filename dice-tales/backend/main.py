import random
from datetime import datetime
import json
import os
import sqlite3
from typing import Literal, Dict, Any
from uuid import uuid4

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))

import httpx
import fitz
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# --- DND Rules Constants ---
DND_LEVEL_XP = {
    1: 0,
    2: 100,
    3: 300,
    4: 600,
    5: 1000,
    6: 1500,
    7: 2100,
    8: 2800,
    9: 3600,
    10: 4500
}

DND_CLASS_CONFIG = {
    "战士": {
        "hit_die": 10,
        "hp_base": 12, # 12 + CON
        "hp_level": 6,  # Average d10 (5.5->6) + CON
        "features": {
            1: "战斗风格（+1攻击）",
            2: "额外攻击（每回合2次攻击）",
            3: "战技（例如击退敌人）",
            4: "属性+2",
            5: "武器精通（伤害+2）",
            6: "HP+5",
            7: "战斗反击",
            8: "属性+2",
            9: "暴击范围19-20",
            10: "传奇战士（攻击+2）"
        },
        "default_equipment": [
            {"item_ref_id": "base_longsword", "name": "长剑", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": "一把标准的精钢长剑。", "stats": {"damage": "1d8"}},
            {"item_ref_id": "base_chainmail", "name": "链甲", "category": "armor", "origin": "base", "is_equipped": True, "quantity": 1, "description": "金属环编织的重型护甲。", "stats": {"ac_bonus": 16}},
            {"item_ref_id": "base_adventurer_pack", "name": "冒险者背袋", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "包含火把、口粮和绳索的旅行背包。", "stats": {}}
        ]
    },
    "法师": {
        "hit_die": 6,
        "hp_base": 6, # 6 + CON
        "hp_level": 4, # Average d6 (3.5->4) + CON
        "features": {
            1: "2个法术",
            2: "3个法术",
            3: "法术强化（伤害+2）",
            4: "属性+2",
            5: "AOE法术",
            6: "魔力恢复",
            7: "高级法术",
            8: "属性+2",
            9: "双重施法",
            10: "大法师（法术伤害+4）"
        },
        "default_equipment": [
            {"item_ref_id": "base_quarterstaff", "name": "法杖", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": "结实的木制法杖。", "stats": {"damage": "1d6"}},
            {"item_ref_id": "base_scholar_pack", "name": "学者背袋", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "包含羊皮纸、墨水和卷轴轴筒的背包。", "stats": {}}
        ]
    },
    "盗贼": {
        "hit_die": 8,
        "hp_base": 8, # 8 + CON
        "hp_level": 5, # Average d8 (4.5->5) + CON
        "features": {
            1: "潜行专家",
            2: "偷袭（+1d6伤害）",
            3: "闪避",
            4: "属性+2",
            5: "偷袭+2d6",
            6: "快速移动",
            7: "背刺（暴击+50%伤害）",
            8: "属性+2",
            9: "影遁",
            10: "暗影大师（偷袭+3d6）"
        },
        "default_equipment": [
            {"item_ref_id": "base_dagger", "name": "匕首", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 2, "description": "锋利的短兵器，适合暗杀。", "stats": {"damage": "1d4"}},
            {"item_ref_id": "base_leather_armor", "name": "皮甲", "category": "armor", "origin": "base", "is_equipped": True, "quantity": 1, "description": "轻便的皮制护甲。", "stats": {"ac_bonus": 11}},
            {"item_ref_id": "base_thieves_tools", "name": "盗贼工具", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "包含开锁器和小镜子的工具包。", "stats": {}}
        ]
    },
    "牧师": {
        "hit_die": 8,
        "hp_base": 8,
        "hp_level": 5,
        "features": { 1: "神术" },
        "default_equipment": [
            {"item_ref_id": "base_mace", "name": "战锤", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": "沉重的钝器。", "stats": {"damage": "1d6"}},
            {"item_ref_id": "base_scale_mail", "name": "鳞甲", "category": "armor", "origin": "base", "is_equipped": True, "quantity": 1, "description": "金属鳞片制成的护甲。", "stats": {"ac_bonus": 14}},
            {"item_ref_id": "base_holy_symbol", "name": "圣徽", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "施展神术的焦点。", "stats": {}}
        ]
    },
    "游侠": {
        "hit_die": 10,
        "hp_base": 10,
        "hp_level": 6,
        "features": { 1: "宿敌" },
        "default_equipment": [
            {"item_ref_id": "base_longbow", "name": "长弓", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": "射程极远的弓。", "stats": {"damage": "1d8"}},
            {"item_ref_id": "base_arrows", "name": "箭矢", "category": "consumable", "origin": "base", "is_equipped": False, "quantity": 20, "description": "普通的箭矢。", "stats": {}},
            {"item_ref_id": "base_leather_armor", "name": "皮甲", "category": "armor", "origin": "base", "is_equipped": True, "quantity": 1, "description": "轻便的皮制护甲。", "stats": {"ac_bonus": 11}}
        ]
    },
    "术士": {
        "hit_die": 6,
        "hp_base": 6,
        "hp_level": 4,
        "features": { 1: "术法起源" },
        "default_equipment": [
            {"item_ref_id": "base_dagger", "name": "匕首", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": "防身用的短兵器。", "stats": {"damage": "1d4"}},
            {"item_ref_id": "base_arcane_focus", "name": "奥术焦点", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "施展法术的焦点。", "stats": {}}
        ]
    }
}

COC_OCCUPATION_CONFIG = {
    "默认": [
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}},
        {"item_ref_id": "base_notebook", "name": "笔记本和笔", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "用来记录线索。", "stats": {}},
        {"item_ref_id": "base_wallet", "name": "钱包", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "里面有一些零钱和证件。", "stats": {}}
    ],
    "警探": [
        {"item_ref_id": "base_revolver", "name": "左轮手枪", "category": "weapon", "origin": "base", "is_equipped": True, "quantity": 1, "description": ".38口径的警用配枪。", "stats": {"damage": "1d10"}},
        {"item_ref_id": "base_bullets", "name": "子弹", "category": "consumable", "origin": "base", "is_equipped": False, "quantity": 12, "description": ".38口径子弹。", "stats": {}},
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}},
        {"item_ref_id": "base_badge", "name": "警徽", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "身份的象征。", "stats": {}}
    ],
    "医生": [
        {"item_ref_id": "base_medical_kit", "name": "急救包", "category": "consumable", "origin": "base", "is_equipped": False, "quantity": 3, "description": "包含绷带、消毒水和基础药品的急救包。", "stats": {}},
        {"item_ref_id": "base_flashlight", "name": "手电筒", "category": "tool", "origin": "base", "is_equipped": False, "quantity": 1, "description": "普通的便携光源。", "stats": {}}
    ]
}

Role = Literal["ai", "player"]


class ModuleInfo(BaseModel):
  name: str
  description: str
  tags: list[str]


class Location(BaseModel):
  id: str
  name: str
  description: str
  connected_locations: list[str]


class Npc(BaseModel):
  id: str
  name: str
  location: str
  description: str


class Quest(BaseModel):
  id: str
  title: str
  description: str
  objective: str


class Item(BaseModel):
  id: str
  name: str
  description: str


class Event(BaseModel):
  trigger: str
  result: str


class Module(BaseModel):
  id: str
  module_info: ModuleInfo
  locations: list[Location]
  npcs: list[Npc]
  quests: list[Quest]
  items: list[Item]
  events: list[Event]


class SensoryDetails(BaseModel):
  visual: str | None = None
  auditory: str | None = None
  olfactory: str | None = None

class StructuredLocation(BaseModel):
  name: str
  description: str
  connections: list[str]
  npcs: list[str]
  sensory_details: SensoryDetails | None = None
  tactical_elements: str | None = None
  hidden_treasures: str | None = None
  atmosphere: str | None = None
  hidden_clues: str | None = None


class StructuredNpc(BaseModel):
  name: str
  description: str
  secrets: str | None = None
  personality: str | None = None
  appearance: str | None = None
  alignment: str | None = None
  combat_behavior: str | None = None
  secrets_and_lies: str | None = None
  sanity_state: str | None = None


class StructuredEvent(BaseModel):
  trigger: str
  result: str
  consequences: str | None = None
  encounter_type: str | None = None
  sanity_check_trigger: str | None = None


class StructuredQuest(BaseModel):
  name: str
  goal: str


class StructuredSequenceStep(BaseModel):
  id: str
  title: str
  location: str | None = None
  order: int
  description: str
  prerequisites: list[str] = Field(default_factory=list)


class StructuredTriggerCondition(BaseModel):
  type: Literal["location", "action", "state", "check_result"]
  key: str | None = None
  operator: Literal["eq", "contains"] = "eq"
  value: str


class StructuredTriggerAction(BaseModel):
  type: Literal["reveal_clue", "grant_handout", "update_state"]
  target_id: str | None = None
  payload: dict[str, Any] = Field(default_factory=dict)


class StructuredTriggerRule(BaseModel):
  id: str
  name: str
  once: bool = True
  conditions: list[StructuredTriggerCondition] = Field(default_factory=list)
  actions: list[StructuredTriggerAction] = Field(default_factory=list)


class StructuredClue(BaseModel):
  id: str
  title: str
  content: str
  source: str | None = None
  discovery_conditions: list[str] = Field(default_factory=list)
  sanity_cost: str | None = None
  mythos_knowledge: bool | None = None


class StructuredHandout(BaseModel):
  id: str
  title: str
  content: str
  type: Literal["text", "image", "mixed"] = "text"
  asset_ids: list[str] = Field(default_factory=list)
  grant_conditions: list[str] = Field(default_factory=list)
  add_to_inventory: bool = True


class StructuredSceneItem(BaseModel):
  id: str
  name: str
  location: str
  description: str
  interactions: list[str] = Field(default_factory=list)
  linked_clue_ids: list[str] = Field(default_factory=list)
  magical_properties: str | None = None


class StructuredAsset(BaseModel):
  id: str
  name: str
  type: Literal["image", "map", "document", "other"] = "image"
  url: str = ""
  description: str = ""


class StructuredModule(BaseModel):
  rule_system: Literal["dnd", "coc"] = "dnd"
  tone: str | None = None
  core_conflict: str | None = None
  title: str
  background: str
  locations: list[StructuredLocation] = Field(default_factory=list)
  npcs: list[StructuredNpc] = Field(default_factory=list)
  events: list[StructuredEvent] = Field(default_factory=list)
  quests: list[StructuredQuest] = Field(default_factory=list)
  schema_version: int = 2
  sequence: list[StructuredSequenceStep] = Field(default_factory=list)
  triggers: list[StructuredTriggerRule] = Field(default_factory=list)
  clues: list[StructuredClue] = Field(default_factory=list)
  handouts: list[StructuredHandout] = Field(default_factory=list)
  scene_items: list[StructuredSceneItem] = Field(default_factory=list)
  assets: list[StructuredAsset] = Field(default_factory=list)


class AdminAssetCreate(BaseModel):
  id: str | None = None
  name: str
  type: Literal["image", "map", "document", "other"] = "image"
  url: str = ""
  description: str = ""


class CharacterCreate(BaseModel):
  id: str | None = None
  name: str
  type: Literal["dnd", "coc"]
  race: str | None = None
  class_: str | None = Field(default=None, alias="class")
  occupation: str | None = None
  age: int | None = None
  stats: dict[str, int]
  skills: list[str] | dict[str, int]
  items: list[dict]
  backstory: str | None = None

class XPUpdate(BaseModel):
  xp_delta: int

class SkillCheck(BaseModel):
  skill_name: str
  success: bool

class SessionCreate(BaseModel):
  module_id: str
  character_id: str
  user_id: str | None = None


class ActionRequest(BaseModel):
  session_id: str
  message: str
  location: str | None = None
  quest: str | None = None
  game_state: dict | None = None
  player_character: dict | None = None


class ExternalActionRequest(BaseModel):
  session_id: str
  player_action: str
  result: dict | str


class ChatMessage(BaseModel):
  role: Role
  content: str


app = FastAPI()
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"]
)

storage_dir = os.getenv("MODULE_STORAGE_DIR", os.path.join(os.path.dirname(__file__), "storage"))
os.makedirs(storage_dir, exist_ok=True)

modules: dict[str, Module] = {}
structured_modules: dict[str, StructuredModule] = {}
characters: dict[str, dict] = {}
sessions: dict[str, dict] = {}
game_logs: dict[str, list[ChatMessage]] = {}
session_states: dict[str, dict] = {}
ws_clients: dict[str, set[WebSocket]] = {}

modules_data = [
  {
    "id": "lost_mine",
    "module_info": {
      "name": "失落的矿坑",
      "description": "矿井入口阴影重重，失踪矿工与古老线索交织。",
      "tags": ["DND", "中土风", "冒险", "战斗"]
    },
    "locations": [
      {
        "id": "loc_road",
        "name": "崔波镇外的商道",
        "description": "破损马车倒在路边，周围散落着矿工的工具。",
        "connected_locations": ["loc_town", "loc_mine_entrance"]
      },
      {
        "id": "loc_town",
        "name": "崔波镇",
        "description": "镇民人心惶惶，旅店老板暗中观察来客。",
        "connected_locations": ["loc_road", "loc_mine_entrance"]
      },
      {
        "id": "loc_mine_entrance",
        "name": "旧矿坑入口",
        "description": "洞口被塌方掩盖，隐约传来窸窣声。",
        "connected_locations": ["loc_road", "loc_town", "loc_mine_depths"]
      },
      {
        "id": "loc_mine_depths",
        "name": "矿坑深处",
        "description": "黑暗中藏着哥布林的营地与古老符文。",
        "connected_locations": ["loc_mine_entrance"]
      }
    ],
    "npcs": [
      {
        "id": "npc_innkeeper",
        "name": "埃尔达·奥克",
        "location": "loc_town",
        "description": "旅店老板，知道矿工最后一次出现的位置。"
      },
      {
        "id": "npc_guard",
        "name": "里昂·铁盾",
        "location": "loc_road",
        "description": "镇卫兵，怀疑哥布林劫掠但缺乏证据。"
      }
    ],
    "quests": [
      {
        "id": "quest_rescue",
        "title": "寻找失踪矿工",
        "description": "追踪矿工失踪的线索，确定他们的去向。",
        "objective": "进入矿坑并找到矿工遗留下来的证据。"
      },
      {
        "id": "quest_clear",
        "title": "清理矿坑入口",
        "description": "清理塌方障碍，打开通往深处的道路。",
        "objective": "清除入口封锁并安全进入矿坑深处。"
      }
    ],
    "items": [
      {
        "id": "item_pickaxe",
        "name": "矿工镐",
        "description": "磨损严重，但仍能用来撬开碎石。"
      },
      {
        "id": "item_map",
        "name": "旧矿坑地图",
        "description": "标注了矿坑通道和一处被涂抹的房间。"
      }
    ],
    "events": [
      {
        "trigger": "玩家在商道附近调查马车",
        "result": "发现被切断的缰绳，指向哥布林埋伏的痕迹。"
      },
      {
        "trigger": "玩家进入矿坑深处",
        "result": "遭遇哥布林哨兵，触发战斗。"
      }
    ]
  },
  {
    "id": "coc_misty_town",
    "module_info": {
      "name": "迷雾镇的午夜低语",
      "description": "调查迷雾镇连续失踪案，揭开教堂地窖中的古老秘密。",
      "tags": ["CoC", "悬疑", "探案", "恐怖"]
    },
    "locations": [
      {
        "id": "loc_town_square",
        "name": "镇中心广场",
        "description": "喷泉干涸，公告栏贴着失踪者名单。",
        "connected_locations": ["loc_church", "loc_inn", "loc_forest_edge"]
      },
      {
        "id": "loc_church",
        "name": "圣玛利亚教堂",
        "description": "古老石墙布满苔藓，地窖入口被木板封死。",
        "connected_locations": ["loc_town_square", "loc_graveyard"]
      },
      {
        "id": "loc_inn",
        "name": "雾鸦旅馆",
        "description": "旅馆老板消息灵通，深夜常有陌生人出入。",
        "connected_locations": ["loc_town_square"]
      },
      {
        "id": "loc_forest_edge",
        "name": "黑松林入口",
        "description": "林中常有低语，通向废弃的旧矿坑。",
        "connected_locations": ["loc_town_square", "loc_old_mine"]
      },
      {
        "id": "loc_graveyard",
        "name": "旧墓园",
        "description": "墓碑残缺，最近多出几座新坟。",
        "connected_locations": ["loc_church"]
      },
      {
        "id": "loc_old_mine",
        "name": "旧矿坑",
        "description": "洞口塌方，空气中混杂着古怪的腥味。",
        "connected_locations": ["loc_forest_edge"]
      }
    ],
    "npcs": [
      {
        "id": "npc_innkeeper_coc",
        "name": "艾琳·布莱克",
        "location": "loc_inn",
        "description": "旅馆老板，表面热情，知道失踪者最后出现的时间。"
      },
      {
        "id": "npc_priest_coc",
        "name": "格雷修士",
        "location": "loc_church",
        "description": "神情焦虑，否认教堂地窖存在异常。"
      },
      {
        "id": "npc_hunter_coc",
        "name": "马库斯·雷德",
        "location": "loc_forest_edge",
        "description": "镇外猎人，声称在林中见过怪影。"
      }
    ],
    "quests": [
      {
        "id": "quest_missing",
        "title": "追查失踪者",
        "description": "收集线索，确认失踪者最后出现的地点。",
        "objective": "找出失踪案的共同点并锁定嫌疑范围。"
      },
      {
        "id": "quest_church",
        "title": "调查教堂地窖",
        "description": "突破封锁，进入教堂地窖寻找异常来源。",
        "objective": "发现地窖中的仪式痕迹或秘密入口。"
      },
      {
        "id": "quest_mine",
        "title": "深入旧矿坑",
        "description": "追踪林中低语来源，进入旧矿坑深处。",
        "objective": "找到导致失踪事件的真相。"
      }
    ],
    "items": [
      {
        "id": "item_old_key",
        "name": "锈蚀钥匙",
        "description": "刻着教堂徽记，能打开地窖木门。"
      },
      {
        "id": "item_torn_note",
        "name": "破碎纸条",
        "description": "写着“午夜前别进墓园”的潦草字迹。"
      },
      {
        "id": "item_lantern",
        "name": "铜制提灯",
        "description": "照明范围有限，但耐风。"
      }
    ],
    "events": [
      {
        "trigger": "玩家在镇中心广场询问失踪者线索",
        "result": "公告栏背后发现被撕掉的教堂捐赠记录。"
      },
      {
        "trigger": "玩家试图进入教堂地窖",
        "result": "格雷修士出现阻止，并暗示墓园里有更重要的线索。"
      },
      {
        "trigger": "玩家在旧矿坑深处停留超过十分钟",
        "result": "低语声变为尖啸，触发一次恐惧检定。"
      }
    ]
  },
  {
    "id": "dnd-frozen-sick",
    "module_info": {
      "name": "冰封疫病",
      "description": "在艾森瓦尔德的冰雪覆盖之地，一种神秘的疾病正在蔓延。冒险者们必须追溯疫病源头，深入危机四伏的冰封洞穴。",
      "tags": ["DND", "入门", "冒险", "探索"]
    },
    "locations": [
      {
        "id": "town",
        "name": "艾登镇",
        "description": "一个宁静的小镇，最近被神秘事件所困扰。",
        "connected_locations": ["tavern", "market", "library", "outskirts"]
      },
      {
        "id": "tavern",
        "name": "醉龙酒馆",
        "description": "镇上最热闹的酒馆，冒险者聚集之地。",
        "connected_locations": ["town"]
      },
      {
        "id": "market",
        "name": "集市广场",
        "description": "各种商贩聚集之处，可以买到补给品。",
        "connected_locations": ["town"]
      },
      {
        "id": "library",
        "name": "古老图书馆",
        "description": "存放着许多古籍的图书馆，也许有关于疫病的记载。",
        "connected_locations": ["town"]
      },
      {
        "id": "outskirts",
        "name": "镇外荒野",
        "description": "艾登镇周围的荒野地带，寒风呼啸。",
        "connected_locations": ["town", "cave", "forest"]
      },
      {
        "id": "cave",
        "name": "冰封洞穴",
        "description": "传说中疫病源头所在，洞口结满了奇怪的蓝色冰晶。",
        "connected_locations": ["outskirts"]
      },
      {
        "id": "forest",
        "name": "迷雾森林",
        "description": "充满危险的森林，视野极差。",
        "connected_locations": ["outskirts"]
      }
    ],
    "npcs": [
      {
        "id": "npc_mayor",
        "name": "镇长",
        "location": "town",
        "description": "忧心忡忡的镇长，希望能有人解决这场灾难。"
      }
    ],
    "quests": [
      {
        "id": "q1",
        "title": "追查疫病源头",
        "description": "调查艾登镇附近蔓延的神秘疾病",
        "objective": "找到源头并解决它"
      }
    ],
    "items": [],
    "events": []
  }
]

for item in modules_data:
  module = Module.model_validate(item)
  modules[module.id] = module


def db_path() -> str:
  return os.path.join(storage_dir, "modules.db")


def save_character_to_db(character_data: dict) -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into characters (id, name, data, created_at) values (?, ?, ?, ?) "
      "on conflict(id) do update set name=excluded.name, data=excluded.data, created_at=excluded.created_at",
      (
        character_data["id"],
        character_data["name"],
        json.dumps(character_data, ensure_ascii=False),
        character_data["created_at"]
      )
    )
    conn.commit()


def load_characters_from_db() -> None:
  with sqlite3.connect(db_path()) as conn:
    try:
      rows = conn.execute("select id, data from characters").fetchall()
      for char_id, data in rows:
        try:
          characters[char_id] = json.loads(data)
        except json.JSONDecodeError:
          continue
    except sqlite3.OperationalError:
      # Table might not exist yet
      pass


def init_db() -> None:
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "create table if not exists structured_modules (module_id text primary key, data text not null, updated_at text not null)"
    )
    conn.execute(
      "create table if not exists characters (id text primary key, name text not null, data text not null, created_at text not null)"
    )
    conn.commit()


def load_structured_modules() -> None:
  with sqlite3.connect(db_path()) as conn:
    rows = conn.execute("select module_id, data from structured_modules").fetchall()
    for module_id, data in rows:
      try:
        payload = json.loads(data)
        structured = StructuredModule.model_validate(payload)
        structured_modules[module_id] = structured
        if module_id not in modules:
          modules[module_id] = convert_structured_to_module(module_id, structured)
      except json.JSONDecodeError:
        continue


def convert_structured_to_module(module_id: str, structured: StructuredModule) -> Module:
  scene_items = [
    Item(
      id=item.id or f"scene_item_{i}",
      name=item.name,
      description=item.description
    )
    for i, item in enumerate(structured.scene_items)
  ]
  handout_items = [
    Item(
      id=handout.id or f"handout_{i}",
      name=f"资料:{handout.title}",
      description=handout.content
    )
    for i, handout in enumerate(structured.handouts)
  ]
  return Module(
    id=module_id,
    module_info=ModuleInfo(
      name=structured.title,
      description=structured.background,
      tags=["Custom"]
    ),
    locations=[
      Location(
        id=f"loc_{i}",
        name=loc.name,
        description=loc.description,
        connected_locations=loc.connections
      ) for i, loc in enumerate(structured.locations)
    ],
    npcs=[
      Npc(
        id=f"npc_{i}",
        name=npc.name,
        location="unknown",
        description=npc.description
      ) for i, npc in enumerate(structured.npcs)
    ],
    quests=[
      Quest(
        id=f"quest_{i}",
        title=quest.name,
        description=quest.goal,
        objective=quest.goal
      ) for i, quest in enumerate(structured.quests)
    ],
    items=[*scene_items, *handout_items],
    events=[
      Event(
        trigger=event.trigger,
        result=event.result
      ) for event in structured.events
    ]
  )


def save_structured_module(module_id: str, module: StructuredModule) -> None:
  payload = json.dumps(module.model_dump(), ensure_ascii=False)
  with sqlite3.connect(db_path()) as conn:
    conn.execute(
      "insert into structured_modules (module_id, data, updated_at) values (?, ?, ?) on conflict(module_id) do update set data=excluded.data, updated_at=excluded.updated_at",
      (module_id, payload, datetime.utcnow().isoformat())
    )
    conn.commit()


def extract_pdf_text(path: str) -> str:
  doc = fitz.open(path)
  try:
    chunks = [page.get_text("text") for page in doc]
  finally:
    doc.close()
  text = "\n".join(chunks)
  return " ".join(text.split())


async def ai_structure_module(text: str) -> StructuredModule:
  api_key = os.getenv("OPENROUTER_API_KEY")
  if not api_key:
    raise HTTPException(status_code=500, detail="OPENROUTER未配置")
  prompt = (
    "你是TRPG模组解析器。把输入的PDF文本转成结构化JSON。"
    "只输出JSON，不要包含任何解释或多余文本。"
    "JSON必须包含字段: title, background, locations, npcs, events, quests, sequence, triggers, clues, handouts, scene_items, assets。"
    "locations字段包含: name, description, connections, npcs。"
    "npcs字段包含: name, description, secrets。"
    "events字段包含: trigger, result。"
    "quests字段包含: name, goal。"
    "sequence字段包含: id, title, location, order, description, prerequisites。"
    "triggers字段包含: id, name, once, conditions, actions。"
    "triggers.conditions字段包含: type, key, operator, value。"
    "triggers.actions字段包含: type, target_id, payload。"
    "clues字段包含: id, title, content, source, discovery_conditions。"
    "handouts字段包含: id, title, content, type, asset_ids, grant_conditions, add_to_inventory。"
    "scene_items字段包含: id, name, location, description, interactions, linked_clue_ids。"
    "assets字段包含: id, name, type, url, description。"
  )
  async with httpx.AsyncClient(timeout=60) as client:
    response = await client.post(
      "https://openrouter.ai/api/v1/chat/completions",
      headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "http://localhost:3000"),
        "X-Title": "DiceTales"
      },
      json={
        "model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
        "messages": [
          {"role": "system", "content": prompt},
          {"role": "user", "content": text[:12000]}
        ]
      }
    )
  if response.status_code >= 400:
    raise HTTPException(status_code=502, detail="AI解析失败")
  content = response.json().get("choices", [{}])[0].get("message", {}).get("content") or ""
  payload = parse_json_block(content)
  return StructuredModule.model_validate(payload)


def parse_json_block(content: str) -> dict:
  try:
    return json.loads(content)
  except json.JSONDecodeError:
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
      raise HTTPException(status_code=502, detail="AI返回非JSON")
    snippet = content[start : end + 1]
    try:
      return json.loads(snippet)
    except json.JSONDecodeError:
      raise HTTPException(status_code=502, detail="AI返回非JSON")


def ensure_default_structured(module_id: str) -> StructuredModule:
  if module_id in structured_modules:
    return structured_modules[module_id]
  base = modules.get(module_id)
  if not base:
    raise HTTPException(status_code=404, detail="Module not found")
  fallback = StructuredModule(
    title=base.module_info.name,
    background=base.module_info.description,
    locations=[
      StructuredLocation(
        name=location.name,
        description=location.description,
        connections=location.connected_locations,
        npcs=[npc.name for npc in base.npcs if npc.location == location.id]
      )
      for location in base.locations
    ],
    npcs=[
      StructuredNpc(name=npc.name, description=npc.description, secrets=None)
      for npc in base.npcs
    ],
    events=[StructuredEvent(trigger=event.trigger, result=event.result) for event in base.events],
    quests=[StructuredQuest(name=quest.title, goal=quest.objective) for quest in base.quests],
    sequence=[],
    triggers=[],
    clues=[],
    handouts=[],
    scene_items=[],
    assets=[]
  )
  structured_modules[module_id] = fallback
  save_structured_module(module_id, fallback)
  return fallback


def get_recent_messages(session_id: str) -> list[ChatMessage]:
  logs = game_logs.get(session_id, [])
  return logs[-10:]


def append_message(session_id: str, role: Role, content: str) -> list[ChatMessage]:
  logs = game_logs.setdefault(session_id, [])
  logs.append(ChatMessage(role=role, content=content))
  if len(logs) > 10:
    game_logs[session_id] = logs[-10:]
  return game_logs[session_id]


def build_context_payload(
  module: StructuredModule,
  location_name: str,
  quests: list[str],
  player_character: dict,
  game_state: dict,
  recent_dialogue: list[ChatMessage],
  player_action: str,
  triggered_events: list[StructuredEvent]
) -> dict:
  location = next((item for item in module.locations if item.name == location_name), None)
  resolved_location = location or module.locations[0]
  npc_names = resolved_location.npcs
  npc_details = [npc for npc in module.npcs if npc.name in npc_names]
  
  # Extract inventory for AI context
  inventory = player_character.get("inventory", [])
  equipped_items = [item for item in inventory if item.get("is_equipped")]
  
  context_payload = {
    "module_meta": {
      "title": module.title,
      "rule_system": module.rule_system,
      "tone": module.tone,
      "core_conflict": module.core_conflict,
      "background": module.background
    },
    "location": {
      "name": resolved_location.name,
      "description": resolved_location.description,
      "connections": resolved_location.connections,
      "sensory_details": resolved_location.sensory_details.model_dump() if resolved_location.sensory_details else None,
      "tactical_elements": resolved_location.tactical_elements,
      "hidden_treasures": resolved_location.hidden_treasures,
      "atmosphere": resolved_location.atmosphere,
      "hidden_clues": resolved_location.hidden_clues
    },
    "npcs_here": npc_names,
    "npc_details": [npc.model_dump() for npc in npc_details],
    "quests": quests,
    "player_character": {
      "name": player_character.get("name"),
      "stats": player_character.get("stats"),
      "skills": player_character.get("skills"),
      "hp": player_character.get("hp"),
      "equipped_items": equipped_items,
      "inventory": inventory
    },
    "game_state": game_state,
    "recent_dialogue": [item.model_dump() for item in recent_dialogue],
    "player_action": player_action,
    "triggered_events": [event.model_dump() for event in triggered_events]
  }
  
  # Filter out None values to keep context clean
  if context_payload["location"]:
      context_payload["location"] = {k: v for k, v in context_payload["location"].items() if v is not None}
      
  return context_payload


def build_prompt(payload: dict) -> str:
  rules = (
    "规则："
    "1 优先使用模组中的事件和剧情。"
    "2 不要创造新的主要剧情。"
    "3 可以创造细节描述。"
    "4 如果玩家行为脱离模组，创造合理的过渡剧情。"
    "5 绝对不能改变模组核心结局。"
    "6 输出必须为JSON。"
    "7 不允许修改模组核心设定或新增主线任务。"
  )
  format_hint = (
    "输出JSON格式："
    "{"
    '"narration":"",'
    '"choices":[],'
    '"state_update":{},'
    '"location_change":null,'
    '"quest_update":null'
    "}"
  )
  return f"{rules}\n{format_hint}\n输入：{json.dumps(payload, ensure_ascii=False)}"


def normalize_ai_reply(module: StructuredModule, reply: dict) -> dict:
  narration = reply.get("narration")
  narration_text = narration if isinstance(narration, str) and narration else "风声掠过，未闻回应。"
  choices = reply.get("choices")
  if isinstance(choices, list):
    normalized_choices = [item for item in choices if isinstance(item, str)]
  else:
    normalized_choices = []
  state_update = reply.get("state_update")
  if not isinstance(state_update, dict):
    state_update = {}
  location_change = reply.get("location_change")
  if not isinstance(location_change, str) or not any(
    item.name == location_change for item in module.locations
  ):
    location_change = None
  quest_update = reply.get("quest_update")
  if not isinstance(quest_update, str) or not any(
    item.name == quest_update for item in module.quests
  ):
    quest_update = None
  
  required_check = reply.get("required_check")
  inventory_update = reply.get("inventory_update")

  return {
    "narration": narration_text,
    "choices": normalized_choices,
    "state_update": state_update,
    "location_change": location_change,
    "quest_update": quest_update,
    "required_check": required_check,
    "inventory_update": inventory_update
  }


async def generate_ai_reply(session_id: str, message: str) -> dict:
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  module = ensure_default_structured(session["module_id"])
  
  # Append player message
  append_message(session_id, "player", message)

  # Dify API Configuration
  dify_api_key = os.getenv("DIFY_API_KEY", "")
  dify_api_url = os.getenv("DIFY_API_URL", "https://api.dify.ai/v1")
  
  if not dify_api_key:
      return {
          "narration": "DM的灵魂尚未被唤醒 (后端缺少 DIFY_API_KEY 配置，请在 .env.local 中添加)。",
          "choices": [],
          "state_update": {},
          "location_change": None,
          "quest_update": None
      }
  
  # Call Dify Chatflow
  async with httpx.AsyncClient(timeout=60) as client:
    try:
      # Inject combat and skill check rules into the context or query
      system_instructions = """
[重要规则]
1. 战斗与动作：玩家可以通过快捷按钮发送（如"我发动攻击！"）或自然语言描述（如"我跳上吊灯砸地精"）。
2. 动作判定：如果你判断玩家的行动是复杂的战术动作，请在你的回复中明确指出这消耗了他们的【动作】或【附赠动作】。
3. 属性检定：当玩家尝试有失败风险的行动时（如攀爬、欺骗、攻击），你必须要求玩家进行对应的【属性检定】（如：请进行一次力量检定）。
4. 格式要求：你的回复必须依然保持 JSON 格式，且情节描述放在 "narration" 字段中。
5. 技能检定交互：如果你要求玩家进行检定（如隐匿、察觉、力量等），请在 JSON 中增加 "required_check" 字段，指明检定类型。例如：{"required_check": {"type": "skill", "name": "隐匿", "attr": "dexterity"}} 或 {"type": "save", "name": "敏捷豁免", "attr": "dexterity"}。
6. 物品管理：如果你判断玩家获得了新物品（如搜刮尸体、NPC赠送），或者消耗了物品（如喝掉药水），请在 JSON 中增加 "inventory_update" 字段。
   - 添加物品格式：{"inventory_update": {"add": [{"name": "地精短刀", "category": "weapon", "quantity": 1, "description": "粗糙的武器", "stats": {"damage": "1d4"}}]}}
   - 消耗物品格式：{"inventory_update": {"remove": [{"name": "金币", "quantity": 5}]}}
"""
      augmented_query = f"{system_instructions}\n玩家行动：{message}"

      response = await client.post(
        f"{dify_api_url}/chat-messages",
        headers={
          "Authorization": f"Bearer {dify_api_key}",
          "Content-Type": "application/json"
        },
        json={
          "inputs": {
            "session_id": session_id  # Pass session_id to Dify
          },
          "query": augmented_query,
          "response_mode": "blocking",
          "conversation_id": "", # Stateless for now, handled by backend logic
          "user": session.get("user_id", "default_user")
        }
      )
    except httpx.RequestError as e:
      print(f"Dify Request Error: {e}")
      return {
        "narration": f"DM似乎在翻阅规则书... (网络连接错误: {e})",
        "choices": [],
        "state_update": {},
        "location_change": None,
        "quest_update": None
      }
  
  if response.status_code != 200:
    print(f"Dify Error: {response.status_code} - {response.text}")
    error_msg = response.text
    try:
        error_json = response.json()
        error_msg = error_json.get("message", error_msg)
    except:
        pass
    
    # Fallback if Dify fails
    return {
      "narration": f"DM似乎在翻阅规则书... (Dify连接失败: {response.status_code} - {error_msg})",
      "choices": [],
      "state_update": {},
      "location_change": None,
      "quest_update": None
    }
    
  dify_data = response.json()
  answer = dify_data.get("answer", "")
  
  # Parse Dify response (expecting JSON string in 'answer')
  try:
    result_data = json.loads(answer)
  except json.JSONDecodeError:
    # If not JSON, treat as raw text narration
    result_data = {"narration": answer}

  reply = normalize_ai_reply(module, result_data)
  append_message(session_id, "ai", reply["narration"])
  
  # Handle Inventory Update
  if reply.get("inventory_update"):
      char_id = session.get("character_id")
      if char_id and char_id in characters:
          char = characters[char_id]
          inv_update = reply["inventory_update"]
          inventory = char.get("inventory", [])
          
          # Add items
          if "add" in inv_update and isinstance(inv_update["add"], list):
              for item in inv_update["add"]:
                  # Check if item already exists (stackable like arrows/gold)
                  existing_item = next((i for i in inventory if i["name"] == item.get("name") and i.get("category") == "consumable"), None)
                  if existing_item:
                      existing_item["quantity"] = existing_item.get("quantity", 1) + item.get("quantity", 1)
                  else:
                      new_item = {
                          "id": f"item_{uuid4().hex[:8]}",
                          "name": item.get("name", "神秘物品"),
                          "category": item.get("category", "tool"),
                          "origin": "module",
                          "is_equipped": False,
                          "quantity": item.get("quantity", 1),
                          "description": item.get("description", ""),
                          "stats": item.get("stats", {})
                      }
                      inventory.append(new_item)
          
          # Remove items
          if "remove" in inv_update and isinstance(inv_update["remove"], list):
              for item in inv_update["remove"]:
                  for i, existing in enumerate(inventory):
                      if existing["name"] == item.get("name"):
                          remove_qty = item.get("quantity", 1)
                          if existing.get("quantity", 1) > remove_qty:
                              existing["quantity"] -= remove_qty
                          else:
                              inventory.pop(i)
                          break
          
          char["inventory"] = inventory
          save_character_to_db(char)
  
  # Update State
  location_change = reply["location_change"]
  quest_update = reply["quest_update"]
  state_update = reply["state_update"]
  next_state = session_states.setdefault(session_id, {})
  
  if location_change:
    next_state["location"] = location_change
  if quest_update:
    next_state["quest"] = quest_update
  if state_update:
    merged = next_state.get("game_state", {})
    if isinstance(merged, dict):
      merged.update(state_update)
      next_state["game_state"] = merged
  trigger_outcome = apply_structured_triggers(session_id, module, message, reply)
  if trigger_outcome["revealed_clues"]:
    reply["revealed_clues"] = trigger_outcome["revealed_clues"]
  if trigger_outcome["granted_handouts"]:
    reply["granted_handouts"] = trigger_outcome["granted_handouts"]
  return reply


@app.get("/health")
async def health():
  return {"status": "ok"}


def require_admin_token(x_admin_token: str | None = Header(default=None)):
  expected = os.getenv("ADMIN_API_TOKEN", "")
  if expected and x_admin_token != expected:
    raise HTTPException(status_code=401, detail="Unauthorized")


def admin_response(data: Any, meta: dict | None = None):
  return {"data": data, "meta": meta or {}, "error": None}


@app.get("/modules")
async def list_modules():
  return {"modules": [module.model_dump() for module in modules.values()]}


@app.get("/modules/{module_id}")
async def get_module(module_id: str):
  module = modules.get(module_id)
  if not module:
    raise HTTPException(status_code=404, detail="Module not found")
  return {"module": module.model_dump()}


@app.post("/modules/{module_id}/pdf")
async def upload_module_pdf(module_id: str, file: UploadFile = File(...)):
  filename = f"{module_id}.pdf"
  dest = os.path.join(storage_dir, filename)
  content = await file.read()
  if not content:
    raise HTTPException(status_code=400, detail="Empty file")
  with open(dest, "wb") as target:
    target.write(content)
  text = extract_pdf_text(dest)
  if not text:
    raise HTTPException(status_code=400, detail="PDF解析失败")
  structured = await ai_structure_module(text)
  structured_modules[module_id] = structured
  save_structured_module(module_id, structured)
  modules[module_id] = convert_structured_to_module(module_id, structured)
  return {"module_id": module_id, "path": dest, "structured": structured.model_dump()}


@app.get("/modules/{module_id}/pdf")
async def get_module_pdf(module_id: str):
  filename = os.path.join(storage_dir, f"{module_id}.pdf")
  if not os.path.exists(filename):
    raise HTTPException(status_code=404, detail="PDF not found")
  return FileResponse(filename, media_type="application/pdf")


@app.get("/modules/{module_id}/structured")
async def get_structured_module(module_id: str):
  module = ensure_default_structured(module_id)
  return {"module": module.model_dump()}


@app.post("/modules/{module_id}/structured")
async def save_structured_module_api(module_id: str, payload: StructuredModule):
  structured_modules[module_id] = payload
  save_structured_module(module_id, payload)
  modules[module_id] = convert_structured_to_module(module_id, payload)
  return {"module_id": module_id, "status": "stored"}


@app.get("/admin/stats")
async def admin_stats(x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  recent_session = None
  if sessions:
    recent_session = max(
      sessions.values(),
      key=lambda item: item.get("created_at", "")
    ).get("created_at")
  return admin_response({
    "module_count": len(modules),
    "structured_module_count": len(structured_modules),
    "character_count": len(characters),
    "session_count": len(sessions),
    "recent_session_at": recent_session
  })


@app.get("/admin/users")
async def admin_users(x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  aggregate: dict[str, dict] = {}
  for session in sessions.values():
    user_id = session.get("user_id") or "anonymous"
    data = aggregate.setdefault(user_id, {
      "user_id": user_id,
      "session_count": 0,
      "character_ids": set(),
      "last_active_at": ""
    })
    data["session_count"] += 1
    char_id = session.get("character_id")
    if char_id:
      data["character_ids"].add(char_id)
    created_at = session.get("created_at", "")
    if created_at > data["last_active_at"]:
      data["last_active_at"] = created_at
  users = [{
    "user_id": item["user_id"],
    "session_count": item["session_count"],
    "character_count": len(item["character_ids"]),
    "last_active_at": item["last_active_at"]
  } for item in aggregate.values()]
  users.sort(key=lambda item: item["last_active_at"], reverse=True)
  return admin_response(users, {"total": len(users)})


@app.get("/admin/sessions")
async def admin_sessions(
  user_id: str | None = Query(default=None),
  module_id: str | None = Query(default=None),
  status: str | None = Query(default=None),
  limit: int = Query(default=100, ge=1, le=500),
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  items = list(sessions.values())
  if user_id:
    items = [item for item in items if (item.get("user_id") or "anonymous") == user_id]
  if module_id:
    items = [item for item in items if item.get("module_id") == module_id]
  if status:
    items = [item for item in items if item.get("status") == status]
  items.sort(key=lambda item: item.get("created_at", ""), reverse=True)
  return admin_response(items[:limit], {"total": len(items), "limit": limit})


@app.get("/admin/modules")
async def admin_modules(
  q: str | None = Query(default=None),
  offset: int = Query(default=0, ge=0),
  limit: int = Query(default=50, ge=1, le=200),
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  module_ids = set(modules.keys()) | set(structured_modules.keys())
  rows = []
  for module_id in module_ids:
    module = modules.get(module_id)
    structured = structured_modules.get(module_id)
    name = module.module_info.name if module else (structured.title if structured else module_id)
    description = module.module_info.description if module else (structured.background if structured else "")
    has_structured = module_id in structured_modules
    row = {
      "id": module_id,
      "name": name,
      "description": description,
      "has_structured": has_structured,
      "schema_version": structured.schema_version if structured else None
    }
    rows.append(row)
  if q:
    q_lower = q.lower()
    rows = [row for row in rows if q_lower in row["id"].lower() or q_lower in row["name"].lower()]
  rows.sort(key=lambda item: item["id"])
  paged = rows[offset : offset + limit]
  return admin_response(paged, {"total": len(rows), "offset": offset, "limit": limit})


@app.get("/admin/modules/{module_id}")
async def admin_module_detail(module_id: str, x_admin_token: str | None = Header(default=None)):
  require_admin_token(x_admin_token)
  structured = ensure_default_structured(module_id)
  module = modules.get(module_id)
  return admin_response({
    "module_id": module_id,
    "module_info": module.module_info.model_dump() if module else {
      "name": structured.title,
      "description": structured.background,
      "tags": ["Custom"]
    },
    "structured": structured.model_dump()
  })


@app.put("/admin/modules/{module_id}/structured")
async def admin_update_module_structured(
  module_id: str,
  payload: StructuredModule,
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  structured_modules[module_id] = payload
  save_structured_module(module_id, payload)
  modules[module_id] = convert_structured_to_module(module_id, payload)
  return admin_response({"module_id": module_id, "status": "updated"})


@app.post("/admin/modules/{module_id}/assets")
async def admin_add_module_asset(
  module_id: str,
  payload: AdminAssetCreate,
  x_admin_token: str | None = Header(default=None)
):
  require_admin_token(x_admin_token)
  structured = ensure_default_structured(module_id)
  asset_id = payload.id or f"asset_{uuid4().hex[:8]}"
  asset = StructuredAsset(
    id=asset_id,
    name=payload.name,
    type=payload.type,
    url=payload.url,
    description=payload.description
  )
  structured.assets = [*structured.assets, asset]
  structured_modules[module_id] = structured
  save_structured_module(module_id, structured)
  return admin_response({"module_id": module_id, "asset": asset.model_dump()})


def evaluate_trigger_rule(
  rule: StructuredTriggerRule,
  state: dict,
  player_message: str,
  reply: dict
) -> bool:
  game_state = state.get("game_state", {})
  message_lower = player_message.lower()
  for condition in rule.conditions:
    if condition.type == "location":
      current_location = str(state.get("location", ""))
      value = str(condition.value)
      if condition.operator == "contains":
        if value not in current_location:
          return False
      elif current_location != value:
        return False
    elif condition.type == "action":
      value = str(condition.value).lower()
      if value not in message_lower:
        return False
    elif condition.type == "state":
      if not condition.key:
        return False
      current = game_state.get(condition.key)
      value = condition.value
      if condition.operator == "contains":
        if value not in str(current):
          return False
      elif str(current) != value:
        return False
    elif condition.type == "check_result":
      value = str(condition.value).lower()
      if value not in json.dumps(reply, ensure_ascii=False).lower():
        return False
  return True


def apply_structured_triggers(
  session_id: str,
  module: StructuredModule,
  player_message: str,
  reply: dict
) -> dict:
  state = session_states.setdefault(session_id, {})
  discovered = state.setdefault("discovered_clues", [])
  granted = state.setdefault("granted_handouts", [])
  triggered = state.setdefault("triggered_rules", [])
  revealed_clues: list[dict] = []
  granted_handouts: list[dict] = []
  game_state = state.setdefault("game_state", {})
  char_id = sessions.get(session_id, {}).get("character_id")
  for rule in module.triggers:
    if rule.once and rule.id in triggered:
      continue
    if not evaluate_trigger_rule(rule, state, player_message, reply):
      continue
    for action in rule.actions:
      if action.type == "reveal_clue" and action.target_id:
        clue = next((item for item in module.clues if item.id == action.target_id), None)
        if clue and clue.id not in discovered:
          discovered.append(clue.id)
          revealed_clues.append(clue.model_dump())
      elif action.type == "grant_handout" and action.target_id:
        handout = next((item for item in module.handouts if item.id == action.target_id), None)
        if handout and handout.id not in granted:
          granted.append(handout.id)
          granted_handouts.append(handout.model_dump())
          if handout.add_to_inventory and char_id and char_id in characters:
            char = characters[char_id]
            inventory = char.get("inventory", [])
            inventory.append({
              "id": f"item_{uuid4().hex[:8]}",
              "name": handout.title,
              "category": "document",
              "origin": "module",
              "is_equipped": False,
              "quantity": 1,
              "description": handout.content,
              "stats": {}
            })
            char["inventory"] = inventory
            save_character_to_db(char)
      elif action.type == "update_state":
        payload = action.payload if isinstance(action.payload, dict) else {}
        game_state.update(payload)
    triggered.append(rule.id)
  state["discovered_clues"] = discovered
  state["granted_handouts"] = granted
  state["triggered_rules"] = triggered
  state["game_state"] = game_state
  return {"revealed_clues": revealed_clues, "granted_handouts": granted_handouts}


@app.post("/characters")
async def create_character(payload: CharacterCreate):
  character_id = payload.id or str(uuid4())
  
  # Logic to calculate initial stats
  hp = 10
  max_hp = 10
  level = 1
  xp = 0
  san = 0
  mp = 0
  max_mp = 0
  skill_marks = []
  inventory = []
  
  stats = payload.stats or {}
  
  if payload.type == "dnd":
      role_class = payload.class_
      con = stats.get("constitution", 10)
      int_val = stats.get("intelligence", 10)
      con_mod = (con - 10) // 2
      
      class_cfg = DND_CLASS_CONFIG.get(role_class, DND_CLASS_CONFIG["战士"])
      hp = class_cfg["hp_base"] + con_mod
      max_hp = hp
      
      mp = 4 + (int_val - 10) // 2
      max_mp = mp
      
      # Assign default equipment
      import copy
      default_eq = copy.deepcopy(class_cfg.get("default_equipment", []))
      for item in default_eq:
          item["id"] = f"item_{uuid4().hex[:8]}"
      inventory.extend(default_eq)
      
  elif payload.type == "coc":
      # CoC 7e Rule: HP = (CON + SIZ) / 10
      con = stats.get("con", 50)
      siz = stats.get("siz", 50)
      pow_val = stats.get("pow", 50) # POW
      
      hp = (con + siz) // 10
      max_hp = hp
      san = pow_val
      
      mp = pow_val // 5
      max_mp = mp
      
      level = 0 # CoC no levels
      
      # Assign default equipment
      import copy
      occupation = payload.occupation or "默认"
      default_eq = copy.deepcopy(COC_OCCUPATION_CONFIG.get(occupation, COC_OCCUPATION_CONFIG["默认"]))
      for item in default_eq:
          item["id"] = f"item_{uuid4().hex[:8]}"
      inventory.extend(default_eq)

  # Merge any items sent from frontend (legacy support)
  if payload.items:
      for legacy_item in payload.items:
          inventory.append({
              "id": f"item_{uuid4().hex[:8]}",
              "name": legacy_item.get("name", "未知物品"),
              "category": legacy_item.get("category", "tool"),
              "origin": "custom",
              "is_equipped": False,
              "quantity": legacy_item.get("quantity", 1),
              "description": legacy_item.get("description", ""),
              "stats": legacy_item.get("stats", {})
          })

  data = {
    "id": character_id,
    "name": payload.name,
    "type": payload.type,
    "race": payload.race,
    "class": payload.class_,
    "occupation": payload.occupation,
    "age": payload.age,
    "stats": stats,
    "skills": payload.skills or [],
    "inventory": inventory, # Replaces items
    "backstory": payload.backstory,
    "created_at": datetime.utcnow().isoformat(),
    # New Stats
    "level": level,
    "xp": xp,
    "hp": hp,
    "maxHp": max_hp, # Frontend expects maxHp (camelCase)
    "mp": mp,
    "maxMp": max_mp, # Frontend expects maxMp (camelCase)
    "san": san,
    "skill_marks": skill_marks,
    "avatar": "🧙" # Default avatar
  }
  characters[character_id] = data
  save_character_to_db(data)
  return {"character": data}

@app.post("/characters/{character_id}/equip")
async def toggle_equip(character_id: str, payload: dict):
    item_id = payload.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="Missing item_id")
        
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    inventory = char.get("inventory", [])
    item_found = False
    
    for item in inventory:
        if item.get("id") == item_id:
            # Toggle equip status
            item["is_equipped"] = not item.get("is_equipped", False)
            item_found = True
            break
            
    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in inventory")
        
    char["inventory"] = inventory
    save_character_to_db(char)
    
    return {"character": char}

@app.post("/characters/{character_id}/xp")
async def add_xp(character_id: str, payload: XPUpdate):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    if char.get("type") != "dnd":
        raise HTTPException(status_code=400, detail="Only DND characters use XP")
        
    char["xp"] += payload.xp_delta
    
    # Check Level Up
    current_level = char["level"]
    new_level = current_level
    
    # Simple lookup for max level reached
    for lvl in range(10, 0, -1):
        if char["xp"] >= DND_LEVEL_XP.get(lvl, 999999):
            new_level = lvl
            break
            
    if new_level > current_level:
        # Level Up Logic
        char["level"] = new_level
        
        # HP Increase
        role_class = char.get("class", "战士")
        con = char.get("stats", {}).get("constitution", 10)
        con_mod = (con - 10) // 2
        class_cfg = DND_CLASS_CONFIG.get(role_class, DND_CLASS_CONFIG["战士"])
        
        levels_gained = new_level - current_level
        hp_gain = (class_cfg["hp_level"] + con_mod) * levels_gained
        
        # Special case: Fighter Lv6 HP+5 (Extra)
        if role_class == "战士" and current_level < 6 <= new_level:
             hp_gain += 5
             
        char["maxHp"] += hp_gain
        char["hp"] += hp_gain # Heal on level up
        
        # Attributes Increase (Lv4, Lv8)
        pass

    save_character_to_db(char)
    return {"character": char, "level_up": new_level > current_level}

@app.post("/characters/{character_id}/skill-check")
async def skill_check(character_id: str, payload: SkillCheck):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if char["rule_set"] != "CoC":
        raise HTTPException(status_code=400, detail="Only CoC characters use Skill Marks")
        
    if payload.success:
        marks = set(char.get("skill_marks", []))
        if payload.skill_name not in marks:
            marks.add(payload.skill_name)
            char["skill_marks"] = list(marks)
            save_character_to_db(char)
            
    return {"character": char}

@app.post("/characters/{character_id}/growth")
async def trigger_growth(character_id: str):
    char = characters.get(character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if char["rule_set"] != "CoC":
        raise HTTPException(status_code=400, detail="Only CoC characters use Growth")
        
    marks = char.get("skill_marks", [])
    if not marks:
        return {"message": "No skills marked for growth", "results": []}
        
    results = []
    # Currently char skills is a list of strings ["Skill A", "Skill B"] or user input strings.
    # Wait, frontend sends skills as list[str]. But CoC skills need values (1-100).
    # In `CharacterCreate`, `skills` is list[str].
    # In user requirement: "skills": {"spot_hidden": 40}.
    # The current frontend implementation only stored names in `skills` array for display.
    # We need to migrate `skills` to dict for CoC, or assume default values if missing?
    # Let's check `create_character` implementation in frontend.
    # Frontend: `skills` state is string array.
    # We need to support values.
    # For now, let's assume we store skill values in `attributes`? No, separate field.
    # Hack: If `skills` is list, we treat them as having base value (e.g. 50) or look up from attributes if we merged them?
    # Better: Update `skills` to be a Dict or List of Objects.
    # But to avoid breaking existing frontend too much in one go, let's look at `attributes`.
    # CoC attributes are stats. Skills are separate.
    # Let's assume for this "Simplified" version, we track skill values in a new field `skill_values` or migrate `skills`.
    # Given the user prompt example: "skills": {"spot_hidden": 40}.
    
    # We will try to read from `skill_values` if exists, else init from `skills` list with default (e.g. 50).
    skill_values = char.get("skill_values", {})
    if not skill_values and isinstance(char.get("skills"), list):
        for s in char["skills"]:
            skill_values[s] = 50 # Default starting skill
    
    growth_log = []
    
    for skill_name in marks:
        current_val = skill_values.get(skill_name, 50)
        check_roll = random.randint(1, 100)
        
        if check_roll > current_val:
            growth_amount = random.randint(1, 6) + 1
            new_val = current_val + growth_amount
            skill_values[skill_name] = new_val
            growth_log.append({
                "skill": skill_name,
                "roll": check_roll,
                "old": current_val,
                "gain": growth_amount,
                "new": new_val,
                "success": True
            })
        else:
            growth_log.append({
                "skill": skill_name,
                "roll": check_roll,
                "threshold": current_val,
                "success": False
            })
            
    char["skill_values"] = skill_values
    char["skill_marks"] = [] # Reset marks
    save_character_to_db(char)
    
    return {"results": growth_log, "character": char}

@app.get("/characters")
async def list_characters():
  return {"characters": list(characters.values())}


@app.post("/sessions")
async def create_session(payload: SessionCreate):
  # Check if module exists in basic modules or structured modules
  if payload.module_id not in modules and payload.module_id not in structured_modules:
    # Try to load it if missing
    try:
      ensure_default_structured(payload.module_id)
    except Exception:
      raise HTTPException(status_code=404, detail=f"Module not found: {payload.module_id}")

  if payload.character_id not in characters:
    raise HTTPException(status_code=404, detail="Character not found")
  
  session_id = str(uuid4())
  data = {
    "id": session_id,
    "module_id": payload.module_id,
    "character_id": payload.character_id,
    "user_id": payload.user_id,
    "status": "active",
    "created_at": datetime.utcnow().isoformat()
  }
  sessions[session_id] = data
  
  # Initial DM Intro
  module_info = None
  if payload.module_id in modules:
      module_info = modules[payload.module_id].module_info
  elif payload.module_id in structured_modules:
      s_mod = structured_modules[payload.module_id]
      # Create a dummy module info if only structured exists
      module_info = ModuleInfo(name=s_mod.title, description=s_mod.background, tags=[])
      
  intro_message = f"{module_info.description}\n\n冒险者，请告诉我你的名字和来历。" if module_info else "欢迎来到未知模组。\n\n冒险者，请告诉我你的名字和来历。"
  
  game_logs[session_id] = [
      ChatMessage(role="ai", content=intro_message)
  ]
  
  structured = ensure_default_structured(payload.module_id)
  session_states[session_id] = {
    "location": structured.locations[0].name if structured.locations else "",
    "quest": structured.quests[0].name if structured.quests else None,
    "game_state": {},
    "discovered_clues": [],
    "granted_handouts": [],
    "triggered_rules": []
  }
  return {"session": data}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
  session = sessions.get(session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
    
  # Inject current character data into session info so frontend has it
  char_id = session.get("character_id")
  if char_id and char_id in characters:
      session["character"] = characters[char_id]
      
  return {"session": session}


@app.get("/sessions/{session_id}/state")
async def get_session_state(session_id: str):
  if session_id not in sessions:
    raise HTTPException(status_code=404, detail="Session not found")
  return {
    "messages": [item.model_dump() for item in get_recent_messages(session_id)],
    "state": session_states.get(session_id, {})
  }


@app.post("/gm/action")
async def gm_action(payload: ActionRequest):
  if payload.location or payload.quest or payload.game_state:
    state = session_states.setdefault(payload.session_id, {})
    if payload.location or payload.quest:
      session = sessions.get(payload.session_id)
      if session:
        module = ensure_default_structured(session["module_id"])
        if payload.location and any(
          item.name == payload.location for item in module.locations
        ):
          state["location"] = payload.location
        if payload.quest and any(item.name == payload.quest for item in module.quests):
          state["quest"] = payload.quest
    if payload.game_state and isinstance(payload.game_state, dict):
      merged = state.get("game_state", {})
      if isinstance(merged, dict):
        merged.update(payload.game_state)
        state["game_state"] = merged
    if payload.player_character and isinstance(payload.player_character, dict):
      state["player_character"] = payload.player_character
  reply = await generate_ai_reply(payload.session_id, payload.message)
  return {"result": reply}


@app.post("/gm/action/external")
async def gm_action_external(payload: ExternalActionRequest):
  session = sessions.get(payload.session_id)
  if not session:
    raise HTTPException(status_code=404, detail="Session not found")
  module = ensure_default_structured(session["module_id"])
  append_message(payload.session_id, "player", payload.player_action)
  
  result_data = payload.result
  if isinstance(result_data, str):
    try:
      result_data = json.loads(result_data)
    except json.JSONDecodeError:
      result_data = {"narration": result_data}
  
  reply = normalize_ai_reply(module, result_data)
  append_message(payload.session_id, "ai", reply["narration"])
  location_change = reply["location_change"]
  quest_update = reply["quest_update"]
  state_update = reply["state_update"]
  next_state = session_states.setdefault(payload.session_id, {})
  if location_change:
    next_state["location"] = location_change
  if quest_update:
    next_state["quest"] = quest_update
  if state_update:
    merged = next_state.get("game_state", {})
    if isinstance(merged, dict):
      merged.update(state_update)
      next_state["game_state"] = merged
  return {"result": reply}


@app.websocket("/ws/{session_id}")
async def gm_ws(websocket: WebSocket, session_id: str):
  await websocket.accept()
  ws_clients.setdefault(session_id, set()).add(websocket)
  try:
    while True:
      message = await websocket.receive_text()
      reply = await generate_ai_reply(session_id, message)
      await websocket.send_json(reply)
  except WebSocketDisconnect:
    ws_clients[session_id].remove(websocket)


@app.on_event("startup")
async def startup_event():
  init_db()
  load_structured_modules()
  load_characters_from_db()
