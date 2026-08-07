#!/usr/bin/env python3
"""
TheShy Monitor build script
- Builds the React frontend (web/) -> 根目录（旧前端）
- Builds the V2 React frontend (frontend-v2/) -> v2/ 子路径（新前端，独立部署）
- Inlines minimal initial data for instant first paint (两版各自注入)
- Copies build output to root / v2 for GitHub Pages
- Outputs full data as data.json and events.json for client-side refresh
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
WEB_DIR = ROOT / 'web'
DIST_DIR = ROOT / 'dist'

# V2 前端（独立、不影响旧 web/ 前端，部署在 /v2/ 子路径）
V2_DIR = ROOT / 'frontend-v2'
V2_OUT = ROOT / 'v2'

HUPU_MATCH_ESSENTIAL_FIELDS = {
    'id', 'title', 'url', 'score', 'home', 'away',
    'home_score', 'away_score', 'ig_win', 'opponent',
    'ig_score', 'opp_score', 'league_name', 'round_name',
    'match_time', 'date_str', 'found_at'
}

# next_match / latest_match 渲染所需字段（Hupu.tsx 使用 home/away/home_logo/away_logo/
# date_str/time_str/stage/status_desc，以及 title/score/home_score/away_score/ig_win）
HUPU_SCHEDULE_ESSENTIAL_FIELDS = {
    'id', 'title', 'url', 'score', 'home', 'away',
    'home_logo', 'away_logo', 'home_score', 'away_score',
    'ig_win', 'date_str', 'time_str', 'stage', 'status_desc',
}

MAX_EVENT_SIZE = 5 * 1024
MAX_INLINE_EVENTS = 50
MATCHES_LIMIT = 3


def trim_hupu_match(match):
    if not match:
        return None
    return {k: v for k, v in match.items() if k in HUPU_MATCH_ESSENTIAL_FIELDS}


def trim_hupu_schedule(match):
    """精简下一场/最近一场比赛（保留 Hupu.tsx 渲染所需字段）"""
    if not match:
        return None
    return {k: v for k, v in match.items() if k in HUPU_SCHEDULE_ESSENTIAL_FIELDS}


def trim_hupu_ratings(hupu, matches_limit=MATCHES_LIMIT):
    if not hupu:
        return None
    result = {}
    for k, v in hupu.items():
        if k == 'matches':
            result['matches'] = [trim_hupu_match(m) for m in (v or [])[:matches_limit]]
        elif k in ['team', 'last_check']:
            result[k] = v
        elif k in ['next_match', 'latest_match']:
            result[k] = trim_hupu_schedule(v)
    return result


def trim_match(match):
    """精简单场对局数据，仅保留前端真正消费的字段。
    前端消费点：computeStats 用 game_length_second；WinRateChart 用 created_at + result。
    删除 items / runes / spells / op_score* / average_tier_info 等大体积且从不使用的字段。"""
    if not match:
        return None
    essential = {
        'id', 'game_type', 'created_at', 'game_length_second', 'result',
    }
    return {k: v for k, v in match.items() if k in essential}


def trim_event(event):
    """精简事件数据，保留渲染需要的字段"""
    if not event:
        return None
    essential = {
        'type', 'account', 'slug', 'timestamp',
        # new_match
        'match_id', 'game_type', 'champion', 'result', 'kda',
        'kill', 'death', 'assist', 'created_at', 'game_length_second', 'position',
        # lp_changed
        'old_lp', 'new_lp', 'delta', 'tier', 'division',
        # opgg_updated
        'updated_at', 'level', 'is_active',
        # became_active
        # level_changed
        'old', 'new',
        # streaks
        'streak',
        # rank_changed
        'old', 'new',
        # live
        'title', 'duration', 'kind',
    }
    return {k: v for k, v in event.items() if k in essential}


def trim_account(acc, matches_limit=5):
    """精简账号数据，只保留渲染需要的字段。
    matches_limit: 保留最近 N 场（内联首屏用 5；v2 轮询传 None 保留全量但已精简字段）。"""
    if not acc:
        return None
    result = {}
    essential_acc_fields = {'slug', 'label', 'game_name', 'tag_line', 'region', 'state'}
    for k in essential_acc_fields:
        if k in acc:
            result[k] = acc[k]

    # 精简profile
    profile = acc.get('profile')
    if profile:
        essential_profile_fields = {
            'id', 'game_name', 'tagline', 'name', 'internal_name',
            'profile_image_url', 'level', 'ladder_rank', 'league_stats'
        }
        trimmed_profile = {k: v for k, v in profile.items() if k in essential_profile_fields}
        # 精简league_stats里的high_leagues
        if 'league_stats' in trimmed_profile:
            trimmed_ls = []
            for ls in trimmed_profile['league_stats']:
                trimmed_ls.append({k: v for k, v in ls.items() if k != 'high_leagues'})
            trimmed_profile['league_stats'] = trimmed_ls
        result['profile'] = trimmed_profile

    # 精简matches（保留最近 matches_limit 场核心字段；None = 全量）
    if 'matches' in acc and acc['matches']:
        limit = len(acc['matches']) if matches_limit is None else matches_limit
        result['matches'] = [trim_match(m) for m in acc['matches'][:limit]]

    return result


def build_react_app():
    """Build the React frontend"""
    print("🔨 Building React frontend...")
    result = subprocess.run(
        ['npm', 'run', 'build'],
        cwd=str(WEB_DIR),
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ Build failed:\n{result.stderr}")
        sys.exit(1)
    print("✅ React build complete")


def load_data():
    """Load and trim data"""
    print("\n📦 Loading data...")

    data_path = ROOT / '.theshy_data.json'
    events_path = ROOT / '.theshy_events.json'

    with open(data_path, 'r', encoding='utf-8') as f:
        full_data = json.load(f)
    with open(events_path, 'r', encoding='utf-8') as f:
        full_events = json.load(f)

    # Build full data (for data.json)
    data_json = full_data
    events_json = full_events

    # Build inline trimmed data
    inline_data = {}

    # Trim accounts
    inline_data['accounts'] = [trim_account(acc) for acc in full_data.get('accounts', [])]

    # Keep all other top-level fields
    for k, v in full_data.items():
        if k == 'accounts':
            continue
        if k == 'hupu_ratings':
            inline_data[k] = trim_hupu_ratings(v)
        elif k == 'bilibili':
            inline_data[k] = v
        elif k in ['daily_stats', 'last_update', 'quiet_hours', 'refresh_interval']:
            inline_data[k] = v
        else:
            inline_data[k] = v

    # Trim events for inline
    trimmed_events = []
    for e in (full_events or []):
        if len(trimmed_events) >= MAX_INLINE_EVENTS:
            break
        trimmed = trim_event(e)
        if trimmed:
            trimmed_events.append(trimmed)
        if len(trimmed_events) >= MAX_INLINE_EVENTS:
            break

    inline_payload = {
        'data': inline_data,
        'events': trimmed_events,
        'lastUpdate': __import__('datetime').datetime.now().isoformat(),
    }

    print(f"  ✓ {len(inline_data.get('accounts', []))} accounts")
    bilibili_data = inline_data.get('bilibili', {})
    print(f"  ✓ Bilibili: {'live' if bilibili_data.get('is_live') else 'offline'}")
    hupu = inline_data.get('hupu_ratings')
    print(f"  ✓ Hupu ratings: {len(hupu.get('matches', [])) if hupu else 0} matches")
    print(f"  ✓ Events: {len(trimmed_events)} (inline) / {len(full_events)} (full)")

    return data_json, events_json, inline_payload


def inject_and_copy(data_json, events_json, inline_payload):
    """Inject inline data, copy assets to root"""
    print("\n📄 Generating output...")

    # Read built index.html
    index_path = DIST_DIR / 'index.html'
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Inject inline data
    inline_json = json.dumps(inline_payload, ensure_ascii=False, separators=(',', ':'))
    inline_size_kb = len(inline_json.encode('utf-8')) / 1024
    inline_script = f'<script>window.__INITIAL_DATA__={inline_json}</script>'

    html = html.replace('<!-- __INITIAL_DATA__ -->', inline_script)

    # Write data.json and events.json to dist
    with open(DIST_DIR / 'data.json', 'w', encoding='utf-8') as f:
        json.dump(data_json, f, ensure_ascii=False, separators=(',', ':'))
    with open(DIST_DIR / 'events.json', 'w', encoding='utf-8') as f:
        json.dump(events_json, f, ensure_ascii=False, separators=(',', ':'))

    # Write final index.html
    with open(DIST_DIR / 'index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    # Copy dist contents to root
    print("\n📋 Copying to root directory...")

    # Remove old assets from root
    assets_dir = ROOT / 'assets'
    if assets_dir.exists():
        shutil.rmtree(assets_dir)

    # Copy new files
    for item in DIST_DIR.iterdir():
        dest = ROOT / item.name
        if item.is_dir():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    html_size = len(html.encode('utf-8')) / 1024
    total_size = sum(
        f.stat().st_size for f in ROOT.rglob('*') if f.is_file() and f.suffix in ('.html', '.js', '.css', '.json')
    ) / 1024

    print(f"\n✅ Build complete!")
    print(f"   Inline data: {inline_size_kb:.1f} KB")
    print(f"   index.html: {html_size:.1f} KB")
    print(f"   Total static assets: ~{total_size:.1f} KB")
    print(f"\n   🚀 First paint: instant (inline data)")
    print(f"   📡 Background refresh: every 30s from data.json")


def build_v2_react():
    """Build the V2 React frontend (frontend-v2) into v2/"""
    print("\n🔨 Building V2 frontend (frontend-v2)...")
    result = subprocess.run(
        ['npm', 'run', 'build'],
        cwd=str(V2_DIR),
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"❌ V2 build failed:\n{result.stderr}")
        sys.exit(1)
    print("✅ V2 build complete")


def build_v2_data(full_data):
    """v2 轮询专用 data.json：仅保留前端真正消费的字段。
    - accounts: trim_account（matches 保留全量但已精简字段，供 WinRateChart 累计胜率走势）
    - bilibili: 完整（Hero 仅用 is_live / live_time / title）
    - hupu_ratings: trim_hupu_ratings（team / matches / latest_match）
    - last_update: Footer / Hero 展示
    丢弃前端从不消费的历史字段：daily_stats / quiet_hours / refresh_interval。
    注意：仅作用于 v2 路径，旧前端 web/ 仍使用全量 data_json（见 main）。"""
    out = {}
    out['accounts'] = [trim_account(acc, matches_limit=None) for acc in full_data.get('accounts', [])]
    out['bilibili'] = full_data.get('bilibili')
    out['hupu_ratings'] = trim_hupu_ratings(full_data.get('hupu_ratings'))
    out['last_update'] = full_data.get('last_update')
    return out


def build_v2_events(full_events):
    """v2 轮询专用 events.json：复用 trim_event（与内联一致），保留全部事件（热力图需近 6 个月）。"""
    return [trim_event(e) for e in (full_events or []) if trim_event(e)]


def build_v2(data_json, events_json, inline_payload):
    """Build & deploy V2 output into v2/ (independent of old root frontend)"""
    print("\n📦 Building V2 output (v2/)...")

    # 1) 构建前端（frontend-v2 -> v2/，见 vite.config.ts outDir）
    build_v2_react()

    # 2) 写入权威全量数据（供客户端 30s 轮询 ./data.json / ./events.json）
    with open(V2_OUT / 'data.json', 'w', encoding='utf-8') as f:
        json.dump(data_json, f, ensure_ascii=False, separators=(',', ':'))
    with open(V2_OUT / 'events.json', 'w', encoding='utf-8') as f:
        json.dump(events_json, f, ensure_ascii=False, separators=(',', ':'))

    # 3) 注入 trim 后的首屏数据到 v2/index.html 占位符
    index_path = V2_OUT / 'index.html'
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    inline_json = json.dumps(inline_payload, ensure_ascii=False, separators=(',', ':'))
    inline_script = f'<script>window.__INITIAL_DATA__={inline_json}</script>'
    if '<!-- __INITIAL_DATA__ -->' not in html:
        raise RuntimeError('v2/index.html missing <!-- __INITIAL_DATA__ --> placeholder')
    html = html.replace('<!-- __INITIAL_DATA__ -->', inline_script)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)

    inline_size_kb = len(inline_json.encode('utf-8')) / 1024
    print(f"  ✓ V2 inline data: {inline_size_kb:.1f} KB")
    print(f"  ✓ V2 output at v2/ (旧前端在根目录 /，互不影响)")


def main():
    print("=" * 50)
    print("TheShy Monitor - Building Dashboard")
    print("=" * 50)

    build_react_app()
    data_json, events_json, inline_payload = load_data()
    # 旧前端 web/ 使用全量数据（不影响）
    inject_and_copy(data_json, events_json, inline_payload)

    # V2 独立构建（/v2/ 子路径）：仅对 v2 路径使用精简后的轮询数据
    v2_data = build_v2_data(data_json)
    v2_events = build_v2_events(events_json)
    build_v2(v2_data, v2_events, inline_payload)


if __name__ == '__main__':
    main()
