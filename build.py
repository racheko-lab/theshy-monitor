#!/usr/bin/env python3
"""
构建脚本：内联精简首屏数据到 index.html 中，实现真正的秒开
- 保留所有顶层数据字段：bilibili直播状态、hupu评分、daily_stats等
- 保留所有账号完整信息（profile/state）
- 每个账号保留最近20场对局，去掉 participants/teams 等大字段（首屏不需要）
- 虎扑评分只保留最近3场，并精简掉球员详细数据（头像/热评等）
- 保留所有事件（约几十KB）
- 总内联数据约200-250KB，加上HTML总共约300多KB，国内秒开
"""
import json
import os

# 首屏对局必需字段（去掉 participants, teams, 以及其他非必需字段）
ESSENTIAL_MATCH_FIELDS = {
    'id', 'created_at', 'game_type', 'game_length_second', 'game_map',
    'champion_id', 'champion', 'champion_level', 'position',
    'kill', 'death', 'assist', 'kda', 'result',
    'op_score', 'op_score_rank',
    'gold_earned', 'minion_kill', 'neutral_minion_kill',
    'total_damage_dealt_to_champions', 'total_damage_taken',
    'vision_wards_bought_in_game', 'ward_place',
    'largest_killing_spree', 'largest_multi_kill',
    'champion_level',
    'items', 'items_names', 'spells', 'rune',
    'average_tier_info',
    '_account_slug', '_account_label'
}

# 虎扑比赛精简字段（首屏只需要比赛基本信息和比分，不需要球员详细数据）
HUPU_MATCH_ESSENTIAL_FIELDS = {
    'id', 'title', 'url', 'score', 'home', 'away',
    'home_score', 'away_score', 'ig_win', 'opponent',
    'ig_score', 'opp_score', 'league_name', 'round_name',
    'match_time', 'date_str', 'found_at'
}

def trim_match(match):
    """精简单场对局数据，只保留首屏需要的字段"""
    return {k: v for k, v in match.items() if k in ESSENTIAL_MATCH_FIELDS}

def trim_hupu_match(match):
    """精简虎扑比赛数据，去掉球员详细信息（头像、热评等大字段）"""
    result = {}
    for k, v in match.items():
        if k in HUPU_MATCH_ESSENTIAL_FIELDS:
            result[k] = v
    return result

def trim_account(account, matches_limit=20):
    """精简账号数据，保留完整profile/state，对局只保留最近N场且精简字段"""
    result = {}
    for k, v in account.items():
        if k == 'matches':
            result['matches'] = [trim_match(m) for m in (v or [])[:matches_limit]]
        else:
            result[k] = v
    return result

def trim_hupu_ratings(hupu, matches_limit=3):
    """精简虎扑评分数据"""
    if not hupu:
        return None
    result = {}
    for k, v in hupu.items():
        if k == 'matches':
            result['matches'] = [trim_hupu_match(m) for m in (v or [])[:matches_limit]]
        elif k in ['team', 'last_check']:
            result[k] = v
    return result

def build():
    print("🔨 开始构建，内联精简首屏数据...")
    
    # 读取数据文件
    data = {}
    events = []
    
    if os.path.exists('.theshy_data.json'):
        with open('.theshy_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"  ✓ 读取 .theshy_data.json")
        if data.get('accounts'):
            print(f"    - {len(data['accounts'])} 个账号")
        if data.get('bilibili'):
            print(f"    - 包含B站直播状态")
        if data.get('hupu_ratings', {}).get('matches'):
            print(f"    - 包含虎扑评分: {len(data['hupu_ratings']['matches'])}场比赛")
    
    if os.path.exists('.theshy_events.json'):
        with open('.theshy_events.json', 'r', encoding='utf-8') as f:
            events = json.load(f)
        print(f"  ✓ 读取 .theshy_events.json ({len(events)} 条事件)")
    
    # 如果没有合并数据，回退到旧版单账号格式
    if not data.get('accounts'):
        print("  ⚠ 未找到多账号数据，尝试旧版单账号格式...")
        legacy = {}
        for fname, key in [
            ('.theshy_opgg_state.json', 'state'),
            ('.theshy_profile.json', 'profile'),
            ('.theshy_matches.json', 'matches'),
        ]:
            if os.path.exists(fname):
                with open(fname, 'r', encoding='utf-8') as f:
                    legacy[key] = json.load(f)
        if legacy:
            data = {'accounts': [{'slug': 'main', 'label': 'TheShy', **legacy}]}
    
    # 精简数据
    inline_data = {'data': None, 'events': []}
    
    if data:
        trimmed = {}
        # 保留所有顶层字段
        for k, v in data.items():
            if k == 'accounts':
                trimmed['accounts'] = [trim_account(a) for a in v]
            elif k == 'hupu_ratings':
                trimmed['hupu_ratings'] = trim_hupu_ratings(v)
            else:
                # 保留其他顶层字段（bilibili, daily_stats, last_update, quiet_hours等）
                trimmed[k] = v
        inline_data['data'] = trimmed
    
    # 保留最近事件，但过滤掉过大的事件（如连败事件包含大量对局数据）
    MAX_EVENT_SIZE = 5 * 1024  # 单条事件最大5KB
    MAX_EVENTS = 50
    trimmed_events = []
    for e in (events or []):
        if len(trimmed_events) >= MAX_EVENTS:
            break
        e_size = len(json.dumps(e, ensure_ascii=False, separators=(',',':')))
        if e_size <= MAX_EVENT_SIZE:
            trimmed_events.append(e)
    inline_data['events'] = trimmed_events
    
    # 计算内联数据大小
    inline_json = json.dumps(inline_data, ensure_ascii=False, separators=(',', ':'))
    inline_size_kb = len(inline_json.encode('utf-8')) / 1024
    print(f"  ✓ 精简数据大小: {inline_size_kb:.1f} KB")
    
    # 读取HTML模板
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # 构建内联脚本
    inline_script = f'<script>window.__INITIAL_DATA__={inline_json};</script>'
    
    # 注入到HTML
    marker = '<!-- __INLINE_DATA__ -->'
    if marker in html:
        html = html.replace(marker, inline_script)
    else:
        # 如果没有标记，添加到body开头（确保首屏能立即用）
        html = html.replace('<body>', f'<body>\n{inline_script}')
    
    # 写入构建后的HTML
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    html_size_kb = os.path.getsize('index.html') / 1024
    print(f"✅ 构建完成！HTML总大小: {html_size_kb:.1f} KB")
    print(f"   → 首屏打开即可看到完整内容（直播状态、虎扑评分、赛事），无需等待！")

if __name__ == '__main__':
    build()
