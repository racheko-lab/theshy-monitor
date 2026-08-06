#!/usr/bin/env python3
"""
TheShy Monitor build script
- Builds the React frontend (web/)
- Inlines minimal initial data for instant first paint
- Copies build output to root for GitHub Pages
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

HUPU_MATCH_ESSENTIAL_FIELDS = {
    'id', 'title', 'url', 'score', 'home', 'away',
    'home_score', 'away_score', 'ig_win', 'opponent',
    'ig_score', 'opp_score', 'league_name', 'round_name',
    'match_time', 'date_str', 'found_at'
}

MAX_EVENT_SIZE = 5 * 1024
MAX_INLINE_EVENTS = 50
MATCHES_LIMIT = 3


def trim_hupu_match(match):
    if not match:
        return None
    return {k: v for k, v in match.items() if k in HUPU_MATCH_ESSENTIAL_FIELDS}


def trim_hupu_ratings(hupu, matches_limit=MATCHES_LIMIT):
    if not hupu:
        return None
    result = {}
    for k, v in hupu.items():
        if k == 'matches':
            result['matches'] = [trim_hupu_match(m) for m in (v or [])[:matches_limit]]
        elif k in ['team', 'last_check']:
            result[k] = v
    return result


def trim_match(match):
    """精简单场对局数据，去掉大字段"""
    if not match:
        return None
    essential = {
        'id', 'game_type', 'created_at', 'game_length_second',
        'is_win', 'champion_name', 'champion_image_url',
        'kill', 'death', 'assist', 'kda_string',
        'op_score', 'op_score_rank', 'position',
        'is_remake', 'average_tier_info', 'items', 'spells', 'runes'
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
        'from_tier', 'to_tier', 'lp_diff',
        # live
        'title', 'duration',
    }
    return {k: v for k, v in event.items() if k in essential}


def trim_account(acc):
    """精简账号数据，只保留渲染需要的字段"""
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
    
    # 精简matches（只保留最近5场核心字段）
    if 'matches' in acc and acc['matches']:
        result['matches'] = [trim_match(m) for m in acc['matches'][:5]]
    
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


def main():
    print("=" * 50)
    print("TheShy Monitor - Building Dashboard")
    print("=" * 50)

    build_react_app()
    data_json, events_json, inline_payload = load_data()
    inject_and_copy(data_json, events_json, inline_payload)


if __name__ == '__main__':
    main()
