#!/usr/bin/env python3
"""
构建脚本：将最新数据内联到 index.html 中，实现首屏秒开
在 GitHub Pages 部署前运行
"""
import json
import os

def build():
    print("🔨 开始构建，内联数据到HTML...")
    
    # 读取数据文件
    data = {}
    events = []
    
    # 优先读取合并后的多账号数据文件
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
    
    # 读取HTML模板
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # 构建内联数据脚本
    inline_data = json.dumps({
        'data': data,
        'events': events
    }, ensure_ascii=False, separators=(',', ':'))  # 压缩JSON减少体积
    
    inline_script = f'<script>window.__INITIAL_DATA__={inline_data};</script>'
    
    # 替换占位符
    marker = '<!-- __INLINE_DATA__ -->'
    if marker in html:
        html = html.replace(marker, inline_script)
        print(f"  ✓ 内联数据注入成功，数据大小: {len(inline_script) / 1024:.1f} KB")
    else:
        print("  ⚠ 未找到 __INLINE_DATA__ 标记，添加到body末尾")
        html = html.replace('</body>', f'{inline_script}\n</body>')
    
    # 写入构建后的HTML（覆盖原文件，用于部署）
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("✅ 构建完成！")

if __name__ == '__main__':
    build()
