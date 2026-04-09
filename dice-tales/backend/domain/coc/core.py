from __future__ import annotations

import builtins
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Role = Literal["ai", "player"]


class CocRollResult(BaseModel):
  expression: str
  value: int
  details: list[int] = Field(default_factory=list)


class CocStatePatch(BaseModel):
  current_scene_id: str | None = None
  current_location_id: str | None = None
  add_discovered_clue_ids: list[str] = Field(default_factory=list)
  add_granted_handout_ids: list[str] = Field(default_factory=list)
  add_triggered_rule_ids: list[str] = Field(default_factory=list)
  merge_flags: dict[str, Any] = Field(default_factory=dict)
  time_progress_delta: int | None = None


class CocCheckRequest(BaseModel):
  check_id: str
  action: str
  kind: Literal["skill", "characteristic"]
  key: str
  name: str
  difficulty: Literal["regular", "hard", "extreme"] = "regular"
  target_override: int | None = None
  reason: str | None = None


class CocCheckResult(BaseModel):
  check_id: str
  action: str
  kind: Literal["skill", "characteristic"]
  key: str
  name: str
  target: int
  required_threshold: int
  difficulty: Literal["regular", "hard", "extreme"] = "regular"
  passed: bool
  level: Literal["fumble", "failure", "regular", "hard", "extreme", "critical"]
  roll: CocRollResult
  narrative: str | None = None
  consequence: str | None = None
  state_patch: CocStatePatch | None = None


class CocEntity(BaseModel):
  model_config = ConfigDict(extra="allow")
  tags: list[str] = Field(default_factory=list)
  extra: dict[str, Any] = Field(default_factory=dict)


class CocSensoryDetails(BaseModel):
  visual: str | None = None
  auditory: str | None = None
  olfactory: str | None = None


class CocCharacterProfile(BaseModel):
  name: str
  occupation: str | None = None
  age: int | None = None
  residence: str | None = None
  birthplace: str | None = None
  avatar: str | None = None
  backstory: str | None = None


class CocCharacteristics(BaseModel):
  str: builtins.int | None = None
  con: builtins.int | None = None
  siz: builtins.int | None = None
  dex: builtins.int | None = None
  app: builtins.int | None = None
  int: builtins.int | None = None
  pow: builtins.int | None = None
  edu: builtins.int | None = None
  luck: builtins.int | None = None


class CocValueTrack(BaseModel):
  current: int = 0
  maximum: int = 0


class CocCharacterStatus(BaseModel):
  hp: CocValueTrack = Field(default_factory=CocValueTrack)
  mp: CocValueTrack = Field(default_factory=CocValueTrack)
  san: CocValueTrack = Field(default_factory=CocValueTrack)
  conditions: list[str] = Field(default_factory=list)
  flags: dict[str, Any] = Field(default_factory=dict)


class CocItem(CocEntity):
  id: str
  name: str
  description: str
  category: Literal["weapon", "armor", "boots", "ring", "necklace", "consumable", "key", "tool", "misc", "document"] = "tool"
  origin: Literal["base", "module", "custom"] | None = None
  quantity: int = 1
  is_equipped: bool = False
  stats: dict[str, Any] = Field(default_factory=dict)
  linked_clue_id: str | None = None


class CocInvestigator(CocEntity):
  id: str
  rule_system: Literal["coc"] = "coc"
  profile: CocCharacterProfile
  characteristics: CocCharacteristics = Field(default_factory=CocCharacteristics)
  skills: dict[str, int] = Field(default_factory=dict)
  inventory: list[CocItem] = Field(default_factory=list)
  status: CocCharacterStatus = Field(default_factory=CocCharacterStatus)


class CocLocation(CocEntity):
  id: str | None = None
  name: str
  description: str
  connections: list[str] = Field(default_factory=list)
  npcs: list[str] = Field(default_factory=list)
  type: str | None = None
  subtype: str | None = None
  sensory_details: CocSensoryDetails | None = None
  tactical_elements: str | None = None
  hidden_treasures: str | None = None
  atmosphere: str | None = None
  hidden_clues: str | None = None


class CocNpc(CocEntity):
  id: str | None = None
  name: str
  description: str
  type: str | None = None
  subtype: str | None = None
  secrets: str | None = None
  personality: str | None = None
  appearance: str | None = None
  alignment: str | None = None
  combat_behavior: str | None = None
  secrets_and_lies: str | None = None
  sanity_state: str | None = None


class CocEvent(CocEntity):
  trigger: str
  result: str
  type: str | None = None
  subtype: str | None = None
  consequences: str | None = None
  encounter_type: str | None = None
  sanity_check_trigger: str | None = None


class CocQuest(CocEntity):
  name: str
  goal: str
  status: str | None = None


class CocScene(CocEntity):
  id: str
  title: str
  type: str | None = None
  subtype: str | None = None
  location_id: str | None = None
  order: int = 0
  description: str
  prerequisites: list[str] = Field(default_factory=list)


class CocTriggerCondition(CocEntity):
  type: Literal["location", "scene", "action", "state", "check_result", "clue", "handout", "time"]
  key: str | None = None
  operator: Literal["eq", "contains", "gte", "lte"] = "eq"
  value: str


class CocTriggerAction(CocEntity):
  type: Literal["reveal_clue", "grant_handout", "update_state", "branch_scene", "move_location"]
  target_id: str | None = None
  payload: dict[str, Any] = Field(default_factory=dict)


class CocTriggerRule(CocEntity):
  id: str
  name: str
  type: str | None = None
  subtype: str | None = None
  once: bool = True
  conditions: list[CocTriggerCondition] = Field(default_factory=list)
  actions: list[CocTriggerAction] = Field(default_factory=list)


class CocClue(CocEntity):
  id: str
  title: str
  content: str
  type: str | None = None
  subtype: str | None = None
  source: str | None = None
  discovery_conditions: list[str] = Field(default_factory=list)
  visibility: Literal["explicit", "hidden"] | None = None
  trigger_ref: str | None = None
  discovery_method: str | None = None
  gm_notes: str | None = None
  sanity_cost: str | None = None
  mythos_knowledge: bool | None = None


class CocHandout(CocEntity):
  id: str
  title: str
  content: str
  subtype: str | None = None
  type: Literal["text", "image", "mixed"] = "text"
  asset_ids: list[str] = Field(default_factory=list)
  grant_conditions: list[str] = Field(default_factory=list)
  add_to_inventory: bool = True


class CocSceneItem(CocEntity):
  id: str
  name: str
  location_id: str
  description: str
  type: str | None = None
  subtype: str | None = None
  interactions: list[str] = Field(default_factory=list)
  linked_clue_ids: list[str] = Field(default_factory=list)
  magical_properties: str | None = None


class CocAsset(CocEntity):
  id: str
  name: str
  subtype: str | None = None
  type: Literal["image", "map", "document", "other"] = "image"
  url: str = ""
  description: str = ""


class CocScenario(CocEntity):
  module_id: str | None = None
  source_type: str | None = None
  status: Literal["draft", "published"] = "draft"
  rule_system: Literal["coc"] = "coc"
  tone: str | None = None
  core_conflict: str | None = None
  themes: list[str] = Field(default_factory=list)
  title: str
  background: str
  locations: list[CocLocation] = Field(default_factory=list)
  npcs: list[CocNpc] = Field(default_factory=list)
  events: list[CocEvent] = Field(default_factory=list)
  quests: list[CocQuest] = Field(default_factory=list)
  schema_version: int = 3
  sequence: list[CocScene] = Field(default_factory=list)
  triggers: list[CocTriggerRule] = Field(default_factory=list)
  clues: list[CocClue] = Field(default_factory=list)
  handouts: list[CocHandout] = Field(default_factory=list)
  scene_items: list[CocSceneItem] = Field(default_factory=list)
  assets: list[CocAsset] = Field(default_factory=list)
  extensions: dict[str, Any] = Field(default_factory=dict)
  custom_types: list[dict[str, Any]] = Field(default_factory=list)


class CocSessionState(BaseModel):
  current_scene_id: str | None = None
  current_location_id: str | None = None
  discovered_clue_ids: list[str] = Field(default_factory=list)
  granted_handout_ids: list[str] = Field(default_factory=list)
  triggered_rule_ids: list[str] = Field(default_factory=list)
  flags: dict[str, Any] = Field(default_factory=dict)
  time_progress: int | None = None


class CocSession(BaseModel):
  id: str
  rule_system: Literal["coc"] = "coc"
  scenario_id: str
  investigator_id: str
  started_at: str
  updated_at: str
  state: CocSessionState = Field(default_factory=CocSessionState)


class CocChatMessage(BaseModel):
  role: Role
  content: str


class AdminAssetCreate(BaseModel):
  id: str | None = None
  name: str
  type: Literal["image", "map", "document", "other"] = "image"
  url: str = ""
  description: str = ""


class ModulePublishRequest(BaseModel):
  note: str | None = None


class BetaEmailOtpSendRequest(BaseModel):
  email: str


class BetaEmailOtpSendResult(BaseModel):
  status: Literal["otp_sent", "waitlist_required"]
  email: str
  historical_user: bool = False
  waitlist_open: bool = False
  expires_in_seconds: int | None = None
  resend_available_in_seconds: int | None = None


class BetaEmailOtpVerifyRequest(BaseModel):
  email: str
  code: str


class BetaAccessCredential(BaseModel):
  token: str
  expires_at: str


class BetaAccessSessionResult(BaseModel):
  email: str
  authenticated: bool = True
  expires_at: str


class BetaEmailOtpVerifyResult(BaseModel):
  email: str
  verified: bool = True
  credential: BetaAccessCredential


class BetaWaitlistRequest(BaseModel):
  email: str
  source_status: str | None = None


class BetaWaitlistResult(BaseModel):
  email: str
  status: Literal["active"] = "active"
  created: bool


class CharacterCreate(BaseModel):
  id: str | None = None
  profile: CocCharacterProfile
  characteristics: CocCharacteristics = Field(default_factory=CocCharacteristics)
  skills: dict[str, int] = Field(default_factory=dict)
  inventory: list[CocItem] = Field(default_factory=list)
  status: CocCharacterStatus | None = None


class XPUpdate(BaseModel):
  xp_delta: int


class SkillCheck(BaseModel):
  skill_name: str
  success: bool


class SessionCreate(BaseModel):
  scenario_id: str
  investigator_id: str
  user_id: str | None = None


class ActionRequest(BaseModel):
  session_id: str
  message: str
  check_result: CocCheckResult | None = None


class CheckResolutionRequest(BaseModel):
  check: CocCheckRequest
  roll_value: int | None = None


class ExternalActionRequest(BaseModel):
  session_id: str
  player_action: str
  result: dict | str
