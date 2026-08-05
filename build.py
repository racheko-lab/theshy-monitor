#!/usr/bin/env python3
"""
构建脚本：内联精简首屏数据到 index.html 中，实现真正的秒开
- 保留所有账号完整信息（profile/state）
- 每个账号保留最近20场对局，去掉 participants/teams 等大字段（首屏不需要）
- 保留最近20条事件
- 总内联数据约80-100KB，加上HTML总共约200KB，国内秒开
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
    'items', 'items_names', 'spells', 'rune',
    'largest_multi_kill', 'average_tier_info',
    '_account_slug', '_account_label'
}

def trim_match(match):
    """精简单场对局数据，只保留首屏需要的字段"""
    return {k: v for k, v in match.items() if k in ESSENTIAL_MATCH_FIELDS}

def trim_account(account, matches_limit=20):
    """精简账号数据，保留完整profile/state，对局只保留最近N场且精简字段"""
    result = {}
    for k, v in account.items():
        if k == 'matches':
            result['matches'] = [trim_match(m) for m in (v or [])[:matches_limit]]
        else:
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
        print(f"  ✓ 读取 .theshy_data.json ({len(data.get('accounts', []))} 个账号)")
    
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
    
    # 精简数据：首屏只需要最近20场对局+最近20条事件
    inline_data = {'data': None, 'events': []}
    
    if data.get('accounts'):
        trimmed_accounts = [trim_account(a) for a in data['accounts']]
        inline_data['data'] = {'accounts': trimmed_accounts}
    
    # 只保留最近20条事件
    inline_data['events'] = (events or [])[:20]
    
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
    print(f"   → 首屏打开即可看到完整内容，无需等待网络请求！")

if __name__ == '__main__':
    build()
