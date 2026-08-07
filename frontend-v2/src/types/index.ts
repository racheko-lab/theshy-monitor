// ============================================================
// 类型定义 — 严格基于项目真实数据（.theshy_data.json / .theshy_events.json）
// 不修改任何数据接口 / JSON 结构，仅做类型映射。
// ============================================================

export type GameType = 'SOLORANKED' | 'FLEXRANKED' | 'ARENA' | string
export type MatchResult = 'WIN' | 'LOSE'
export type Region = 'KR' | string

export interface LadderRank {
  rank: number
  total: number
}

export interface LeagueStat {
  game_type: GameType
  tier: string // GRANDMASTER / CHALLENGER / MASTER / DIAMOND ...
  division: number // 1-4
  lp: number
  tier_image_url: string
  border_image_url: string
  win: number
  lose: number
  play: number
  /** 王者/宗师门槛信息（可选） */
  high_leagues?: Array<{ tier: string; lp: number }>
}

export interface ChampionStat {
  champion_id: number
  champion: string
  count: number
  win: number
  lose: number
  kda: string
  cs: number
  gold: number
  damage: number
}

export interface RecentChampionStat {
  champion_id: number
  champion: string
  count: number
  win: number
  lose: number
}

export interface Profile {
  id: number
  summoner_id: number
  acct_id: number
  puuid: string
  game_name: string
  tagline: string
  name: string // 韩文名
  internal_name: string
  profile_image_url: string
  level: number
  updated_at: string
  renewable_at: string
  revision_at: string
  recent_videos_added_count: number
  has_highlight: boolean
  ladder_rank: LadderRank
  league_stats: LeagueStat[]
  previous_seasons: unknown[]
  previous_season_tiers: unknown[]
  current_season_high_tiers: unknown[]
  lp_histories: unknown[]
  most_champions: ChampionStat[]
  ranked_most_champions: ChampionStat[]
  recent_champion_stats: RecentChampionStat[]
}

export interface Match {
  id: string
  created_at: string
  game_type: GameType
  game_length_second: number
  game_map: string
  champion_id: number
  champion: string
  team_key: string
  position: string
  kill: number
  death: number
  assist: number
  kda: string
  result: MatchResult
  op_score: number
  op_score_rank: number
  gold_earned: number
  minion_kill: number
  neutral_minion_kill: number
  total_damage_dealt_to_champions: number
}

export interface AccountState {
  is_active: boolean
  last_check: string
  last_match_id: string
  matches_count: number
}

export interface Account {
  slug: 'main' | 'smurf' | string
  label: string
  game_name: string
  tag_line: string
  region: Region
  profile: Profile
  matches: Match[]
  state: AccountState
}

export interface BilibiliState {
  is_live: boolean
  is_ig_live: boolean
  title: string
  live_time: string // '0000-00-00 00:00:00' 表示未直播
  room_id: number
  last_check: string
  notified_title: string
}

export interface HupuPlayer {
  name: string
  role: string
  score: number | null
  head_image?: string
}

export interface HupuMatch {
  id: string
  out_biz_no: string
  title: string
  url: string
  score: string
  home: string
  away: string
  home_logo: string
  away_logo: string
  home_score: number
  away_score: number
  ig_tid: string
  ig_win: boolean
  ig_home: boolean
  opponent: string
  ig_score: number
  opp_score: number
  ig_players: HupuPlayer[]
  opp_players: HupuPlayer[]
  games: unknown[]
  league_name: string
  round_name: string
  match_time: string
  date_str: string
  found_at: string
}

export interface HupuRatings {
  team: string
  matches: HupuMatch[]
  latest_match: HupuMatch | null
  schedule: unknown
  next_match: {
    home: string
    away: string
    home_logo: string
    away_logo: string
    match_time?: string
    date_str?: string
    time_str?: string
    stage?: string
    status_desc?: string
    status?: string
    ig_side?: string
    opponent?: string
    opponent_logo?: string
    ig_logo?: string
  } | null
  upcoming: unknown
  last_check: string
}

export interface DailyStat {
  label: string
  today_matches: number
  win: number
  lose: number
  win_rate: string
  streak: number
  streak_type: 'win' | 'lose' | null
}

export interface AppData {
  accounts: Account[]
  last_update: string
  bilibili: BilibiliState
  hupu_ratings: HupuRatings
  daily_stats: { main: DailyStat; smurf: DailyStat }
  quiet_hours?: unknown
}

// ============================================================
// 事件联合类型（基于 .theshy_events.json）
// type 分布: opgg_updated(噪声) / new_match / lp_changed /
//           level_changed / losing_streak / rank_changed /
//           became_active / bilibili_live / hupu_rating
// ============================================================

interface BaseEvent {
  timestamp: string
}

export interface OpggUpdatedEvent extends BaseEvent {
  type: 'opgg_updated'
  account: string
  slug: string
  updated_at: string
  level: number
  is_active: boolean
}

export interface NewMatchEvent extends BaseEvent {
  type: 'new_match'
  account: string
  slug: string
  match_id: string
  game_type: GameType
  champion: string
  result: MatchResult
  kda: string
  kill: number
  death: number
  assist: number
  created_at: string
  game_length_second?: number
}

export interface LpChangedEvent extends BaseEvent {
  type: 'lp_changed'
  account: string
  slug: string
  game_type: GameType
  old_lp: number
  new_lp: number
  delta: number
  tier: string
  division: number
}

export interface LevelChangedEvent extends BaseEvent {
  type: 'level_changed'
  account: string
  slug: string
  old: number
  new: number
}

export interface StreakEvent extends BaseEvent {
  type: 'winning_streak' | 'losing_streak'
  account: string
  slug: string
  streak: number
  matches?: Match[]
}

export interface RankChangedEvent extends BaseEvent {
  type: 'rank_changed'
  account: string
  slug: string
  game_type: GameType
  old: string
  new: string
}

export interface BecameActiveEvent extends BaseEvent {
  type: 'became_active'
  account?: string
  slug: string
}

export interface BilibiliLiveEvent extends BaseEvent {
  type: 'bilibili_live'
  kind: 'ig_live_start' | 'ig_live_end' | string
  title: string
  room_id: number
}

export interface HupuRatingEvent extends BaseEvent {
  type: 'hupu_rating'
  kind: string
  title: string
}

export type AppEvent =
  | OpggUpdatedEvent
  | NewMatchEvent
  | LpChangedEvent
  | LevelChangedEvent
  | StreakEvent
  | RankChangedEvent
  | BecameActiveEvent
  | BilibiliLiveEvent
  | HupuRatingEvent

export interface InlineData {
  data: AppData
  events: AppEvent[]
}
