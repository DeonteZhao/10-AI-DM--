export type JsonMap = Record<string, unknown>;

export type CocRuleSystem = 'coc';

export const COC_BASELINE_MODULE_ID = 'coc_zhuishuren';
export const COC_BASELINE_MODULE_NAME = '追书人';

export type CocHandoutType = 'text' | 'image' | 'mixed';
export type CocAssetType = 'image' | 'map' | 'document' | 'other';
export type CocClueVisibility = 'explicit' | 'hidden';
export type CocChatSender = 'player' | 'dm';
export type CocChatMessageType = 'narrative' | 'dialog' | 'system' | 'roll';
export type CocInventoryCategory =
  | 'weapon'
  | 'armor'
  | 'boots'
  | 'ring'
  | 'necklace'
  | 'consumable'
  | 'key'
  | 'tool'
  | 'misc'
  | 'document';

export interface CocExtensibleEntity {
  tags?: string[];
  extra?: JsonMap;
}

export interface CocSensoryDetails {
  visual?: string | null;
  auditory?: string | null;
  olfactory?: string | null;
}

export interface CocRollResult {
  expression: string;
  value: number;
  details: number[];
}

export interface CocStatePatch {
  current_scene_id?: string | null;
  current_location_id?: string | null;
  add_discovered_clue_ids?: string[];
  add_granted_handout_ids?: string[];
  add_triggered_rule_ids?: string[];
  merge_flags?: JsonMap;
  time_progress_delta?: number | null;
}

export interface CocCheckRequest {
  check_id: string;
  action: string;
  kind: 'skill' | 'characteristic';
  key: string;
  name: string;
  difficulty?: 'regular' | 'hard' | 'extreme';
  target_override?: number | null;
  reason?: string | null;
}

export interface CocCheckResult {
  check_id: string;
  action: string;
  kind: 'skill' | 'characteristic';
  key: string;
  name: string;
  target: number;
  required_threshold: number;
  difficulty: 'regular' | 'hard' | 'extreme';
  passed: boolean;
  level: 'fumble' | 'failure' | 'regular' | 'hard' | 'extreme' | 'critical';
  roll: CocRollResult;
  narrative?: string | null;
  consequence?: string | null;
  state_patch?: CocStatePatch | null;
}

export interface CocCharacterProfile {
  name: string;
  occupation?: string | null;
  age?: number | null;
  residence?: string | null;
  birthplace?: string | null;
  avatar?: string | null;
  backstory?: string | null;
}

export interface CocCharacteristics {
  str?: number;
  con?: number;
  siz?: number;
  dex?: number;
  app?: number;
  int?: number;
  pow?: number;
  edu?: number;
  luck?: number;
}

export interface CocValueTrack {
  current: number;
  maximum: number;
}

export interface CocCharacterStatus {
  hp: CocValueTrack;
  mp: CocValueTrack;
  san: CocValueTrack;
  conditions: string[];
  flags: JsonMap;
}

export interface CocItem extends CocExtensibleEntity {
  id: string;
  name: string;
  description: string;
  category: CocInventoryCategory;
  origin?: 'base' | 'module' | 'custom';
  quantity: number;
  is_equipped?: boolean;
  stats?: JsonMap;
  linked_clue_id?: string | null;
}

export interface CocInvestigator extends CocExtensibleEntity {
  id: string;
  rule_system: CocRuleSystem;
  profile: CocCharacterProfile;
  characteristics: CocCharacteristics;
  skills: Record<string, number>;
  inventory: CocItem[];
  status: CocCharacterStatus;
}

export interface CocLocation extends CocExtensibleEntity {
  id?: string;
  name: string;
  description: string;
  connections: string[];
  npcs: string[];
  type?: string | null;
  subtype?: string | null;
  sensory_details?: CocSensoryDetails | null;
  tactical_elements?: string | null;
  hidden_treasures?: string | null;
  atmosphere?: string | null;
  hidden_clues?: string | null;
}

export interface CocNpc extends CocExtensibleEntity {
  id?: string;
  name: string;
  description: string;
  type?: string | null;
  subtype?: string | null;
  secrets?: string | null;
  personality?: string | null;
  appearance?: string | null;
  alignment?: string | null;
  combat_behavior?: string | null;
  secrets_and_lies?: string | null;
  sanity_state?: string | null;
}

export interface CocEvent extends CocExtensibleEntity {
  trigger: string;
  result: string;
  type?: string | null;
  subtype?: string | null;
  consequences?: string | null;
  encounter_type?: string | null;
  sanity_check_trigger?: string | null;
}

export interface CocQuest extends CocExtensibleEntity {
  name: string;
  goal: string;
  status?: string | null;
}

export interface CocScene extends CocExtensibleEntity {
  id: string;
  title: string;
  location_id?: string | null;
  order?: number | null;
  description: string;
  prerequisites: string[];
}

export interface CocTriggerCondition extends CocExtensibleEntity {
  type: 'location' | 'scene' | 'action' | 'state' | 'check_result' | 'clue' | 'handout' | 'time';
  key?: string | null;
  operator?: 'eq' | 'contains' | 'gte' | 'lte';
  value: string;
}

export interface CocTriggerAction extends CocExtensibleEntity {
  type: 'reveal_clue' | 'grant_handout' | 'update_state' | 'branch_scene' | 'move_location';
  target_id?: string | null;
  payload?: JsonMap;
}

export interface CocTriggerRule extends CocExtensibleEntity {
  id: string;
  name: string;
  type?: string | null;
  subtype?: string | null;
  once: boolean;
  conditions: CocTriggerCondition[];
  actions: CocTriggerAction[];
}

export interface CocClue extends CocExtensibleEntity {
  id: string;
  title: string;
  content: string;
  type?: string | null;
  subtype?: string | null;
  source?: string | null;
  discovery_conditions: string[];
  visibility?: CocClueVisibility | null;
  trigger_ref?: string | null;
  discovery_method?: string | null;
  gm_notes?: string | null;
  sanity_cost?: string | null;
  mythos_knowledge?: boolean | null;
}

export interface CocHandout extends CocExtensibleEntity {
  id: string;
  title: string;
  content: string;
  subtype?: string | null;
  type: CocHandoutType;
  asset_ids: string[];
  grant_conditions: string[];
  add_to_inventory: boolean;
}

export interface CocSceneItem extends CocExtensibleEntity {
  id: string;
  name: string;
  location_id: string;
  description: string;
  type?: string | null;
  subtype?: string | null;
  interactions: string[];
  linked_clue_ids: string[];
  magical_properties?: string | null;
}

export interface CocAsset extends CocExtensibleEntity {
  id: string;
  name: string;
  subtype?: string | null;
  type: CocAssetType;
  url: string;
  description: string;
}

export interface CocScenario extends CocExtensibleEntity {
  module_id?: string;
  source_type?: string | null;
  status: 'draft' | 'published';
  rule_system: CocRuleSystem;
  tone?: string | null;
  core_conflict?: string | null;
  themes: string[];
  title: string;
  background: string;
  locations: CocLocation[];
  npcs: CocNpc[];
  events: CocEvent[];
  quests: CocQuest[];
  schema_version: number;
  sequence: CocScene[];
  triggers: CocTriggerRule[];
  clues: CocClue[];
  handouts: CocHandout[];
  scene_items: CocSceneItem[];
  assets: CocAsset[];
  extensions: JsonMap;
  custom_types: JsonMap[];
}

export interface CocSessionState {
  current_scene_id?: string | null;
  current_location_id?: string | null;
  discovered_clue_ids: string[];
  granted_handout_ids: string[];
  triggered_rule_ids: string[];
  flags: JsonMap;
  time_progress?: number | null;
}

export interface CocSession {
  id: string;
  rule_system: CocRuleSystem;
  scenario_id: string;
  investigator_id: string;
  started_at: string;
  updated_at: string;
  state: CocSessionState;
}

export interface CocInvestigatorRecord extends CocInvestigator {
  created_at: string;
}

export interface CocInvestigatorCreatePayload {
  id?: string;
  profile: CocCharacterProfile;
  characteristics: CocCharacteristics;
  skills: Record<string, number>;
  inventory?: CocItem[];
  status?: CocCharacterStatus;
}

export interface CocSessionCreatePayload {
  scenario_id: string;
  investigator_id: string;
  user_id?: string | null;
}

export interface CocModuleSummary {
  id: string;
  name: string;
  type: CocRuleSystem;
  description: string;
  difficulty: string;
  players: string;
  image: string;
  publisher: string;
  price: string;
  tags: string[];
}
