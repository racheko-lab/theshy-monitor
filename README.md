# TheShy 排位监控

> 基于 OP.GG MCP API 的 TheShy 排位状态监控, GitHub Actions 自动部署。
> TheShy 已开启 Riot Streamer Mode (2025-10 Patch 25.20+), 本项目已调整为「赛后感知模式」。

🌐 **前端面板**: https://racheko-lab.github.io/theshy-monitor/
📋 **运行历史**: https://github.com/racheko-lab/theshy-monitor/actions
📊 **状态 JSON**: https://raw.githubusercontent.com/racheko-lab/theshy-monitor/main/.theshy_opgg_state.json
📜 **事件 JSON**: https://raw.githubusercontent.com/racheko-lab/theshy-monitor/main/.theshy_events.json

---

## ⚠️ 重要限制说明: 主播模式

Riot 在 **Patch 25.20 (2025-10)** 推出了 Streamer Mode (主播模式),
玩家可在客户端设置中开启三个开关:
- Hide Other Player's Names (隐藏其他人名字)
- Hide My Name (隐藏我的名字)
- **Hide My Identifying Info** (最严: 隐藏名字+等级+称号+头像+段位边框)

TheShy 已开启主播模式。

### 对本项目的具体影响

| 项目 | 之前 | 现在 (主播模式) |
|---|---|---|
| 比赛开始时实时推送 | ✅ OP.GG 检测到 updated_at 刷新 | ❌ **不可能** (Riot API 完全屏蔽) |
| 比赛结束后通知 | ✅ 延迟 5-15 分钟 | ✅ 延迟 5-15 分钟 (不变) |
| 召唤师 profile / 段位 / 等级 | ✅ 实时 | ✅ 实时 (非游戏时段) |
| Match history | ✅ 实时 | ✅ 比赛结束后立即可查 |
| 最常玩英雄 / KDA / 胜率 | ✅ | ✅ (不受影响) |
| LP 变化感知 | ✅ 段位变化时 | ✅ **现在作为主要实时信号** |

### 本项目已做的调整

1. **检测间隔从 10 分钟缩短到 5 分钟**, 更快捕捉「刚结束」的比赛
2. **`became_active` / `opgg_updated` 事件不再推送通知** (主播模式下基本不触发, 即使触发也与游戏无关)
3. **新增 `lp_changed` 事件**: LP 变化一定意味着刚打完排位, 是主播模式下最有价值的实时信号
4. **`new_match` 通知文案增强**: 加上「(X 分钟前结束)」让用户判断是否还来得及看
5. **前端加主播模式 pill + banner 说明**, 明确告知限制

### 一个残酷的事实

**主播模式让「第一时间知道主播开始排位」从根本上变得不可能**,
不论用什么第三方工具 (OP.GG / Porofessor / Blitz / u.gg 都不行),
因为 Riot API 在游戏进行中就是不返回数据给第三方。

唯一能绕过的路径:
1. **在 Riot 内部有权限的人** (不现实)
2. **TheShy 直播间开播推送** (如果他直播打排位, B 站开播推送就够用)
3. **OP.GG 收到 Riot 通知的瞬间** (OP.GG 也收不到)

参考:
- [How to Use Streamer Mode in League of Legends](https://blog.loltheory.gg/lol-streamer-mode/)
- [Anonymizing Your Riot ID - Riot Support](https://support.riotgames.com/en-us/league-of-legends/gameplay/anonymizing-your-riot-id)
- [In-game info not showing while playing - OP.GG Help](https://help.op.gg/hc/en-us/articles/55948777310873-In-game-info-not-showing-while-playing)

---

## 工作原理

1. GitHub Actions 每 5 分钟调用一次 OP.GG 官方 MCP API (`https://mcp-api.op.gg/mcp`)
2. 拉取 TheShy 的完整召唤师资料 (profile + league_stats + most_champions + matches)
3. 检测以下事件:
   - **new_match**: 检测到新比赛 (主要通知, 比赛结束后 5-15 分钟触发)
   - **lp_changed**: LP 变化 (主播模式下最有价值的实时信号)
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
