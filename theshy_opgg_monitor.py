#!/usr/bin/env python3
"""
TheShy 排位监控 - 基于 OP.GG MCP API

数据源: https://mcp-api.op.gg/mcp (官方 MCP, 无需 API Key, 无需认证)
推送: Bark / Server酱 / Discord Webhook (任选)
监控逻辑:
  1. 每 N 分钟拉一次 OP.GG 的 summoner profile
  2. 跟踪 updated_at / league_stats / most_champions 字段变化
  3. 检测到玩家最近活跃 (updated_at 在过去 5 分钟内更新) -> 推送通知
  4. 同时拉最近一场 match_history, 检测新比赛 -> 推送结果通知
"""

import os
import sys
import json
import time
import re
import argparse
import threading
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

# 韩国时区 (OP.GG 时间戳带 +09:00, 我们也用 KST 显示)
KST = timezone(timedelta(hours=9))

# 状态文件 (持久化上次查询结果)
STATE_FILE = Path(__file__).parent / ".theshy_opgg_state.json"
# 事件历史文件 (前端读取, 保留最近 50 条)
EVENTS_FILE = Path(__file__).parent / ".theshy_events.json"
MAX_EVENTS = 50

# 默认轮询间隔 (秒)
DEFAULT_INTERVAL = 180  # 3 分钟


# ============================================================
# OP.GG MCP 调用层
# ============================================================
class OpggClient:
    """OP.GG MCP API 客户端 (JSON-RPC over HTTP)"""

    def __init__(self, verbose=False):
        self.verbose = verbose
        self._rpc_id = 100

    def _call(self, tool_name, arguments):
        """调用一个 MCP tool, 返回 text 内容"""
        self._rpc_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self._rpc_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }
        for attempt in range(3):
            try:
                r = requests.post(
                    OPGG_MCP_URL,
                    headers=OPGG_HEADERS,
                    json=payload,
                    timeout=20,
                )
                r.raise_for_status()
                data = r.json()
                if "error" in data:
                    return {"error": data["error"]}
                # result.content[0].text 是 OP.GG 自定义的 Python-style repr
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
        """拉召唤师 profile, 关注 updated_at / league_stats / level"""
        fields = [
            "data.summoner.{game_name,tagline,name,puuid,summoner_id,level,"
            "updated_at,renewable_at,revision_at}",
            "data.summoner.league_stats[].{game_type,win,lose,updated_at}",
            "data.summoner.league_stats[].tier_info.{tier,division,lp}",
            "data.summoner.recent_champion_stats[].{champion_name,play,win,kill,death,assist}",
            "data.summoner.ladder_rank.{rank,total}",
        ]
        return self._call("lol_get_summoner_profile", {
            "game_name": game_name,
            "tag_line": tag_line,
            "region": region,
            "lang": "zh_CN",
            "desired_output_fields": fields,
        })

    def list_matches(self, game_name, tag_line, region="KR", limit=5):
        """拉最近 N 场比赛"""
        fields = [
            "data.game_history[].{id,created_at,game_type,game_length_second,game_map}",
            "data.game_history[].participants[0].{champion_name,team_key}",
            "data.game_history[].participants[0].stats.{kill,death,assist,result}",
        ]
        return self._call("lol_list_summoner_matches", {
            "game_name": game_name,
            "tag_line": tag_line,
            "region": region,
            "lang": "zh_CN",
            "limit": limit,
            "desired_output_fields": fields,
        })


# ============================================================
# OP.GG 返回的 Python-repr 解析器
# OP.GG 返回格式: Summoner("val1","val2",123,"val4",...)
# 按 schema 顺序映射到字段名
# ============================================================
SUMMONER_FIELDS = [
    "game_name", "tagline", "name", "puuid", "summoner_id",
    "level", "updated_at", "renewable_at", "revision_at",
]


def _split_args(s):
    """把 Python-style 参数列表切成 token (处理字符串/数字/None)"""
    tokens = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c in " \t,":
            i += 1
            continue
        if c == '"':
            # 字符串
            j = i + 1
            buf = []
            while j < n:
                if s[j] == '\\' and j + 1 < n:
                    buf.append(s[j + 1])
                    j += 2
                    continue
                if s[j] == '"':
                    break
                buf.append(s[j])
                j += 1
            tokens.append(("str", "".join(buf)))
            i = j + 1
        elif s[i:i + 4] == "None":
            tokens.append(("none", None))
            i += 4
        elif s[i:i + 4] == "True":
            tokens.append(("bool", True))
            i += 4
        elif s[i:i + 5] == "False":
            tokens.append(("bool", False))
            i += 5
        elif c == "-" or c.isdigit():
            j = i + 1
            while j < n and (s[j].isdigit() or s[j] == "."):
                j += 1
            num_str = s[i:j]
            try:
                num = int(num_str)
            except ValueError:
                num = float(num_str)
            tokens.append(("num", num))
            i = j
        elif c == "[":
            # 数组, 跳到匹配 ]
            depth = 1
            j = i + 1
            while j < n and depth > 0:
                if s[j] == "[":
                    depth += 1
                elif s[j] == "]":
                    depth -= 1
                j += 1
            tokens.append(("array", s[i:j]))
            i = j
        else:
            # 跳过未知 token
            j = i
            while j < n and s[j] != ",":
                j += 1
            i = j
    return tokens


def parse_summoner(text):
    """从 Summoner(arg1, arg2, ...) 提取字段"""
    if not text:
        return {}
    m = re.search(r'Summoner\((.*?)(?:,\s*\[.*?\])?\)\s*\)?\s*$', text, re.DOTALL)
    if not m:
        # 退化: 找 Summoner( 后到第一个 ),
        m = re.search(r'Summoner\(([^)]+)\)', text)
        if not m:
            return {}
    args_str = m.group(1)
    tokens = _split_args(args_str)
    out = {}
    for idx, (_, val) in enumerate(tokens[:len(SUMMONER_FIELDS)]):
        out[SUMMONER_FIELDS[idx]] = val
    return out


def parse_first_match(text):
    """从 game_history 提取第一场比赛的关键字段"""
    if not text or "game_history" not in text:
        return None
    # 找第一个 GameHistory(...) 块
    m = re.search(r'GameHistory\(([^)]+)\)', text)
    if not m:
        return None
    args_str = m.group(1)
    tokens = _split_args(args_str)
    # GameHistory 字段顺序: id, created_at, game_type, game_length_second, game_map, ...
    fields = ["id", "created_at", "game_type", "game_length_second", "game_map"]
    out = {}
    for idx, (_, val) in enumerate(tokens[:len(fields)]):
        out[fields[idx]] = val
    # 单独提 champion_name / result / kda
    cm = re.search(r'champion_name="([^"]+)"', text)
    if cm:
        out["champion"] = cm.group(1)
    rm = re.search(r'result="?(WIN|LOSE)"?', text, re.IGNORECASE)
    if rm:
        out["result"] = rm.group(1).upper()
    km = re.search(r'kill=(\d+),\s*death=(\d+),\s*assist=(\d+)', text)
    if km:
        out["kda"] = f"{km.group(1)}/{km.group(2)}/{km.group(3)}"
    return out


def parse_all_match_ids(text):
    """从 game_history 文本提取所有 match id (长字符串)"""
    if not text:
        return []
    # match id 通常是 30+ 字符的 base64-like 字符串
    ids = re.findall(r'"([A-Za-z0-9_-]{20,})"', text)
    # 过滤: 不能纯数字, 长度 > 20
    return [i for i in ids if len(i) >= 20 and not i.isdigit()]


def parse_game_type(text):
    """提取第一场比赛的 game_type"""
    m = re.search(r'"(SOLORANKED|FLEXRANKED|NORMAL|ARAM|CHERRY|TOURNAMENT)"', text)
    return m.group(1) if m else None


# ============================================================
# 通知层
# ============================================================
def html_to_text(html):
    """简单 HTML 转纯文本"""
    if not html:
        return ""
    import re as _re
    text = _re.sub(r'<br\s*/?>', '\n', html, flags=_re.IGNORECASE)
    text = _re.sub(r'</p>', '\n', text, flags=_re.IGNORECASE)
    text = _re.sub(r'<[^>]+>', '', text)
    text = _re.sub(r'&nbsp;', ' ', text)
    text = _re.sub(r'&amp;', '&', text)
    text = _re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def send_bark(bark_key, title, body):
    if not bark_key:
        return False
    # Bark key 可以是完整 URL (https://api.day.app/<key>) 或纯 key
    if bark_key.startswith("http"):
        base = bark_key.rstrip("/")
    else:
        base = f"https://api.day.app/{bark_key}"
    # 用 POST 形式, title/body 走 form
    try:
        r = requests.post(
            base, json={"title": title, "body": body, "group": "theshy"}, timeout=10
        )
        return r.status_code == 200
    except requests.RequestException:
        return False


def send_serverchan(key, title, body):
    if not key:
        return False
    try:
        r = requests.post(
            f"https://sctapi.ftqq.com/{key}.send",
            data={"title": title, "desp": body},
            timeout=10,
        )
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
    """同时推送到所有已配置的渠道"""
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
def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def append_event(event):
    """把事件追加到 events 文件 (前端读), 保留最近 MAX_EVENTS 条"""
    events = []
    if EVENTS_FILE.exists():
        try:
            events = json.loads(EVENTS_FILE.read_text())
            if not isinstance(events, list):
                events = []
        except Exception:
            events = []
    # 加 timestamp
    event = {**event, "timestamp": datetime.now(KST).isoformat()}
    events.insert(0, event)
    events = events[:MAX_EVENTS]
    EVENTS_FILE.write_text(json.dumps(events, ensure_ascii=False, indent=2))


# ============================================================
# 主监控循环
# ============================================================
def kst_now():
    return datetime.now(KST)


def fmt_kst(iso_str):
    """转 KST 显示字符串"""
    if not iso_str:
        return "?"
    try:
        # 处理 +09:00 后缀
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=KST)
        return dt.astimezone(KST).strftime("%m-%d %H:%M")
    except Exception:
        return iso_str[:16]


def check_theshy(client, cfg, state, verbose=False):
    """单次检测, 返回 (事件列表, 新状态)"""
    events = []
    riot_id = cfg.get("THESHY_RIOT_ID", "TheShy#KR1").split("#")
    game_name = riot_id[0]
    tag_line = riot_id[1] if len(riot_id) > 1 else "KR1"
    region = cfg.get("THESHY_REGION", "KR")

    # 1. 拉 profile
    resp = client.get_summoner_profile(game_name, tag_line, region)
    if "error" in resp:
        return [{"type": "error", "msg": str(resp["error"])}], state
    text = resp.get("text", "")
    if verbose:
        print(f"  [profile raw] {text[:300]}")

    parsed = parse_summoner(text)
    updated_at = parsed.get("updated_at")
    renewable_at = parsed.get("renewable_at")
    level = parsed.get("level")
    puuid = parsed.get("puuid")
    name = parsed.get("name")

    if verbose:
        print(f"  parsed: name={name} level={level} updated_at={updated_at}")

    # 2. 判断玩家活跃度
    # OP.GG updated_at 是后端最后刷新时间
    # 当玩家在游戏中, OP.GG 会高频更新 (每 1-2 分钟)
    # 当玩家离线, updated_at 几乎不动
    now = kst_now()
    is_active_recently = False
    if updated_at:
        try:
            upd_dt = datetime.fromisoformat(updated_at)
            if upd_dt.tzinfo is None:
                upd_dt = upd_dt.replace(tzinfo=KST)
            age_sec = (now - upd_dt.astimezone(KST)).total_seconds()
            if verbose:
                print(f"  updated_at age={age_sec:.0f}s")
            # 5 分钟内 OP.GG 后端刷新过 -> 玩家可能在线
            if 0 <= age_sec < 300:
                is_active_recently = True
        except Exception as e:
            if verbose:
                print(f"  parse updated_at failed: {e}")

    # 3. 比较上次状态
    last_state = state.get("profile", {})
    last_updated = last_state.get("updated_at")
    last_active = state.get("is_active", False)

    if last_updated and updated_at and last_updated != updated_at:
        events.append({
            "type": "opgg_updated",
            "updated_at": updated_at,
            "level": level,
            "is_active": is_active_recently,
        })

    # 状态切换: 不活跃 → 活跃 (OP.GG 在刷新, 说明玩家上线了)
    if is_active_recently and not last_active:
        events.append({
            "type": "became_active",
            "updated_at": updated_at,
            "level": level,
        })

    if last_state.get("level") != level and level:
        events.append({
            "type": "level_changed",
            "old": last_state.get("level"),
            "new": level,
        })

    # 4. 拉最近一场比赛
    matches_resp = client.list_matches(game_name, tag_line, region, limit=5)
    matches_text = matches_resp.get("text", "")
    if verbose:
        print(f"  [matches raw] {matches_text[:300]}")

    last_match_id = state.get("last_match_id")
    new_match = None
    if matches_text and "game_history" in matches_text and "[]" not in matches_text[:50]:
        new_match = parse_first_match(matches_text)
        if new_match:
            mid = new_match.get("id")
            if mid and mid != last_match_id:
                events.append({
                    "type": "new_match",
                    "match_id": mid,
                    "game_type": new_match.get("game_type", "?"),
                    "champion": new_match.get("champion", "?"),
                    "result": new_match.get("result", "?"),
                    "kda": new_match.get("kda", "?"),
                    "created_at": new_match.get("created_at"),
                })

    # 5. 更新 state
    state["profile"] = {
        "updated_at": updated_at,
        "level": level,
        "puuid": puuid,
        "name": name,
    }
    state["is_active"] = is_active_recently
    if new_match and new_match.get("id"):
        state["last_match_id"] = new_match["id"]
    if updated_at:
        state["last_check"] = datetime.now(KST).isoformat()

    return events, state


def handle_event(event, cfg):
    """把事件转成通知"""
    if event["type"] == "opgg_updated":
        if event.get("is_active"):
            title = "🔥 TheShy 似乎上线了"
            body = (f"OP.GG 数据 {fmt_kst(event['updated_at'])} 被刷新\n"
                    f"等级: {event.get('level', '?')}\n"
                    f"可能正在游戏中, 注意观察")
        else:
            title = "📡 TheShy 数据更新"
            body = f"OP.GG 更新时间: {fmt_kst(event['updated_at'])}"
        return notify(title, body, cfg)

    if event["type"] == "became_active":
        title = "🔥 TheShy 可能开始排位了!"
        body = (f"OP.GG 在最近 5 分钟内更新了 TheShy 的数据\n"
                f"更新时间: {fmt_kst(event.get('updated_at'))}\n"
                f"等级: {event.get('level', '?')}\n"
                f"\n通常意味着他刚登录或开始打排位")
        return notify(title, body, cfg)

    if event["type"] == "level_changed":
        title = "📈 TheShy 升级"
        body = f"等级: {event['old']} → {event['new']}"
        return notify(title, body, cfg)

    if event["type"] == "new_match":
        type_map = {
            "SOLORANKED": "单双排",
            "FLEXRANKED": "灵活组排",
            "NORMAL": "匹配",
            "ARAM": "大乱斗",
        }
        gt = type_map.get(event["game_type"], event["game_type"])
        title = f"🎮 TheShy 刚打完 {gt}"
        body = (f"英雄: {event['champion']}\n"
                f"结果: {event['result']}\n"
                f"KDA: {event['kda']}\n"
                f"时间: {kst_now().strftime('%m-%d %H:%M KST')}")
        return notify(title, body, cfg)

    if event["type"] == "error":
        return notify("⚠️ OP.GG 监控错误", event.get("msg", "未知错误"), cfg)

    return []


# ============================================================
# 主入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="TheShy 排位监控 (OP.GG 数据源)")
    parser.add_argument("--once", action="store_true", help="只检测一次")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"轮询间隔秒数 (默认 {DEFAULT_INTERVAL})")
    parser.add_argument("--test-notify", action="store_true", help="测试通知")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细日志")
    args = parser.parse_args()

    load_dotenv()
    # 优先级: 已有环境变量 > .env 文件
    # (GitHub Actions 直接把 secrets 注入环境变量, 不会读 .env)
    cfg = {
        "BARK_KEY": os.getenv("BARK_KEY", ""),
        "SERVERCHAN_KEY": os.getenv("SERVERCHAN_KEY", ""),
        "DISCORD_WEBHOOK": os.getenv("DISCORD_WEBHOOK", ""),
        "THESHY_RIOT_ID": os.getenv("THESHY_RIOT_ID", "TheShy#KR1"),
        "THESHY_REGION": os.getenv("THESHY_REGION", "KR"),
    }

    if not (cfg["BARK_KEY"] or cfg["SERVERCHAN_KEY"] or cfg["DISCORD_WEBHOOK"]):
        # 没配推送渠道, 只警告不退出 (监控 state 仍写入供前端展示)
        print("⚠️  未配置任何推送渠道 (BARK_KEY / SERVERCHAN_KEY / DISCORD_WEBHOOK)")
        print("   状态文件仍会写入, 前端可正常显示\n")

    if args.test_notify:
        print("📤 测试通知...")
        results = notify("🧪 TheShy 监控测试", "如果你收到这条消息, 说明通知配置正确!", cfg)
        for ch, ok in results:
            print(f"  {ch}: {'✅ 成功' if ok else '❌ 失败'}")
        return

    client = OpggClient(verbose=args.verbose)
    state = load_state()

    print(f"🚀 TheShy 监控启动 (OP.GG 数据源)")
    print(f"   目标: {cfg['THESHY_RIOT_ID']} @ {cfg['THESHY_REGION']}")
    print(f"   间隔: {args.interval}s")
    print(f"   推送: {[k for k in ['BARK_KEY','SERVERCHAN_KEY','DISCORD_WEBHOOK'] if cfg.get(k)]}")
    print(f"   Ctrl+C 退出\n")

    while True:
        try:
            now = kst_now().strftime("%H:%M:%S")
            print(f"[{now}] 检测中...")
            events, state = check_theshy(client, cfg, state, verbose=args.verbose)
            save_state(state)

            for ev in events:
                if args.verbose:
                    print(f"  📨 事件: {ev}")
                # 追加到 events 文件 (前端读取)
                append_event(ev)
                results = handle_event(ev, cfg)
                for ch, ok in results:
                    print(f"    {ch}: {'✅' if ok else '❌'}")

            if not events:
                print(f"  无变化 (updated_at={state.get('profile',{}).get('updated_at','?')})")

            if args.once:
                return

            time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\n👋 退出")
            return
        except Exception as e:
            print(f"❌ 异常: {e}")
            if args.once:
                return
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
