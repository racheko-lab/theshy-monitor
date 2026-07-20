# TheShy 排位监控

> 基于 OP.GG MCP API 的 TheShy 排位状态监控, GitHub Actions 自动部署。
> 监控账号: `The shy#asdf` (韩服, 퐁당가지토마토, summoner_id=42752430)

🌐 **前端面板**: https://racheko-lab.github.io/theshy-monitor/
📋 **运行历史**: https://github.com/racheko-lab/theshy-monitor/actions
📊 **状态 JSON**: https://raw.githubusercontent.com/racheko-lab/theshy-monitor/main/.theshy_opgg_state.json
📜 **事件 JSON**: https://raw.githubusercontent.com/racheko-lab/theshy-monitor/main/.theshy_events.json

---

## ⚠️ 主播模式说明

Riot 在 **Patch 25.20 (2025-10)** 推出了 Streamer Mode (主播模式), TheShy 已开启。

### 对本项目的影响

| 项目 | 状态 |
|---|---|
| **段位 / LP / 等级** | ✅ 正常获取 |
| **历史赛季 / 历史段位** | ✅ 正常获取 |
| **最近 20 场比赛** | ✅ 正常获取 (比赛结束后 5-15 分钟刷新) |
| **最常玩英雄 / KDA / 胜率** | ✅ 正常获取 |
| **LP 变化检测** | ✅ 可作为「刚打完排位」的实时信号 |
| **「正在游戏中」实时状态** | ❌ Riot API 屏蔽, OP.GG 也拿不到 |

主播模式只屏蔽「游戏进行中」的实时状态,
**打完比赛后所有数据都能正常抓取**。

### 推送时机

- 主播模式无法做到「比赛开始时」实时推送 (Riot API 完全屏蔽)
- 比赛结束 5-15 分钟后, OP.GG 会刷新数据并触发:
  - **new_match** 事件: 检测到新比赛 → 推送胜负 / KDA / 英雄
  - **lp_changed** 事件: LP 变化 → 推送 ±LP
  - **rank_changed** 事件: 段位升降

参考:
- [How to Use Streamer Mode in League of Legends](https://blog.loltheory.gg/lol-streamer-mode/)
- [Anonymizing Your Riot ID - Riot Support](https://support.riotgames.com/en-us/league-of-legends/gameplay/anonymizing-your-riot-id)
- [In-game info not showing while playing - OP.GG Help](https://help.op.gg/hc/en-us/articles/55948777310873-In-game-info-not-showing-while-playing)

---

## 工作原理

1. GitHub Actions 每 5 分钟调用一次 OP.GG 官方 MCP API (`https://mcp-api.op.gg/mcp`)
2. 拉取 TheShy 的完整召唤师资料 (profile + league_stats + most_champions + matches)
3. 检测以下事件:
   - **new_match**: 检测到新比赛 (主要通知)
   - **lp_changed**: LP 变化
   - **rank_changed**: 段位升降
   - **level_changed**: 等级提升
4. 推送通知到 Bark / Server酱 / Discord (任选)
5. 自动 commit 状态文件回 main 分支
6. 前端网页读取 JSON 文件展示实时状态

## 优势

- **零成本**: GitHub Actions 公开仓库无限免费, OP.GG MCP 完全免费
- **零维护**: 不用服务器, 不用 API key, 不用每天续期
- **完全开源**: 代码 + 状态 + 事件历史全部可见
- **完整数据**: 前端展示段位 / 赛季历史 / 最近比赛 / 最常玩英雄 / KDA / 多杀 / MVP / 视野等

## 本地运行

```bash
pip install -r requirements_opgg.txt
export BARK_KEY=your_bark_key   # 可选
python3 theshy_opgg_monitor.py --once --verbose

# 测试通知
python3 theshy_opgg_monitor.py --test-notify

# 常驻监控 (本地)
python3 theshy_opgg_monitor.py
```

## 文件说明

| 文件 | 用途 |
|---|---|
| `theshy_opgg_monitor.py` | 主监控脚本 (含 OP.GG repr 解析器) |
| `index.html` | 前端面板 (单文件, 无依赖) |
| `requirements_opgg.txt` | Python 依赖 |
| `.env_opgg.example` | 配置模板 |
| `.theshy_opgg_state.json` | 状态持久化 (脚本自动写) |
| `.theshy_events.json` | 事件历史 (前端读取) |
| `.theshy_profile.json` | 完整召唤师 profile (前端读取) |
| `.theshy_matches.json` | 最近 20 场比赛 (前端读取) |
| `.github/workflows/theshy-monitor.yml` | 监控 workflow |
| `.github/workflows/deploy-pages.yml` | 前端部署 workflow |

## 实际响应时间

主播模式下, 从 TheShy 一场比赛结束到你收到通知:
- OP.GG 后端刷新延迟: 1-3 分钟
- GitHub Actions cron 触发延迟: 5-15 分钟
- **总延迟: 6-18 分钟**

即 TheShy 打完比赛后, 你大约在 6-18 分钟内收到 Bark 推送。

## License

MIT
