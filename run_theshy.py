#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TheShy 排位监控 (基于 lol_monitor)
==================================
封装 misiektoja/lol_monitor (https://github.com/misiektoja/lol_monitor)，
把它的邮件通知拦截后改推到 Bark / Server酱，无需修改 lol_monitor 源码。

工作原理：
  1. import lol_monitor 模块
  2. monkey-patch lol_monitor.send_email —— 拦截 subject/body 转推到 Bark/Server酱
  3. 注入 CLI 参数 (riot_id, region, riot_api_key, -s 开启状态切换通知)
  4. 调用 lol_monitor.main()

所需环境变量 (写在同目录 .env 中或直接 export)：
  RIOT_API_KEY    —— 必须，https://developer.riotgames.com/ 申请
  RIOT_ID         —— 必须，gameName#tagLine (默认 TheShy#KR1，如改名请改)
  REGION          —— 可选，默认 kr
  BARK_KEY        —— 可选，Bark App 内推送 URL 末尾的字符串
  SERVERCHAN_KEY  —— 可选，sct.ftqq.com 申请，SCT 开头
  BARK_HOST       —— 可选，默认 https://api.day.app
  POLL_INTERVAL   —— 可选，不在游戏中检查间隔秒数 (默认 300)
  ACTIVE_INTERVAL —— 可选，在游戏中检查间隔秒数 (默认 60)

至少配置 BARK_KEY 或 SERVERCHAN_KEY 之一，否则不会推送。
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

import requests

# 必须在 import lol_monitor 之前先准备 monkey-patch
import lol_monitor as _lm


# =============================================================================
# Bark / Server酱 推送
# =============================================================================

BARK_KEY        = os.getenv("BARK_KEY", "")
BARK_HOST       = os.getenv("BARK_HOST", "https://api.day.app").rstrip("/")
SERVERCHAN_KEY  = os.getenv("SERVERCHAN_KEY", "")

THESHY_ICON = "https://cdn.jsdelivr.net/gh/RIOTAPI/riot-static@latest/img/profileicon/588.png"


def _push_bark(title: str, body: str) -> None:
    if not BARK_KEY:
        return
    url = f"{BARK_HOST}/{BARK_KEY.strip('/')}"
    try:
        r = requests.post(
            url,
            json={
                "title": title,
                "body": body,
                "group": "theshy",
                "sound": "bell",
                "icon": THESHY_ICON,
            },
            timeout=10,
        )
        if r.ok:
            print(f"[Bark] ✓ 推送成功: {title}")
        else:
            print(f"[Bark] ✗ 推送失败: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"[Bark] ✗ 推送异常: {e}")


def _push_serverchan(title: str, body: str) -> None:
    if not SERVERCHAN_KEY:
        return
    url = f"https://sctapi.ftqq.com/{SERVERCHAN_KEY}.send"
    try:
        r = requests.post(url, data={"title": title, "desp": body}, timeout=10)
        if r.ok and r.json().get("code", 0) == 0:
            print(f"[Server酱] ✓ 推送成功: {title}")
        else:
            print(f"[Server酱] ✗ 推送失败: {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"[Server酱] ✗ 推送异常: {e}")


# =============================================================================
# monkey-patch lol_monitor.send_email
# =============================================================================

# 把 HTML body 转成纯文本（lol_monitor 用 MIMEMultipart 'alternative' 同时传 plain + html）
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t]+")


def _html_to_text(html: str) -> str:
    if not html:
        return ""
    # <br>, </p>, </div>, </tr> → 换行
    html = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", html)
    # <tr>, <li>, <p>, <div> → 换行 (开始标签)
    html = re.sub(r"(?i)<tr[^>]*>|<li[^>]*>|<p[^>]*>|<div[^>]*>", "", html)
    # 去剩余标签
    text = _TAG_RE.sub("", html)
    # HTML 实体
    text = (text.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", '"')
                .replace("&#39;", "'")
                .replace("&nbsp;", " "))
    # 折叠多余空行
    lines = [_WS_RE.sub(" ", ln).strip() for ln in text.splitlines()]
    out, blank = [], False
    for ln in lines:
        if not ln:
            if not blank:
                out.append("")
                blank = True
        else:
            out.append(ln)
            blank = False
    return "\n".join(out).strip()


def _patched_send_email(subject: str, body: str, body_html: str, use_ssl, smtp_timeout: int = 15):
    """替换 lol_monitor.send_email —— 把消息推到 Bark/Server酱。

    签名与原函数完全一致，返回 0 表示成功 (lol_monitor 用返回值判断是否报告错误)。
    """
    if not BARK_KEY and not SERVERCHAN_KEY:
        print("[notify] ⚠ 未配置 BARK_KEY / SERVERCHAN_KEY，跳过推送")
        return 0  # 返回 0 避免触发 lol_monitor 的错误处理逻辑

    text = body or _html_to_text(body_html)
    if not subject:
        subject = "TheShy 监控通知"
    if not text:
        text = "(无正文)"

    # 同时推送到所有配置的渠道
    _push_bark(subject, text)
    _push_serverchan(subject, text)
    return 0


_lm.send_email = _patched_send_email


# =============================================================================
# 注入 CLI 参数并启动 lol_monitor
# =============================================================================

def _build_argv() -> list:
    riot_id   = os.getenv("RIOT_ID", "TheShy#KR1")
    region    = os.getenv("REGION", "kr")
    api_key   = os.getenv("RIOT_API_KEY", "")
    poll      = os.getenv("POLL_INTERVAL", "300")
    active    = os.getenv("ACTIVE_INTERVAL", "60")

    if not api_key or api_key == "your_riot_api_key":
        print("✗ 缺少 RIOT_API_KEY，请在 .env 中配置 (https://developer.riotgames.com/)")
        sys.exit(1)

    argv = [
        "lol_monitor",
        riot_id, region,
        "-r", api_key,
        "-s",                          # 开启状态变化通知 (开始/结束比赛)
        "-c", str(poll),               # 不在游戏中检查间隔
        "-k", str(active),             # 在游戏中检查间隔
    ]
    return argv


def main() -> int:
    print("=" * 70)
    print("  TheShy 排位监控  (基于 misiektoja/lol_monitor v%s)" % _lm.VERSION)
    print("=" * 70)
    riot_id = os.getenv("RIOT_ID", "TheShy#KR1")
    region  = os.getenv("REGION", "kr")
    print(f"  监控对象:  {riot_id}  ({region})")
    print(f"  通知渠道:  " + (
        " / ".join(filter(None, [BARK_KEY and "Bark", SERVERCHAN_KEY and "Server酱"]))
        or "(未配置，将只打印到控制台)"
    ))
    print(f"  检查间隔:  排位外 {os.getenv('POLL_INTERVAL', '300')}s / 排位中 {os.getenv('ACTIVE_INTERVAL', '60')}s")
    print("=" * 70)
    print()

    # 让 lol_monitor 不要去找 .env (我们已加载)，避免它的 dotenv 路径搜索干扰
    sys.argv = _build_argv()
    _lm.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
