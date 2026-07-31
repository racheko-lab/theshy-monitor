#!/usr/bin/env python3
"""
TheShy 排位监控 - 基于 OP.GG MCP API (完整数据版)

数据源: https://mcp-api.op.gg/mcp (官方 MCP, 免费, 无需认证)
部署: GitHub Actions + GitHub Pages (零成本)
推送: Bark / Server酱 / Discord (任选)
"""

import os
import sys
import json
import time
import re
import shutil
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

# ============================================================
# 配置
# ============================================================
OPGG_MCP_URL = "https://mcp-api.op.gg/mcp"
OPGG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}
KST = timezone(timedelta(hours=9))

BASE_DIR = Path(__file__).parent

# 多账号监控列表: (slug, game_name, tag_line, region, label)
# slug 用于文件名, label 用于前端显示
DEFAULT_ACCOUNTS = [
    ("main",   "The shy", "asdf", "KR", "The shy#asdf"),
    ("smurf",  "은여하",   "1103", "KR", "은여하#1103"),
]

# 全局事件/状态文件
EVENTS_FILE = BASE_DIR / ".theshy_events.json"
COMBINED_DATA_FILE = BASE_DIR / ".theshy_data.json"
MAX_EVENTS = 100

CST = timezone(timedelta(hours=8))

LPL_MATCHES = [
    {"date": "2026-07-25", "time": "17:00", "team_a": "IG", "team_b": "WBG", "stage": "2026 LPL 第三赛段"},
    {"date": "2026-08-02", "time": "17:00", "team_a": "LNG", "team_b": "IG", "stage": "2026 LPL 第三赛段"},
    {"date": "2026-08-06", "time": "17:00", "team_a": "IG", "team_b": "NIP", "stage": "2026 LPL 第三赛段"},
    {"date": "2026-08-09", "time": "15:00", "team_a": "IG", "team_b": "LNG", "stage": "2026 LPL 第三赛段"},
    {"date": "2026-08-16", "time": "17:00", "team_a": "WBG", "team_b": "IG", "stage": "2026 LPL 第三赛段"},
    {"date": "2026-08-22", "time": "17:00", "team_a": "NIP", "team_b": "IG", "stage": "2026 LPL 第三赛段"},
]

MATCH_REMINDER_STATE_FILE = BASE_DIR / ".theshy_match_reminders.json"

BILIBILI_ROOM_ID = 6
BILIBILI_LIVE_STATE_FILE = BASE_DIR / ".theshy_bilibili_state.json"
BILIBILI_API = "https://api.live.bilibili.com/room/v1/Room/get_info"
BILIBILI_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Referer": "https://live.bilibili.com/",
}

# 虎扑LPL比赛评分
HUPU_LOL_URL = "https://bbs.hupu.com/lol"
HUPU_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}
HUPU_RATINGS_STATE_FILE = BASE_DIR / ".theshy_hupu_ratings.json"
HUPU_TEAM = "IG"  # 监控的战队

# 旧版单账号文件 (为前端兼容保留, 主账号写这些)
LEGACY_STATE_FILE = BASE_DIR / ".theshy_opgg_state.json"
LEGACY_PROFILE_FILE = BASE_DIR / ".theshy_profile.json"
LEGACY_MATCHES_FILE = BASE_DIR / ".theshy_matches.json"

DEFAULT_INTERVAL = 180  # 本地运行用, GitHub Actions 用 --once 模式


# ============================================================
# OP.GG Python-repr 通用解析器
# 把 OP.GG MCP 返回的 "ClassName(arg1, arg2, Nested(...))" 转成 dict/list
# ============================================================
def parse_repr(text):
    """把 OP.GG 自定义的 Python-repr 字符串转成 JSON-able 结构

    OP.GG 返回格式:
        class LolGetSummonerProfile: data
        class Data: summoner
        class Summoner: field1, field2, ...

        LolGetSummonerProfile(Data(Summoner(val1, val2, ...)))

    前面几行是 schema 描述 (ClassName + 字段列表),
    最后一行才是实际数据 (一个 ClassName(...) 调用)。
    我们用 schema 给每个 class 的位置参数命名, 转成 dict。
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # 空数组
    if text == "[]":
        return []
    if text in ("None", "null"):
        return None
    if text == "True":
        return True
    if text == "False":
        return False

    # 字符串字面量
    if text.startswith('"') and text.endswith('"'):
        return _unescape_str(text[1:-1])

    # 数字
    if re.fullmatch(r'-?\d+', text):
        try:
            return int(text)
        except ValueError:
            return text
    if re.fullmatch(r'-?\d+\.\d+', text):
        try:
            return float(text)
        except ValueError:
            return text

    # 数组
    if text.startswith("[") and text.endswith("]"):
        return _parse_list_body(text[1:-1])

    # 提取 schema: 每个 "class Xxx: field1, field2, ..." 一行
    schema = {}
    data_lines = []
    for ln in text.split("\n"):
        s = ln.strip()
        if not s:
            continue
        if s.startswith("class "):
            # class ClassName: field1, field2, ...
            m = re.match(r'class\s+(\w+)\s*:\s*(.*)$', s)
            if m:
                cname = m.group(1)
                fields_str = m.group(2).strip()
                if fields_str:
                    fields = [f.strip() for f in fields_str.split(",") if f.strip()]
                    schema[cname] = fields
        else:
            data_lines.append(ln)

    if not data_lines:
        return text

    # 把多行数据合并 (新行可能出现在数据内部)
    data_text = " ".join(ln.strip() for ln in data_lines)

    # 用 schema 解析数据
    return _parse_call_with_schema(data_text, schema)


def _parse_call_with_schema(text, schema):
    """解析 ClassName(args), 用 schema 给位置参数命名"""
    text = text.strip()
    if not text:
        return None

    # 标量
    if text == "[]":
        return []
    if text in ("None", "null"):
        return None
    if text == "True":
        return True
    if text == "False":
        return False
    if text.startswith('"') and text.endswith('"'):
        return _unescape_str(text[1:-1])
    if re.fullmatch(r'-?\d+', text):
        try:
            return int(text)
        except ValueError:
            return text
    if re.fullmatch(r'-?\d+\.\d+', text):
        try:
            return float(text)
        except ValueError:
            return text
    if text.startswith("[") and text.endswith("]"):
        return [_parse_call_with_schema(p, schema) for p in _split_top_level(text[1:-1])]

    # ClassName(args) 形式
    m = re.match(r'^(\w+)\((.*)\)$', text, re.DOTALL)
    if m:
        class_name = m.group(1)
        body = m.group(2).strip()

        # 整个 body 就是一个 [array]
        # 如果 class 在 schema 中且只有一个字段, 把整个 array 作为该字段的值
        # 否则直接返回 list
        if body.startswith("[") and body.endswith("]"):
            inner = body[1:-1].strip()
            if not inner:
                fields = schema.get(class_name, [])
                if fields and len(fields) == 1:
                    return {"_class": class_name, fields[0]: []}
                return []
            items = [_parse_call_with_schema(p, schema) for p in _split_top_level(inner)]
            fields = schema.get(class_name, [])
            if fields and len(fields) == 1:
                return {"_class": class_name, fields[0]: items}
            return items

        # 解析参数
        args, kwargs = _parse_call_args_with_schema(body, schema)
        if args and not kwargs:
            # 位置参数: 用 schema 命名
            fields = schema.get(class_name, [])
            if fields and len(fields) >= len(args):
                out = {"_class": class_name}
                for i, val in enumerate(args):
                    if i < len(fields):
                        out[fields[i]] = val
                return out
            # 没 schema, 直接返回 list
            return args
        if kwargs:
            return {"_class": class_name, **kwargs}
        return None

    return text


def _parse_call_args_with_schema(body, schema):
    """解析 ClassName(arg1, arg2, key=val) 的参数, 递归用 schema"""
    parts = _split_top_level(body)
    args = []
    kwargs = {}
    for p in parts:
        m = re.match(r'^(\w+)=(.*)$', p, re.DOTALL)
        if m:
            kwargs[m.group(1)] = _parse_call_with_schema(m.group(2).strip(), schema)
        else:
            args.append(_parse_call_with_schema(p, schema))
    return args, kwargs


def _unescape_str(s):
    """反转义 Python 字符串字面量"""
    out = []
    i = 0
    while i < len(s):
        if s[i] == '\\' and i + 1 < len(s):
            nxt = s[i + 1]
            mapping = {'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\', "'": "'"}
            out.append(mapping.get(nxt, nxt))
            i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


def _split_top_level(s):
    """按逗号切分, 但不进入括号/引号内部"""
    parts = []
    buf = []
    depth = 0
    in_str = False
    escape = False
    for c in s:
        if escape:
            buf.append(c)
            escape = False
            continue
        if c == '\\':
            buf.append(c)
            escape = True
            continue
        if c == '"':
            in_str = not in_str
            buf.append(c)
            continue
        if in_str:
            buf.append(c)
            continue
        if c in "([{":
            depth += 1
            buf.append(c)
        elif c in ")]}":
            depth -= 1
            buf.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(c)
    if buf:
        parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


# ============================================================
# OP.GG MCP 客户端
# ============================================================
class OpggClient:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self._rpc_id = 100

    def _call(self, tool_name, arguments):
        self._rpc_id += 1
        payload = {
            "jsonrpc": "2.0", "id": self._rpc_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }
        for attempt in range(3):
            try:
                r = requests.post(OPGG_MCP_URL, headers=OPGG_HEADERS,
                                  json=payload, timeout=30)
                r.raise_for_status()
                data = r.json()
                if "error" in data:
                    return {"error": data["error"]}
                content = data.get("result", {}).get("content", [])
                if content and isinstance(content, list):
                    return {"text": content[0].get("text", "")}
                return {"text": ""}
            except requests.RequestException as e:
                if self.verbose:
                    print(f"  [retry {attempt+1}/3] {e}")
                time.sleep(2 ** attempt)
        return {"error": "request_failed"}

    def get_summoner_profile(self, game_name, tag_line, region="KR"):
        return self._call("lol_get_summoner_profile", {
            "game_name": game_name, "tag_line": tag_line,
            "region": region, "lang": "zh_CN",
        })

    def list_matches(self, game_name, tag_line, region="KR", limit=20):
        return self._call("lol_list_summoner_matches", {
            "game_name": game_name, "tag_line": tag_line,
            "region": region, "lang": "zh_CN", "limit": limit,
        })

    def get_match_detail(self, match_id, created_at, region="KR"):
        """拉单场比赛详情 (含所有玩家)"""
        return self._call("lol_get_summoner_game_detail", {
            "game_id": match_id, "region": region, "lang": "zh_CN",
            "created_at": created_at,
        })


# ============================================================
# 通知层
# ============================================================
def html_to_text(html):
    if not html:
        return ""
    text = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</tr>|</li>', '\n', html)
    text = re.sub(r'(?i)<tr[^>]*>|<li[^>]*>|<p[^>]*>|<div[^>]*>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = (text.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
                .replace("&nbsp;", " "))
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def send_bark(bark_key, title, body):
    if not bark_key:
        return False
    if bark_key.startswith("http"):
        base = bark_key.rstrip("/")
    else:
        base = f"https://api.day.app/{bark_key}"
    try:
        r = requests.post(base, json={
            "title": title, "body": body, "group": "theshy",
        }, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def send_serverchan(key, title, body):
    if not key:
        return False
    try:
        r = requests.post(f"https://sctapi.ftqq.com/{key}.send",
                          data={"title": title, "desp": body}, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def send_discord(webhook, title, body):
    if not webhook:
        return False
    try:
        r = requests.post(webhook, json={
            "username": "TheShy Monitor",
            "embeds": [{"title": title, "description": body[:1900], "color": 0xFF5555}],
        }, timeout=10)
        return r.status_code in (200, 204)
    except requests.RequestException:
        return False


def notify(title, body, cfg):
    body = html_to_text(body)
    results = []
    if cfg.get("BARK_KEY"):
        results.append(("bark", send_bark(cfg["BARK_KEY"], title, body)))
    if cfg.get("SERVERCHAN_KEY"):
        results.append(("serverchan", send_serverchan(cfg["SERVERCHAN_KEY"], title, body)))
    if cfg.get("DISCORD_WEBHOOK"):
        results.append(("discord", send_discord(cfg["DISCORD_WEBHOOK"], title, body)))
    return results


# ============================================================
# 状态持久化
# ============================================================
def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def load_json(path, default=None):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return default if default is not None else {}


LEGACY_STATE_FILE = BASE_DIR / ".theshy_opgg_state.json"


def load_state(slug="main"):
    new_path = BASE_DIR / f".theshy_state_{slug}.json"
    if new_path.exists():
        return load_json(new_path, {})
    if slug == "main" and LEGACY_STATE_FILE.exists():
        data = load_json(LEGACY_STATE_FILE, {})
        save_json(new_path, data)
        return data
    return {}


def save_state(slug, state):
    save_json(BASE_DIR / f".theshy_state_{slug}.json", state)


def append_event(event):
    events = load_json(EVENTS_FILE, [])
    if not isinstance(events, list):
        events = []
    event = {**event, "timestamp": datetime.now(KST).isoformat()}
    events.insert(0, event)
    events = events[:MAX_EVENTS]
    save_json(EVENTS_FILE, events)


# ============================================================
# 时间工具
# ============================================================
def kst_now():
    return datetime.now(KST)


def fmt_kst(iso_str):
    if not iso_str:
        return "-"
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=KST)
        return dt.astimezone(KST).strftime("%m-%d %H:%M")
    except Exception:
        return iso_str[:16]


def age_string(iso):
    if not iso:
        return "-"
    try:
        dt = datetime.fromisoformat(iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=KST)
        age_sec = (datetime.now(KST) - dt).total_seconds()
        if age_sec < 60:
            return f"{int(age_sec)} 秒前"
        if age_sec < 3600:
            return f"{int(age_sec / 60)} 分钟前"
        if age_sec < 86400:
            return f"{int(age_sec / 3600)} 小时前"
        return f"{int(age_sec / 86400)} 天前"
    except Exception:
        return "?"


# ============================================================
# 主检测逻辑
# ============================================================
def _deep_get(obj, *keys, default=None):
    """安全地从嵌套 dict/list 中取值"""
    cur = obj
    for k in keys:
        if cur is None:
            return default
        if isinstance(k, int):
            if not isinstance(cur, list) or k >= len(cur):
                return default
            cur = cur[k]
        else:
            if not isinstance(cur, dict) or k not in cur:
                return default
            cur = cur[k]
    return cur if cur is not None else default


def normalize_summoner(parsed):
    """从 parse_repr 结果中提取召唤师关键字段, 返回标准 dict"""
    # parsed 可能是 {"_class": "LolGetSummonerProfile", "_args": [{"_class": "Data", "summoner": {...}}]}
    # 我们直接深找 "summoner"
    summoner = _find_key(parsed, "summoner")
    if not summoner:
        return {}

    # 提取常用字段
    get = lambda *keys, **kw: _deep_get(summoner, *keys, default=kw.get("default"))

    info = {
        "id": get("id"),
        "summoner_id": get("summoner_id"),
        "acct_id": get("acct_id"),
        "puuid": get("puuid"),
        "game_name": get("game_name"),
        "tagline": get("tagline"),
        "name": get("name"),
        "internal_name": get("internal_name"),
        "profile_image_url": get("profile_image_url"),
        "level": get("level"),
        "updated_at": get("updated_at"),
        "renewable_at": get("renewable_at"),
        "revision_at": get("revision_at"),
        "recent_videos_added_count": get("recent_videos_added_count"),
        "has_highlight": get("has_highlight"),
    }

    # ladder_rank
    ladder = get("ladder_rank")
    if isinstance(ladder, dict):
        info["ladder_rank"] = {
            "rank": ladder.get("rank"),
            "total": ladder.get("total"),
        }

    # league_stats
    league_stats = get("league_stats") or []
    info["league_stats"] = []
    for ls in league_stats:
        if not isinstance(ls, dict):
            continue
        ti = ls.get("tier_info") or {}
        mr = ls.get("match_record") or {}
        info["league_stats"].append({
            "game_type": ls.get("game_type"),
            "tier": ti.get("tier"),
            "division": ti.get("division"),
            "lp": ti.get("lp"),
            "tier_image_url": ti.get("tier_image_url"),
            "border_image_url": ti.get("border_image_url"),
            "win": ls.get("win"),
            "lose": ls.get("lose"),
            "play": mr.get("play"),
            "match_win": mr.get("win"),
            "match_lose": mr.get("lose"),
            "is_hot_streak": ls.get("is_hot_streak"),
            "is_fresh_blood": ls.get("is_fresh_blood"),
            "is_veteran": ls.get("is_veteran"),
            "is_inactive": ls.get("is_inactive"),
            "updated_at": ls.get("updated_at"),
            "high_leagues": ls.get("high_leagues") or [],
        })

    # previous_seasons
    info["previous_seasons"] = []
    for ps in (get("previous_seasons") or []):
        if isinstance(ps, dict):
            ti = ps.get("tier_info") or {}
            info["previous_seasons"].append({
                "season_id": ps.get("season_id"),
                "tier": ti.get("tier"),
                "division": ti.get("division"),
                "lp": ti.get("lp"),
            })

    # previous_season_tiers
    info["previous_season_tiers"] = []
    for pst in (get("previous_season_tiers") or []):
        if not isinstance(pst, dict):
            continue
        rank_entries = pst.get("rank_entries") or pst.get("_args") or []
        for re in rank_entries:
            if not isinstance(re, dict):
                continue
            ri = re.get("rank_info") or {}
            hri = re.get("high_rank_info") or {}
            info["previous_season_tiers"].append({
                "season_id": pst.get("season_id"),
                "game_type": re.get("game_type"),
                "tier": ri.get("tier"),
                "division": ri.get("division"),
                "lp": ri.get("lp"),
                "win": ri.get("win"),
                "lose": ri.get("lose"),
                "elo": ri.get("elo"),
                "created_at": ri.get("created_at"),
                "high_tier": hri.get("tier") if hri else None,
                "high_division": hri.get("division") if hri else None,
                "high_lp": hri.get("lp") if hri else None,
            })

    # current_season_high_tiers
    csht = get("current_season_high_tiers")
    if isinstance(csht, dict):
        info["current_season_high_tiers"] = {
            "season_id": csht.get("season_id"),
            "rank_entries": csht.get("rank_entries") or [],
        }

    # lp_histories
    info["lp_histories"] = []
    for lh in (get("lp_histories") or []):
        if isinstance(lh, dict):
            ti = lh.get("tier_info") or {}
            info["lp_histories"].append({
                "created_at": lh.get("created_at"),
                "elo_point": lh.get("elo_point"),
                "tier": ti.get("tier"),
                "division": ti.get("division"),
                "lp": ti.get("lp"),
            })

    # most_champions (本赛季所有模式)
    mc = get("most_champions")
    info["most_champions"] = _extract_champion_stats(mc)

    # ranked_most_champions (排位专属, 含 basic+extend 详细数据)
    rmc = get("ranked_most_champions")
    info["ranked_most_champions"] = _extract_ranked_champion_stats(rmc)

    # recent_champion_stats
    info["recent_champion_stats"] = []
    for rcs in (get("recent_champion_stats") or []):
        if isinstance(rcs, dict):
            info["recent_champion_stats"].append({
                "champion_name": rcs.get("champion_name"),
                "id": rcs.get("id"),
                "play": rcs.get("play"),
                "win": rcs.get("win"),
                "kill": rcs.get("kill"),
                "death": rcs.get("death"),
                "assist": rcs.get("assist"),
            })

    # highlight_info
    hi = get("highlight_info")
    if isinstance(hi, dict):
        info["highlight_info"] = {
            "created_at": hi.get("created_at"),
            "scene_type": hi.get("scene_type") or [],
        }

    return info


def _extract_champion_stats(mc):
    """从 MostChampions 提取英雄统计"""
    if not isinstance(mc, dict):
        return None
    out = {
        "game_type": mc.get("game_type"),
        "season_id": mc.get("season_id"),
        "year": mc.get("year"),
        "play": mc.get("play"),
        "win": mc.get("win"),
        "lose": mc.get("lose"),
        "champion_stats": [],
    }
    for cs in (mc.get("champion_stats") or []):
        if not isinstance(cs, dict):
            continue
        out["champion_stats"].append({
            "id": cs.get("id"),
            "champion_name": cs.get("champion_name"),
            "play": cs.get("play"),
            "win": cs.get("win"),
            "lose": cs.get("lose"),
            "kill": cs.get("kill"),
            "death": cs.get("death"),
            "assist": cs.get("assist"),
            "kda": _calc_kda(cs.get("kill"), cs.get("death"), cs.get("assist")),
            "win_rate": _calc_win_rate(cs.get("win"), cs.get("play")),
            "game_length_second": cs.get("game_length_second"),
            "gold_earned": cs.get("gold_earned"),
            "minion_kill": cs.get("minion_kill"),
            "neutral_minion_kill": cs.get("neutral_minion_kill"),
            "damage_dealt_to_champions": cs.get("damage_dealt_to_champions"),
            "damage_taken": cs.get("damage_taken"),
            "double_kill": cs.get("double_kill"),
            "triple_kill": cs.get("triple_kill"),
            "quadra_kill": cs.get("quadra_kill"),
            "penta_kill": cs.get("penta_kill"),
            "vision_wards_bought_in_game": cs.get("vision_wards_bought_in_game"),
            "op_score": cs.get("op_score"),
        })
    # 按 play 降序
    out["champion_stats"].sort(key=lambda x: x.get("play", 0) or 0, reverse=True)
    return out


def _extract_ranked_champion_stats(rmc):
    """从 RankedMostChampions 提取排位英雄详细数据 (basic + extend)"""
    if not isinstance(rmc, dict):
        return None
    out = {
        "game_type": rmc.get("game_type"),
        "season_id": rmc.get("season_id"),
        "play": rmc.get("play"),
        "win": rmc.get("win"),
        "lose": rmc.get("lose"),
        "my_champion_stats": [],
    }
    for mcs in (rmc.get("my_champion_stats") or []):
        if not isinstance(mcs, dict):
            continue
        basic = mcs.get("basic") or {}
        extend = mcs.get("extend") or {}
        out["my_champion_stats"].append({
            "id": mcs.get("id"),
            "champion_name": mcs.get("champion_name"),
            "play": mcs.get("play"),
            "win": mcs.get("win"),
            "lose": mcs.get("lose"),
            "game_second": mcs.get("game_second"),
            # basic 字段
            "b_kill": basic.get("kill"),
            "b_death": basic.get("death"),
            "b_assist": basic.get("assist"),
            "kda": _calc_kda(basic.get("kill"), basic.get("death"), basic.get("assist")),
            "win_rate": _calc_win_rate(mcs.get("win"), mcs.get("play")),
            "kill_participation": basic.get("kill_participation"),
            "damage_to_champion": basic.get("damage_to_champion"),
            "damage_participation": basic.get("damage_participation"),
            "cs": basic.get("cs"),
            "gold": basic.get("gold"),
            "vision_score": basic.get("vision_score"),
            "vision_ward": basic.get("vision_ward"),
            "ward_placed": basic.get("ward_placed"),
            "ward_kill": basic.get("ward_kill"),
            "op_score": basic.get("op_score"),
            "op_score_rank": basic.get("op_score_rank"),
            "mvp": basic.get("mvp"),
            "ace": basic.get("ace"),
            "lane_score": basic.get("lane_score"),
            "lane_lead": basic.get("lane_lead"),
            "double_kill": basic.get("double_kill"),
            "triple_kill": basic.get("triple_kill"),
            "quadra_kill": basic.get("quadra_kill"),
            "penta_kill": basic.get("penta_kill"),
            # extend 字段
            "damage_taken": extend.get("damage_taken"),
            "damage_self_mitigated": extend.get("damage_self_mitigated"),
            "heal": extend.get("heal"),
            "heal_to_team": extend.get("heal_to_team"),
            "shield_to_team": extend.get("shield_to_team"),
            "physical_damage_to_champion": extend.get("physical_damage_to_champion"),
            "magic_damage_to_champion": extend.get("magic_damage_to_champion"),
            "true_damage_to_champion": extend.get("true_damage_to_champion"),
            "damage_to_objective": extend.get("damage_to_objective"),
            "damage_to_turret": extend.get("damage_to_turret"),
            "damage_to_building": extend.get("damage_to_building"),
            "turret_kill": extend.get("turret_kill"),
            "inhibitor_kill": extend.get("inhibitor_kill"),
            "object_steal": extend.get("object_steal"),
            "cc_score": extend.get("cc_score"),
            "solo_kill": extend.get("solo_kill"),
            "make_solo_kill": extend.get("make_solo_kill"),
            "invade_kill": extend.get("invade_kill"),
            "invade_play": extend.get("invade_play"),
            "neutral_cs": extend.get("neutral_cs"),
            "buff_steal": extend.get("buff_steal"),
            "enemy_jungle_monster_kill": extend.get("enemy_jungle_monster_kill"),
            "epic_monster_kill_near_enemy_jungler": extend.get("epic_monster_kill_near_enemy_jungler"),
            "epic_monster_steal_no_smite": extend.get("epic_monster_steal_no_smite"),
            "initial_crab_kill": extend.get("initial_crab_kill"),
            "jungle_cs_10_minute": extend.get("jungle_cs_10_minute"),
            "lane_advantage_7_minute": extend.get("lane_advantage_7_minute"),
            "lane_cs_10_minute": extend.get("lane_cs_10_minute"),
            "turret_plate": extend.get("turret_plate"),
            "cc": extend.get("cc"),
            "cc_make_kill": extend.get("cc_make_kill"),
            "save_ally": extend.get("save_ally"),
            "ward_guard": extend.get("ward_guard"),
            "faster_support_quest": extend.get("faster_support_quest"),
        })
    out["my_champion_stats"].sort(key=lambda x: x.get("play", 0) or 0, reverse=True)
    return out


def _calc_kda(k, d, a):
    try:
        k = float(k or 0); d = float(d or 0); a = float(a or 0)
        if d == 0:
            return "Perfect" if k + a > 0 else "0.00"
        return f"{(k + a) / d:.2f}"
    except Exception:
        return "?"


def _calc_win_rate(w, p):
    try:
        w = float(w or 0); p = float(p or 0)
        if p == 0:
            return "0%"
        return f"{w/p*100:.1f}%"
    except Exception:
        return "?"


def _find_key(obj, key):
    """递归查找 dict 中的某个 key"""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _find_key(v, key)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_key(v, key)
            if r is not None:
                return r
    return None


# ============================================================
# 检测主函数 (单账号)
# ============================================================
def check_account(client, game_name, tag_line, region, slug, label, state, verbose=False):
    """检测单个账号, 返回 (events_list, updated_state, profile, matches_list)"""
    events = []

    # 1. profile
    resp = client.get_summoner_profile(game_name, tag_line, region)
    if "error" in resp:
        err = {"type": "error", "account": label, "msg": str(resp["error"])}
        return [err], state, None, []

    parsed = parse_repr(resp.get("text", ""))
    profile = normalize_summoner(parsed)

    if verbose:
        print(f"  [{slug}] name={profile.get('game_name')} level={profile.get('level')} "
              f"updated_at={profile.get('updated_at')}")

    # 2. matches
    matches_file = BASE_DIR / f".theshy_matches_{slug}.json"
    matches_resp = client.list_matches(game_name, tag_line, region, limit=20)
    matches_text = matches_resp.get("text", "")
    matches_parsed = parse_repr(matches_text) if matches_text else None
    matches_list = _extract_matches(matches_parsed)

    # 2.5 拉取比赛详情 (participants/10人阵容), 缓存已有详情跳过
    if not matches_file.exists() and slug == "main" and LEGACY_MATCHES_FILE.exists():
        shutil.copy(LEGACY_MATCHES_FILE, matches_file)
    existing_matches = load_json(matches_file, [])
    if not isinstance(existing_matches, list):
        existing_matches = []
    existing_map = {m.get("id"): m for m in existing_matches if m.get("id")}
    detail_count = 0
    for m in matches_list:
        mid = m.get("id")
        if not mid:
            continue
        old = existing_map.get(mid, {})
        if old.get("participants") and old.get("average_tier_info"):
            m["participants"] = old["participants"]
            m["average_tier_info"] = old["average_tier_info"]
            if old.get("teams"):
                m["teams"] = old["teams"]
            continue
        ca = m.get("created_at")
        if not ca:
            continue
        try:
            d_resp = client.get_match_detail(mid, ca, region)
            d_text = d_resp.get("text", "")
            if d_text and "error" not in d_resp:
                d_parsed = parse_repr(d_text)
                gd = _extract_game_detail(d_parsed)
                if gd:
                    m["participants"] = gd.get("participants", [])
                    m["average_tier_info"] = gd.get("average_tier_info")
                    m["teams"] = gd.get("teams", [])
                    detail_count += 1
                    time.sleep(0.3)
        except Exception as e:
            if verbose:
                print(f"  [{slug}] detail fail for {mid[:16]}: {e}")

    # 附加账号标识到每场比赛
    for m in matches_list:
        m["_account_slug"] = slug
        m["_account_label"] = label

    save_json(matches_file, matches_list)

    if verbose:
        print(f"  [{slug}] matches: {len(matches_list)} 场 (新增详情 {detail_count})")

    # 3. 判断活跃
    updated_at = profile.get("updated_at")
    now = kst_now()
    is_active = False
    if updated_at:
        try:
            upd_dt = datetime.fromisoformat(updated_at)
            if upd_dt.tzinfo is None:
                upd_dt = upd_dt.replace(tzinfo=KST)
            age_sec = (now - upd_dt.astimezone(KST)).total_seconds()
            if verbose:
                print(f"  [{slug}] updated_at age={age_sec:.0f}s")
            if 0 <= age_sec < 300:
                is_active = True
        except Exception:
            pass

    # 4. 对比上次状态
    last_state = state.get("profile", {})
    last_updated = last_state.get("updated_at")
    last_active = state.get("is_active", False)

    if last_updated and updated_at and last_updated != updated_at:
        events.append({
            "type": "opgg_updated",
            "account": label,
            "slug": slug,
            "updated_at": updated_at,
            "level": profile.get("level"),
            "is_active": is_active,
        })

    if last_state.get("level") != profile.get("level") and profile.get("level"):
        events.append({
            "type": "level_changed",
            "account": label,
            "slug": slug,
            "old": last_state.get("level"),
            "new": profile.get("level"),
        })

    # 5. 新比赛检测
    last_match_id = state.get("last_match_id")
    has_new_match = False
    new_match_event = None
    if matches_list:
        latest = matches_list[0]
        mid = latest.get("id")
        if mid and mid != last_match_id:
            has_new_match = True
            new_match_event = {
                "type": "new_match",
                "account": label,
                "slug": slug,
                "match_id": mid,
                "game_type": latest.get("game_type"),
                "champion": latest.get("champion"),
                "result": latest.get("result"),
                "kda": latest.get("kda"),
                "kill": latest.get("kill"),
                "death": latest.get("death"),
                "assist": latest.get("assist"),
                "created_at": latest.get("created_at"),
                "game_length_second": latest.get("game_length_second"),
                "position": latest.get("position"),
            }
            events.append(new_match_event)

    # 4.5 开始活跃检测 (仅在没有新比赛时通知, 避免与赛后通知重复)
    # 添加30分钟冷却, 防止游戏中OP.GG多次刷新导致重复通知
    last_active_notify = state.get("last_active_notify")
    active_cd_ok = True
    if last_active_notify:
        try:
            last_dt = datetime.fromisoformat(last_active_notify)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=KST)
            if (datetime.now(KST) - last_dt).total_seconds() < 1800:
                active_cd_ok = False
        except Exception:
            pass
    if is_active and not last_active and not has_new_match and active_cd_ok:
        events.append({
            "type": "became_active",
            "account": label,
            "slug": slug,
            "updated_at": updated_at,
            "level": profile.get("level"),
        })
        state["last_active_notify"] = datetime.now(KST).isoformat()

    # 6. 段位变化检测
    last_league = last_state.get("league_stats_summary", [])
    cur_league = [
        {"game_type": ls.get("game_type"), "tier": ls.get("tier"),
         "division": ls.get("division"), "lp": ls.get("lp")}
        for ls in (profile.get("league_stats") or [])
    ]
    if last_league and cur_league:
        for cl, ll in zip(cur_league, last_league):
            if (cl.get("tier") != ll.get("tier") or
                cl.get("division") != ll.get("division")):
                events.append({
                    "type": "rank_changed",
                    "account": label,
                    "slug": slug,
                    "game_type": cl.get("game_type"),
                    "old": f"{ll.get('tier')} {ll.get('division')}",
                    "new": f"{cl.get('tier')} {cl.get('division')}",
                })
                break

    # 6.5 LP 变化检测
    if last_league and cur_league:
        for cl, ll in zip(cur_league, last_league):
            if cl.get("tier") == ll.get("tier") and \
               cl.get("division") == ll.get("division") and \
               cl.get("lp") is not None and ll.get("lp") is not None and \
               cl.get("lp") != ll.get("lp"):
                try:
                    delta = int(cl["lp"]) - int(ll["lp"])
                    if delta != 0:
                        events.append({
                            "type": "lp_changed",
                            "account": label,
                            "slug": slug,
                            "game_type": cl.get("game_type"),
                            "old_lp": ll.get("lp"),
                            "new_lp": cl.get("lp"),
                            "delta": delta,
                            "tier": cl.get("tier"),
                            "division": cl.get("division"),
                        })
                except (TypeError, ValueError):
                    pass

    # 7. 更新 state
    state["profile"] = {
        "updated_at": updated_at,
        "level": profile.get("level"),
        "puuid": profile.get("puuid"),
        "name": profile.get("name"),
        "game_name": profile.get("game_name"),
        "tagline": profile.get("tagline"),
        "profile_image_url": profile.get("profile_image_url"),
        "internal_name": profile.get("internal_name"),
        "league_stats_summary": cur_league,
    }
    state["is_active"] = is_active
    if matches_list:
        state["last_match_id"] = matches_list[0].get("id")
    state["last_check"] = datetime.now(KST).isoformat()
    state["matches_count"] = len(matches_list)
    state["slug"] = slug
    state["label"] = label

    return events, state, profile, matches_list


def check_theshy(client, cfg, state, verbose=False):
    """兼容旧接口: 检测主账号 (第一个配置)"""
    # 从配置或环境变量读取账号列表
    accounts = _parse_accounts_config(cfg)
    if not accounts:
        accounts = DEFAULT_ACCOUNTS
    slug, game_name, tag_line, region, label = accounts[0]
    events, new_state, profile, matches = check_account(
        client, game_name, tag_line, region, slug, label, state, verbose)
    # 旧接口只返回 events 和 state
    return events, new_state


def _parse_accounts_config(cfg):
    """从环境变量/配置解析账号列表
    格式: THESHY_ACCOUNTS=slug1:name1#tag1:region1,slug2:name2#tag2:region2
    若未设置则使用 DEFAULT_ACCOUNTS
    """
    accounts_str = cfg.get("THESHY_ACCOUNTS", "").strip()
    if not accounts_str:
        return None
    accounts = []
    for part in accounts_str.split(","):
        part = part.strip()
        if not part:
            continue
        segs = part.split(":")
        if len(segs) >= 2:
            slug = segs[0]
            riot_id = segs[1]
            region = segs[2] if len(segs) > 2 else "KR"
            if "#" in riot_id:
                gn, tl = riot_id.split("#", 1)
            else:
                gn, tl = riot_id, "KR1"
            label = f"{gn}#{tl}"
            accounts.append((slug, gn, tl, region, label))
    return accounts if accounts else None


def _extract_game_detail(parsed):
    """从 game detail 解析结果中提取 participants + average_tier_info"""
    if not parsed:
        return None
    gd = _find_key(parsed, "game_detail")
    if not gd:
        gd = parsed.get("data", parsed) if isinstance(parsed, dict) else None
    if not isinstance(gd, dict):
        return None

    out = {"participants": [], "average_tier_info": None, "teams": []}

    ati = gd.get("average_tier_info")
    if isinstance(ati, dict):
        out["average_tier_info"] = {
            "tier": ati.get("tier"),
            "division": ati.get("division"),
            "border_image_url": ati.get("border_image_url"),
        }

    for t in gd.get("teams", []):
        if not isinstance(t, dict):
            continue
        team_key = t.get("key")
        bans = t.get("banned_champions_names") or []
        ban_ids = t.get("banned_champions") or []
        gs = t.get("game_stat") or {}
        for p in t.get("participants", []):
            if not isinstance(p, dict):
                continue
            s = p.get("summoner") or {}
            st = p.get("stats") or {}
            out["participants"].append({
                "summoner_name": s.get("game_name"),
                "summoner_tag": s.get("tagline"),
                "champion_id": p.get("champion_id"),
                "champion_name": p.get("champion_name"),
                "team_key": team_key,
                "position": p.get("position"),
                "items": p.get("items") or [],
                "items_names": p.get("items_names") or [],
                "spells": p.get("spells") or [],
                "rune": p.get("rune") if isinstance(p.get("rune"), dict) else {},
                "champion_level": st.get("champion_level"),
                "kill": st.get("kill"),
                "death": st.get("death"),
                "assist": st.get("assist"),
                "kda": _calc_kda(st.get("kill"), st.get("death"), st.get("assist")),
                "result": st.get("result"),
                "op_score": st.get("op_score"),
                "op_score_rank": st.get("op_score_rank"),
                "gold_earned": st.get("gold_earned"),
                "minion_kill": st.get("minion_kill"),
                "neutral_minion_kill": st.get("neutral_minion_kill"),
                "total_damage_dealt_to_champions": st.get("total_damage_dealt_to_champions"),
                "total_damage_taken": st.get("total_damage_taken"),
                "total_heal": st.get("total_heal"),
                "vision_wards_bought_in_game": st.get("vision_wards_bought_in_game"),
                "ward_place": st.get("ward_place"),
                "largest_killing_spree": st.get("largest_killing_spree"),
                "largest_multi_kill": st.get("largest_multi_kill"),
                "largest_critical_strike": st.get("largest_critical_strike"),
                "time_ccing_others": st.get("time_ccing_others"),
            })
        out["teams"].append({
            "key": team_key,
            "banned_champions": ban_ids,
            "banned_champions_names": bans,
            "game_stat": {
                "is_win": gs.get("is_win"),
                "champion_kill": gs.get("champion_kill"),
                "tower_kill": gs.get("tower_kill"),
                "dragon_kill": gs.get("dragon_kill"),
                "baron_kill": gs.get("baron_kill"),
                "inhibitor_kill": gs.get("inhibitor_kill"),
                "rift_herald_kill": gs.get("rift_herald_kill"),
                "atakhan_kill": gs.get("atakhan_kill"),
                "gold_earned": gs.get("gold_earned"),
                "champion_first": gs.get("champion_first"),
                "horde_kill": gs.get("horde_kill"),
            },
        })
    return out


def _extract_matches(parsed):
    """从 matches 解析结果中提取标准 list"""
    if not parsed:
        return []
    # parsed 可能是 {"_class": "LolListSummonerMatches", "data": {"_class": "Data", "game_history": [...]}}
    game_history = _find_key(parsed, "game_history")
    if not game_history or not isinstance(game_history, list):
        return []

    out = []
    for m in game_history:
        if not isinstance(m, dict):
            continue
        # participants[0] 是 TheShy 自己
        parts = m.get("participants") or []
        me = parts[0] if parts else {}
        stats = me.get("stats") or {} if isinstance(me, dict) else {}

        out.append({
            "id": m.get("id"),
            "created_at": m.get("created_at"),
            "game_type": m.get("game_type"),
            "game_length_second": m.get("game_length_second"),
            "game_map": m.get("game_map"),
            "champion_id": me.get("champion_id") if isinstance(me, dict) else None,
            "champion": me.get("champion_name") if isinstance(me, dict) else None,
            "team_key": me.get("team_key") if isinstance(me, dict) else None,
            "position": me.get("position") if isinstance(me, dict) else None,
            "kill": stats.get("kill"),
            "death": stats.get("death"),
            "assist": stats.get("assist"),
            "kda": _calc_kda(stats.get("kill"), stats.get("death"), stats.get("assist")),
            "result": stats.get("result"),
            "op_score": stats.get("op_score"),
            "op_score_rank": stats.get("op_score_rank"),
            "gold_earned": stats.get("gold_earned"),
            "minion_kill": stats.get("minion_kill"),
            "neutral_minion_kill": stats.get("neutral_minion_kill"),
            "total_damage_dealt_to_champions": stats.get("total_damage_dealt_to_champions"),
            "total_damage_taken": stats.get("total_damage_taken"),
            "total_heal": stats.get("total_heal"),
            "vision_wards_bought_in_game": stats.get("vision_wards_bought_in_game"),
            "ward_place": stats.get("ward_place"),
            "largest_killing_spree": stats.get("largest_killing_spree"),
            "largest_multi_kill": stats.get("largest_multi_kill"),
            "largest_critical_strike": stats.get("largest_critical_strike"),
            "time_ccing_others": stats.get("time_ccing_others"),
            "champion_level": stats.get("champion_level"),
            "items": me.get("items") if isinstance(me, dict) else None,
            "items_names": me.get("items_names") if isinstance(me, dict) else None,
            "spells": me.get("spells") if isinstance(me, dict) else None,
            "rune": me.get("rune") if isinstance(me, dict) else None,
            # 队伍信息
            "teams": m.get("teams") or [],
        })
    return out


# ============================================================
# 事件处理
# ============================================================
def handle_event(event, cfg):
    """处理事件并发送通知

    主播模式说明 (2025-10 Riot Patch 25.20 起):
    Riot API 在游戏进行中对开启 Streamer Mode 的玩家不返回数据,
    OP.GG 也无法获取 updated_at 实时刷新, 所以 became_active 事件几乎不会触发。
    主要依赖 new_match 事件 (比赛结束后 OP.GG 才能拉到) 作为通知触发器。
    """
    et = event["type"]
    acct_label = event.get("account", "")
    acct_prefix = f"[{acct_label}] " if acct_label else ""

    # 勿扰模式下，除了高优先级事件外其他静默
    if is_quiet_hours(cfg) and et not in ("error",):
        return []

    if et == "became_active":
        return notify(
            f"🎮 {acct_label} 可能开始排位了",
            f"账号: {acct_label}\n"
            f"OP.GG 数据已刷新 (updated_at: {fmt_kst(event.get('updated_at'))})\n"
            f"⚠️ 主播模式下无法获取实时对局信息, 比赛结束后会推送战绩",
            cfg,
        )
    if et == "opgg_updated":
        return []
    if et == "level_changed":
        return notify(f"📈 {acct_label} 升级",
                      f"等级: {event['old']} → {event['new']}", cfg)
    if et == "lp_changed":
        delta = event.get('delta', 0)
        sign = "+" if delta >= 0 else ""
        arrow = "📈" if delta >= 0 else "📉"
        return notify(
            f"{arrow} {acct_label} LP {sign}{delta}",
            f"{event['game_type']}: {event['old_lp']} → {event['new_lp']} LP\n"
            f"段位: {event['tier']} {event['division']}\n"
            f"变化: {sign}{delta} LP",
            cfg,
        )
    if et == "new_match":
        type_map = {"SOLORANKED": "单双排", "FLEXRANKED": "灵活组排",
                    "NORMAL": "匹配", "ARAM": "大乱斗"}
        gt = type_map.get(event["game_type"], event["game_type"])
        win = event.get("result") == "WIN"
        ago = ""
        if event.get("created_at"):
            try:
                dt = datetime.fromisoformat(event["created_at"])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=KST)
                age_min = int((datetime.now(KST) - dt).total_seconds() // 60)
                if age_min < 60:
                    ago = f" ({age_min} 分钟前结束)"
                else:
                    ago = f" ({age_min // 60} 小时前结束)"
            except Exception:
                pass
        title_emoji = "🏆" if win else "💔"
        title = f"{title_emoji} {acct_label} 刚打完{gt} · {'胜' if win else '败'}"
        body = (
            f"英雄: {event.get('champion', '?')}\n"
            f"KDA: {event.get('kda', '?')} "
            f"({event.get('kill', 0)}/{event.get('death', 0)}/{event.get('assist', 0)})\n"
            f"时长: {event.get('game_length_second', 0) and int(event['game_length_second']//60)} 分钟\n"
            f"位置: {event.get('position', '?')}\n"
            f"结束时间: {fmt_kst(event.get('created_at'))}{ago}"
        )
        return notify(title, body, cfg)
    if et == "rank_changed":
        return notify(f"🏆 {acct_label} 段位变化!",
                      f"{event['game_type']}: {event['old']} → {event['new']}", cfg)
    if et == "winning_streak":
        streak = event["streak"]
        return notify(
            f"🔥 {acct_label} {streak}连胜!",
            f"账号: {acct_label}\n"
            f"状态: 🔥 {streak}连胜中!\n"
            f"继续冲分!",
            cfg,
        )
    if et == "losing_streak":
        streak = event["streak"]
        return notify(
            f"💔 {acct_label} {streak}连败...",
            f"账号: {acct_label}\n"
            f"状态: {streak}连败中...\n"
            f"别送了休息一下吧!",
            cfg,
        )
    if et == "highlight":
        m = event["match"]
        highlights = []
        if event.get("is_mvp"):
            highlights.append("⭐ MVP!")
        if event.get("is_penta"):
            highlights.append("💥 五杀!")
        if event.get("is_quadra"):
            highlights.append("💥 四杀!")
        win = m.get("result") == "WIN"
        return notify(
            f"✨ {acct_label} 高光时刻! {' '.join(highlights)}",
            f"英雄: {m.get('champion', '?')}\n"
            f"KDA: {m.get('kda', '?')} ({m.get('kill',0)}/{m.get('death',0)}/{m.get('assist',0)})\n"
            f"战绩: {'胜' if win else '败'}\n"
            f"精彩操作!",
            cfg,
        )
    if et == "error":
        acct_info = f" ({event.get('account','')})" if event.get("account") else ""
        return notify("⚠️ OP.GG 监控错误",
                      f"{event.get('msg', '未知错误')}{acct_info}", cfg)
    return []


# ============================================================
# 主入口
# ============================================================
def run_all_accounts(client, cfg, accounts, verbose=False):
    """遍历所有账号进行检测, 返回合并的数据和事件列表"""
    all_events = []
    accounts_data = []

    for slug, game_name, tag_line, region, label in accounts:
        if verbose:
            print(f"\n--- 检测账号: {label} ({slug}) @ {region} ---")
        state = load_state(slug)
        try:
            events, new_state, profile, matches = check_account(
                client, game_name, tag_line, region, slug, label, state, verbose=verbose
            )
            save_state(slug, new_state)
            all_events.extend(events)

            accounts_data.append({
                "slug": slug,
                "label": label,
                "game_name": game_name,
                "tag_line": tag_line,
                "region": region,
                "profile": profile,
                "matches": matches,
                "state": {
                    "is_active": new_state.get("is_active", False),
                    "last_check": new_state.get("last_check"),
                    "last_match_id": new_state.get("last_match_id"),
                    "matches_count": new_state.get("matches_count", 0),
                },
            })

            # 第一个账号写入旧版单账号文件以兼容
            if slug == accounts[0][0]:
                if profile:
                    save_json(LEGACY_PROFILE_FILE, profile)
                if matches:
                    save_json(LEGACY_MATCHES_FILE, matches)
                save_json(LEGACY_STATE_FILE, new_state)

        except Exception as e:
            import traceback
            print(f"❌ [{slug}] 检测异常: {e}")
            if verbose:
                traceback.print_exc()
            all_events.append({
                "type": "error",
                "account": label,
                "slug": slug,
                "msg": str(e),
            })
            accounts_data.append({
                "slug": slug,
                "label": label,
                "game_name": game_name,
                "tag_line": tag_line,
                "region": region,
                "profile": None,
                "matches": [],
                "state": {"is_active": False, "error": str(e)},
            })

    # 写入合并数据文件供前端使用
    combined = {
        "accounts": accounts_data,
        "last_update": datetime.now(KST).isoformat(),
    }
    save_json(COMBINED_DATA_FILE, combined)
    return all_events, accounts_data


# ============================================================
# LPL 赛程提醒
# ============================================================
def check_lpl_matches(cfg, verbose=False):
    now_cst = datetime.now(CST)
    reminders = load_json(MATCH_REMINDER_STATE_FILE, {})
    notifications_sent = []

    for match in LPL_MATCHES:
        match_id = f"{match['date']}_{match['time']}_{match['team_a']}_vs_{match['team_b']}"
        match_dt = datetime.strptime(f"{match['date']} {match['time']}", "%Y-%m-%d %H:%M").replace(tzinfo=CST)
        minutes_until = (match_dt - now_cst).total_seconds() / 60

        if minutes_until < -120:
            continue

        key_pre = f"{match_id}_pre"
        key_start = f"{match_id}_start"
        ta, tb = match["team_a"], match["team_b"]
        opp = tb if ta == "IG" else ta
        ig_match = "IG" in (ta, tb)

        if not reminders.get(key_pre):
            if 15 <= minutes_until <= 45:
                title = f"🏟️ 即将开赛: {ta} vs {tb}"
                mins = int(minutes_until)
                body = (
                    f"赛事: {match['stage']}\n"
                    f"对阵: {ta} vs {tb}\n"
                    f"时间: 今天 {match['time']} CST (约{mins}分钟后)\n"
                )
                if ig_match:
                    body += "⚔️ TheShy 上场, 准备看比赛!"
                results = notify(title, body, cfg)
                for ch, ok in results:
                    if verbose:
                        print(f"  赛前提醒 {ch}: {'✅' if ok else '❌'}")
                reminders[key_pre] = now_cst.isoformat()
                notifications_sent.append(("pre", match))
            elif 0 <= minutes_until < 15:
                title = f"🏟️ 马上开赛: {ta} vs {tb}"
                mins = max(1, int(minutes_until))
                body = (
                    f"赛事: {match['stage']}\n"
                    f"对阵: {ta} vs {tb}\n"
                    f"时间: 今天 {match['time']} CST (约{mins}分钟后!)\n"
                )
                if ig_match:
                    body += "⚔️ TheShy 上场!"
                results = notify(title, body, cfg)
                for ch, ok in results:
                    if verbose:
                        print(f"  紧急赛前提醒 {ch}: {'✅' if ok else '❌'}")
                reminders[key_pre] = now_cst.isoformat()
                notifications_sent.append(("pre_urgent", match))

        if -15 <= minutes_until <= 10 and not reminders.get(key_start):
            title = f"🔴 正在比赛: {ta} vs {tb}"
            body = (
                f"赛事: {match['stage']}\n"
                f"对阵: {ta} vs {tb}\n"
                f"时间: {match['date']} {match['time']} CST\n"
            )
            if ig_match:
                body += "🎮 TheShy 加油!"
            results = notify(title, body, cfg)
            for ch, ok in results:
                if verbose:
                    print(f"  开赛提醒 {ch}: {'✅' if ok else '❌'}")
            reminders[key_start] = now_cst.isoformat()
            notifications_sent.append(("start", match))

    save_json(MATCH_REMINDER_STATE_FILE, reminders)
    return notifications_sent


# ============================================================
# B站直播间监控 (房间6 - LPL官方赛事直播)
# ============================================================
def check_bilibili_live(cfg, verbose=False):
    notifications_sent = []
    prev_state = load_json(BILIBILI_LIVE_STATE_FILE, {})

    try:
        resp = requests.get(BILIBILI_API, params={"room_id": BILIBILI_ROOM_ID},
                            headers=BILIBILI_HEADERS, timeout=10)
        data = resp.json()
        if data.get("code") != 0:
            if verbose:
                print(f"  B站API返回错误: {data.get('msg','')}")
            cur_state = dict(prev_state)
            cur_state["last_check"] = datetime.now(CST).isoformat()
            return notifications_sent, cur_state
    except Exception as e:
        if verbose:
            print(f"  B站API请求失败: {e}")
        cur_state = dict(prev_state)
        cur_state["last_check"] = datetime.now(CST).isoformat()
        return notifications_sent, cur_state

    d = data.get("data", {})
    live_status = d.get("live_status", 0)
    title = d.get("title", "")
    live_time = d.get("live_time", "")
    room_id = d.get("room_id", BILIBILI_ROOM_ID)

    now_cst = datetime.now(CST)
    cur_state = {
        "live_status": live_status,
        "title": title,
        "live_time": live_time,
        "room_id": room_id,
        "last_check": now_cst.isoformat(),
    }

    if verbose:
        status_map = {0: "未开播", 1: "🔴直播中", 2: "🔄轮播"}
        print(f"  B站房间{BILIBILI_ROOM_ID}: {status_map.get(live_status,'?')} | {title}")

    prev_live_status = prev_state.get("live_status", 0)
    prev_title = prev_state.get("title", "")
    prev_is_ig_live = prev_state.get("is_ig_live", False)
    ig_match_live_notified = prev_state.get("ig_match_live_notified", False)
    notified_live_time = prev_state.get("notified_live_time", "")
    notified_title = prev_state.get("notified_title", "")

    is_live = (live_status == 1)
    is_replay = (live_status == 2)

    def _has_team(text, team):
        idx = text.find(team)
        while idx != -1:
            before = text[idx - 1] if idx > 0 else " "
            after = text[idx + len(team)] if idx + len(team) < len(text) else " "
            if not (before.isalpha() or after.isalpha()):
                return True
            idx = text.find(team, idx + 1)
        return False

    is_ig_match = False
    has_preview_kw = any(kw in title for kw in ["预告", "回放", "重播", "录播", "精彩集锦", "预告：", "预热"])
    if is_live and not has_preview_kw:
        has_vs = (" vs " in title.lower() or "VS" in title or "对阵" in title)
        if has_vs and _has_team(title, "IG"):
            lpl_teams = [
                "WBG", "LNG", "NIP", "JDG", "BLG", "TES", "AL", "TT", "WE",
                "LGD", "EDG", "RNG", "FPX", "OMG", "V5", "RA", "UP",
            ]
            other_teams = [t for t in lpl_teams if _has_team(title, t)]
            if other_teams:
                is_ig_match = True

    # IG比赛开播通知
    if is_live and is_ig_match:
        should_notify = False
        if not ig_match_live_notified:
            should_notify = True
        elif notified_live_time != live_time and live_time and live_time != "0000-00-00 00:00:00":
            should_notify = True

        if should_notify:
            room_url = f"https://live.bilibili.com/{BILIBILI_ROOM_ID}"
            notif_title = f"📺 B站直播: IG比赛已开播!"
            notif_body = (
                f"房间: LPL官方赛事直播间 (房间号{BILIBILI_ROOM_ID})\n"
                f"标题: {title}\n"
                f"直播时间: {live_time}\n"
                f"链接: {room_url}\n"
                f"🎮 TheShy 比赛直播中, 快去看!"
            )
            results = notify(notif_title, notif_body, cfg)
            for ch, ok in results:
                if verbose:
                    print(f"  B站IG直播提醒 {ch}: {'✅' if ok else '❌'}")
            notifications_sent.append(("ig_live_start", title))
            cur_state["ig_match_live_notified"] = True
            cur_state["notified_live_time"] = live_time
            cur_state["notified_title"] = title
            cur_state["notified_at"] = now_cst.isoformat()
        else:
            cur_state["ig_match_live_notified"] = ig_match_live_notified
            cur_state["notified_live_time"] = notified_live_time
            cur_state["notified_title"] = notified_title
    # IG比赛直播结束通知（下播或切换到非IG比赛）
    elif prev_is_ig_live and ig_match_live_notified:
        room_url = f"https://live.bilibili.com/{BILIBILI_ROOM_ID}"
        notif_title = "📺 B站直播: IG比赛直播已结束"
        reason = "直播已下播" if not is_live else "已切换到其他比赛"
        notif_body = (
            f"房间: LPL官方赛事直播间 (房间号{BILIBILI_ROOM_ID})\n"
            f"上一场: {notified_title or '未知'}\n"
            f"状态: {reason}\n"
            f"当前标题: {title or '未开播'}"
        )
        results = notify(notif_title, notif_body, cfg)
        for ch, ok in results:
            if verbose:
                print(f"  B站IG直播结束提醒 {ch}: {'✅' if ok else '❌'}")
        notifications_sent.append(("ig_live_end", notified_title or title))
        cur_state["ig_match_live_notified"] = False
        if verbose:
            print(f"  IG比赛直播已结束: {reason}")
    elif not is_live and ig_match_live_notified:
        if prev_live_status == 1:
            if verbose:
                print("  直播已下播")
        cur_state["ig_match_live_notified"] = False
    else:
        cur_state["ig_match_live_notified"] = ig_match_live_notified
        cur_state["notified_live_time"] = notified_live_time
        cur_state["notified_title"] = notified_title

    cur_state["is_ig_live"] = is_live and is_ig_match
    save_json(BILIBILI_LIVE_STATE_FILE, cur_state)
    return notifications_sent, cur_state


# ============================================================
# 虎扑LPL比赛评分采集
# 策略: 监控虎扑LOL区首页的[赛后]帖, 筛选IG比赛
# 注: 虎扑选手评分是APP专属功能, 网页端链接到论坛帖即可
#     (手机端打开帖会自动跳转APP评分页, PC端帖内有评分入口)
# ============================================================
def check_hupu_ratings(cfg, verbose=False):
    """抓取虎扑LOL区最近的赛后帖, 返回IG相关比赛评分帖信息"""
    notifications_sent = []
    prev_state = load_json(HUPU_RATINGS_STATE_FILE, {"matches": [], "notified_ids": []})
    notified_ids = set(prev_state.get("notified_ids", []))
    cur_matches = []

    try:
        resp = requests.get(HUPU_LOL_URL, headers=HUPU_HEADERS, timeout=15)
        resp.encoding = "utf-8"
        html = resp.text
    except Exception as e:
        if verbose:
            print(f"  虎扑请求失败: {e}")
        return notifications_sent, prev_state

    import re as _re
    # 提取帖子列表 (多种模式兼容虎扑页面结构变化)
    posts = []
    for pat in [
        _re.compile(r'<a[^>]+href="(/\d{6,}\.html)"[^>]*class="p-title"[^>]*>([^<]*赛后[^<]*)</a>', _re.IGNORECASE),
        _re.compile(r'href="(/\d{6,}\.html)"[^>]*>([^<]*\[赛后\][^<]*)</a>', _re.IGNORECASE),
        _re.compile(r'<a[^>]+href="(/\d{6,}\.html)"[^>]*>([^<]*赛后[^<]*)</a>', _re.IGNORECASE),
    ]:
        posts = pat.findall(html)
        if posts:
            break

    now_cst = datetime.now(CST)
    hupu_cfg = cfg.get("hupu", {}) if isinstance(cfg.get("hupu"), dict) else {}
    team_name = hupu_cfg.get("team", HUPU_TEAM)

    def _has_team(text, team):
        """战队名边界匹配, 避免子串误识别 (如LIGHT里的IG)"""
        idx = text.find(team)
        while idx != -1:
            before = text[idx - 1] if idx > 0 else " "
            after = text[idx + len(team)] if idx + len(team) < len(text) else " "
            if not (before.isalpha() or before.isdigit() or after.isalpha() or after.isdigit()):
                return True
            idx = text.find(team, idx + 1)
        return False

    LPL_TEAMS = ["WBG", "LNG", "NIP", "JDG", "BLG", "TES", "AL", "TT", "WE",
                 "LGD", "EDG", "RNG", "FPX", "OMG", "RA", "UP", "IG"]

    for href, title in posts:
        title = title.strip()
        if not title:
            continue
        post_id = href.strip("/").replace(".html", "")
        post_url = f"https://bbs.hupu.com{href}"

        if not _has_team(title, team_name):
            continue

        # 解析比分和对手战队
        score_match = _re.search(r'(\d+)\s*[-:：]\s*(\d+)', title)
        team_a = team_b = score = ""
        if score_match:
            score = f"{score_match.group(1)}-{score_match.group(2)}"
            for t in LPL_TEAMS:
                if t != team_name and _has_team(title, t):
                    team_b = t
                    break
            team_a = team_name

        match_info = {
            "id": post_id,
            "title": title,
            "url": post_url,
            "score": score,
            "team_a": team_a,
            "team_b": team_b,
            "found_at": now_cst.isoformat(),
        }
        cur_matches.append(match_info)

        # 新帖通知
        if post_id not in notified_ids:
            notif_title = f"🏆 虎扑评分: {team_name}比赛已出评分"
            vs_str = f" {team_a} vs {team_b}" if team_b else ""
            notif_body = (
                f"{title}\n"
                f"比分: {score or '见详情'}{vs_str}\n"
                f"点击去虎扑看JR评分 → {post_url}"
            )
            results = notify(notif_title, notif_body, cfg)
            for ch, ok in results:
                if verbose:
                    print(f"  虎扑IG比赛评分提醒 {ch}: {'✅' if ok else '❌'}")
            notifications_sent.append(("hupu_rating", title))
            notified_ids.add(post_id)

    if verbose:
        ig_count = len(cur_matches)
        print(f"  虎扑评分: 发现{ig_count}个{team_name}赛后帖")

    # 保留最近20条, 通知ID保留最近100个
    prev_matches = prev_state.get("matches", [])
    existing_ids = {x["id"] for x in cur_matches}
    all_matches = cur_matches + [m for m in prev_matches if m["id"] not in existing_ids]
    all_matches = all_matches[:20]

    cur_state = {
        "matches": all_matches,
        "notified_ids": list(notified_ids)[-100:],
        "team": team_name,
        "last_check": now_cst.isoformat(),
    }
    save_json(HUPU_RATINGS_STATE_FILE, cur_state)
    return notifications_sent, cur_state


def is_quiet_hours(cfg):
    """检查当前是否在勿扰时段"""
    qs = cfg.get("QUIET_START", "").strip()
    qe = cfg.get("QUIET_END", "").strip()
    if not qs or not qe:
        return False
    try:
        now = datetime.now().time()
        sh, sm = map(int, qs.split(":"))
        eh, em = map(int, qe.split(":"))
        start = datetime.strptime(qs, "%H:%M").time()
        end = datetime.strptime(qe, "%H:%M").time()
        if start < end:
            return start <= now <= end
        else:
            return now >= start or now <= end
    except Exception:
        return False


def compute_daily_stats(accounts_data):
    """计算今日战绩统计"""
    stats = {}
    for acc in accounts_data:
        slug = acc["slug"]
        label = acc["label"]
        matches = acc.get("matches") or []
        today_cst = datetime.now(CST).strftime("%Y-%m-%d")
        today_matches = []
        win = lose = 0
        total_lp_delta = 0
        streak = 0
        streak_type = None
        cur_streak = 0
        cur_type = None
        for m in matches:
            created = m.get("created_at", "")
            if not created:
                continue
            try:
                dt = datetime.fromisoformat(created)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=KST)
                m_date = dt.astimezone(CST).strftime("%Y-%m-%d")
            except Exception:
                continue
            if m_date != today_cst:
                break
            today_matches.append(m)
            if m.get("result") == "WIN":
                win += 1
            elif m.get("result") == "LOSE":
                lose += 1
            if cur_type is None:
                cur_type = m.get("result")
                cur_streak = 1
            elif m.get("result") == cur_type:
                cur_streak += 1
            else:
                if cur_streak > streak:
                    streak = cur_streak
                    streak_type = cur_type
                cur_type = m.get("result")
                cur_streak = 1
        if cur_streak > streak:
            streak = cur_streak
            streak_type = cur_type
        stats[slug] = {
            "label": label,
            "today_matches": len(today_matches),
            "win": win,
            "lose": lose,
            "win_rate": f"{win/(win+lose)*100:.0f}%" if (win+lose) > 0 else "0%",
            "streak": streak,
            "streak_type": streak_type,
        }
    return stats


def detect_streak_events(accounts_data, prev_states, cfg):
    """检测连胜/连败、高光时刻事件"""
    events = []
    for acc in accounts_data:
        slug = acc["slug"]
        label = acc["label"]
        matches = acc.get("matches") or []
        if not matches:
            continue
        # 从最近的比赛往前找连胜/连败
        results = []
        for m in matches[:10]:
            r = m.get("result")
            if r in ("WIN", "LOSE"):
                results.append(r)
        if not results:
            continue
        # 计算当前连胜/连败
        streak = 1
        streak_type = results[0]
        for r in results[1:]:
            if r == streak_type:
                streak += 1
            else:
                break
        prev_streak = prev_states.get(slug, {}).get("streak", 0)
        prev_type = prev_states.get(slug, {}).get("streak_type")
        # 连胜/连败达到3场及以上通知
        if streak >= 3 and (streak > prev_streak or streak_type != prev_type):
            if streak == 3 or streak % 2 == 0 or streak >= 5:
                etype = "winning_streak" if streak_type == "WIN" else "losing_streak"
                emoji = "🔥" if streak_type == "WIN" else "💔"
                events.append({
                    "type": etype,
                    "account": label,
                    "slug": slug,
                    "streak": streak,
                    "matches": matches[:streak],
                })
        # 高光时刻检测
        latest = matches[0]
        multi_kill = latest.get("largest_multi_kill", 0)
        op_rank = latest.get("op_score_rank")
        is_mvp = (op_rank == 1)
        is_penta = (multi_kill == 5)
        is_quadra = (multi_kill == 4)
        prev_highlight = prev_states.get(slug, {}).get("last_highlight_match")
        if latest.get("id") != prev_highlight:
            if is_penta or is_quadra or is_mvp:
                events.append({
                    "type": "highlight",
                    "account": label,
                    "slug": slug,
                    "match": latest,
                    "is_mvp": is_mvp,
                    "is_penta": is_penta,
                    "is_quadra": is_quadra,
                })
    return events


def main():
    parser = argparse.ArgumentParser(description="TheShy 排位监控 (OP.GG 完整数据, 多账号)")
    parser.add_argument("--once", action="store_true", help="只检测一次")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL)
    parser.add_argument("--test-notify", action="store_true", help="测试通知")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    load_dotenv()
    cfg = {
        "BARK_KEY": os.getenv("BARK_KEY") or "",
        "SERVERCHAN_KEY": os.getenv("SERVERCHAN_KEY") or "",
        "DISCORD_WEBHOOK": os.getenv("DISCORD_WEBHOOK") or "",
        "THESHY_RIOT_ID": os.getenv("THESHY_RIOT_ID") or "The shy#asdf",
        "THESHY_REGION": os.getenv("THESHY_REGION") or "KR",
        "THESHY_ACCOUNTS": os.getenv("THESHY_ACCOUNTS") or "",
        "QUIET_START": os.getenv("QUIET_START", "") or "",
        "QUIET_END": os.getenv("QUIET_END", "") or "",
    }

    # 支持 config.json 配置文件 (优先级高于.env)
    config_file = BASE_DIR / "config.json"
    file_accounts = None
    file_matches = None
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                file_cfg = json.load(f)
            # 通知渠道
            if file_cfg.get("notifications"):
                ncfg = file_cfg["notifications"]
                if ncfg.get("quiet_hours"):
                    cfg["QUIET_START"] = ncfg["quiet_hours"].get("start", "") or ""
                    cfg["QUIET_END"] = ncfg["quiet_hours"].get("end", "") or ""
            # 账号配置
            if file_cfg.get("accounts"):
                acc_parts = []
                for a in file_cfg["accounts"]:
                    slug = a.get("slug", "main")
                    gn = a.get("game_name", "The shy")
                    tl = a.get("tag_line", "asdf")
                    reg = a.get("region", "KR")
                    lbl = a.get("label", f"{gn}#{tl}")
                    acc_parts.append(f"{slug}:{gn}:{tl}:{reg}:{lbl}")
                file_accounts = acc_parts
                cfg["THESHY_ACCOUNTS"] = ",".join(acc_parts)
            # LPL赛程
            if file_cfg.get("lpl") and file_cfg["lpl"].get("matches"):
                file_matches = file_cfg["lpl"]["matches"]
            if args.verbose:
                print(f"  已加载 config.json 配置")
        except Exception as e:
            print(f"⚠️  config.json 加载失败: {e}")

    # 如果 config.json 指定了赛程，覆盖硬编码
    if file_matches is not None:
        import sys as _sys
        _this_module = _sys.modules[__name__]
        _this_module.LPL_MATCHES = file_matches

    accounts = _parse_accounts_config(cfg) or DEFAULT_ACCOUNTS

    if not (cfg["BARK_KEY"] or cfg["SERVERCHAN_KEY"] or cfg["DISCORD_WEBHOOK"]):
        print("⚠️  未配置推送渠道, 状态文件仍会写入供前端展示\n")

    if cfg["QUIET_START"] and cfg["QUIET_END"]:
        print(f"   🤫 勿扰时段: {cfg['QUIET_START']} - {cfg['QUIET_END']}")

    if args.test_notify:
        print("📤 测试通知...")
        results = notify("🧪 TheShy 监控测试", "如果你收到这条消息, 说明通知配置正确!", cfg)
        for ch, ok in results:
            print(f"  {ch}: {'✅ 成功' if ok else '❌ 失败'}")
        return

    client = OpggClient(verbose=args.verbose)
    streak_state_file = BASE_DIR / ".theshy_streak_state.json"

    print(f"🚀 TheShy 监控启动 (OP.GG 数据源, 多账号模式)")
    for slug, gn, tl, reg, lbl in accounts:
        print(f"   - {lbl} ({slug}) @ {reg}")
    print(f"   📺 B站LPL官方直播间: 房间{BILIBILI_ROOM_ID} (IG比赛开播通知)")
    print(f"   推送: {[k for k in ['BARK_KEY','SERVERCHAN_KEY','DISCORD_WEBHOOK'] if cfg.get(k)]}\n")

    while True:
        try:
            now = kst_now().strftime("%H:%M:%S")
            print(f"[{now}] 检测所有账号...")
            all_events, accounts_data = run_all_accounts(
                client, cfg, accounts, verbose=args.verbose)

            # 检测连胜/连败和高光事件
            prev_streak_state = load_json(streak_state_file, {})
            streak_events = detect_streak_events(accounts_data, prev_streak_state, cfg)
            for ev in streak_events:
                all_events.append(ev)

            for ev in all_events:
                if args.verbose:
                    print(f"  📨 事件: {ev}")
                append_event(ev)
                results = handle_event(ev, cfg)
                for ch, ok in results:
                    print(f"    {ch}: {'✅' if ok else '❌'}")

            # 更新连胜状态
            new_streak_state = {}
            for acc in accounts_data:
                slug = acc["slug"]
                matches = acc.get("matches") or []
                results = []
                for m in matches[:10]:
                    r = m.get("result")
                    if r in ("WIN", "LOSE"):
                        results.append(r)
                if results:
                    streak = 1
                    st = results[0]
                    for r in results[1:]:
                        if r == st:
                            streak += 1
                        else:
                            break
                    new_streak_state[slug] = {
                        "streak": streak,
                        "streak_type": st,
                        "last_highlight_match": matches[0].get("id") if matches else None,
                    }
            save_json(streak_state_file, new_streak_state)

            if not all_events:
                active_slugs = [a["slug"] for a in accounts_data if a["state"].get("is_active")]
                print(f"  无变化 (活跃账号: {active_slugs if active_slugs else '无'})")

            match_notifs = check_lpl_matches(cfg, verbose=args.verbose)
            for kind, m in match_notifs:
                print(f"  🏆 LPL提醒已发送: {kind} - {m['team_a']} vs {m['team_b']}")
                append_event({
                    "type": "lpl_match",
                    "kind": kind,
                    "team_a": m["team_a"],
                    "team_b": m["team_b"],
                    "stage": m["stage"],
                    "match_time": f"{m['date']} {m['time']} CST",
                })

            bili_notifs, bili_state = check_bilibili_live(cfg, verbose=args.verbose)
            for kind, room_title in bili_notifs:
                print(f"  📺 B站直播提醒已发送: {kind} - {room_title}")
                append_event({
                    "type": "bilibili_live",
                    "kind": kind,
                    "title": room_title,
                    "room_id": BILIBILI_ROOM_ID,
                })

            # 虎扑LPL比赛评分
            hupu_notifs, hupu_state = check_hupu_ratings(cfg, verbose=args.verbose)
            for kind, post_title in hupu_notifs:
                print(f"  🏆 虎扑评分提醒已发送: {post_title}")
                append_event({
                    "type": "hupu_rating",
                    "kind": kind,
                    "title": post_title,
                })

            # 更新合并数据文件，添加B站状态、虎扑评分和今日统计
            daily_stats = compute_daily_stats(accounts_data)
            combined = load_json(COMBINED_DATA_FILE, {})
            combined["bilibili"] = {
                "is_live": bili_state.get("live_status") == 1,
                "is_ig_live": bili_state.get("is_ig_live", False),
                "title": bili_state.get("title", ""),
                "live_time": bili_state.get("live_time", ""),
                "room_id": bili_state.get("room_id", BILIBILI_ROOM_ID),
                "last_check": bili_state.get("last_check", ""),
                "notified_title": bili_state.get("notified_title", ""),
            }
            combined["hupu_ratings"] = {
                "team": hupu_state.get("team", HUPU_TEAM),
                "matches": hupu_state.get("matches", []),
                "last_check": hupu_state.get("last_check", ""),
            }
            combined["daily_stats"] = daily_stats
            combined["quiet_hours"] = {
                "enabled": bool(cfg.get("QUIET_START") and cfg.get("QUIET_END")),
                "is_quiet": is_quiet_hours(cfg),
                "start": cfg.get("QUIET_START", ""),
                "end": cfg.get("QUIET_END", ""),
            }
            save_json(COMBINED_DATA_FILE, combined)

            if args.once:
                return
            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n👋 退出")
            return
        except Exception as e:
            import traceback
            print(f"❌ 全局异常: {e}")
            if args.verbose:
                traceback.print_exc()
            if args.once:
                return
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
