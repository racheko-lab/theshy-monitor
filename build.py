#!/usr/bin/env python3
"""
构建脚本：保持 index.html 轻量，不内联大体积数据
在 GitHub Pages 部署前运行
"""
import os

def build():
    print("🔨 开始构建（轻量模式，不内联大体积数据）...")
    
    # 读取HTML模板
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # 确保占位符被移除，不注入任何数据
    marker = '<!-- __INLINE_DATA__ -->'
    if marker in html:
        html = html.replace(marker, '')
        print("  ✓ 已清理数据占位符")
    
    # 写入构建后的HTML（保持轻量，用于部署）
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✅ 构建完成！HTML大小: {os.path.getsize('index.html') / 1024:.1f} KB")

if __name__ == '__main__':
    build()
