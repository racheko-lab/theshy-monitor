# TheShy 韩服排位监控

> 每 5 分钟自动检测 TheShy（及其他账号）的 OP.GG 数据，排位状态变化时推送通知，比赛结束推送战绩，LPL 赛前提醒，IG比赛B站开播通知。

## ✨ 功能特性

- 🔍 **多账号监控**：支持同时监控多个韩服账号（The shy#asdf、은여하#1103 等）
- 📊 **完整比赛数据**：KDA、装备、符文、输出/承伤占比、双方阵容、禁用英雄、资源控制（龙/塔/男爵/先锋/阿塔坎/虚空巢虫）
- 🏆 **段位/LP变化通知**：实时追踪段位和LP变动
- 🎮 **比赛结果推送**：比赛结束自动推送胜负、英雄、KDA、时长
- 🔥 **连胜/连败提醒**：3连胜及以上、连败提醒
- ✨ **高光时刻通知**：MVP、四杀、五杀时特殊通知
- 🏟️ **LPL赛程提醒**：IG比赛前30分钟和开赛时提醒
- 📺 **B站直播通知**：LPL官方直播间（房间6）IG比赛开播/下播通知（自动过滤重播/预告）
- 🌐 **GitHub Pages 网页**：展示实时状态、近期战绩、英雄统计、事件历史
- 🤫 **勿扰模式**：设置免打扰时段，夜间不被推送吵醒
- 📱 **移动端适配**：响应式设计，手机浏览器也能查看

## 📦 部署

### Fork 后 GitHub Actions 自动部署（推荐）

1. Fork 本仓库
2. 在仓库 Settings → Secrets and variables → Actions 中添加以下 Secret：

| Secret | 说明 | 必填 |
|--------|------|------|
| `BARK_KEY` | Bark 推送 Key（iOS 推荐） | 至少填一个 |
| `SERVERCHAN_KEY` | Server酱 SendKey | 至少填一个 |
| `DISCORD_WEBHOOK` | Discord Webhook URL | 至少填一个 |
| `THESHY_ACCOUNTS` | 多账号配置，格式见下 | 否（默认监控 The shy#asdf 和 은여하#1103） |
| `QUIET_START` | 勿扰开始时间，如 `23:00` | 否 |
| `QUIET_END` | 勿扰结束时间，如 `08:00` | 否 |

**多账号配置格式**：逗号分隔，每个账号格式为 `slug:game_name:tag_line:region:label`

示例：
```
main:The shy:asdf:KR:The shy#asdf,smurf:은여하:1103:KR:은여하#1103
```

3. 在仓库 Settings → Pages → Source 选择 **GitHub Actions**
4. 开启 Actions（如果是 Fork 的，去 Actions 页面点 "I understand my workflows, go ahead and enable them"）
5. 等待 5 分钟左右，第一次 Actions 跑完后就能在 `https://<你的用户名>.github.io/theshy-monitor/` 看到页面

### 可选：使用 config.json 配置

复制 `config.example.json` 为 `config.json`，可以配置：
- 自定义监控账号列表
- 自定义LPL赛程（覆盖硬编码）
- 通知开关和勿扰时段

注意：`config.json` 已在 `.gitignore` 中，本地配置不会被提交。

## 🖥️ 本地运行

```bash
git clone https://github.com/racheko-lab/theshy-monitor.git
cd theshy-monitor
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入你的 BARK_KEY 等配置
python theshy_opgg_monitor.py --verbose
# 或者只跑一次（适合调试）
python theshy_opgg_monitor.py --once --verbose
# 测试通知是否配置正确
python theshy_opgg_monitor.py --test-notify
```

## 📁 项目结构

```
.
├── theshy_opgg_monitor.py    # 主程序：OP.GG 数据采集 + 事件检测 + 通知发送
├── index.html                # 前端展示页面（GitHub Pages）
├── requirements.txt          # Python 依赖
├── .env.example              # 环境变量模板
├── config.example.json       # 配置文件模板（可选）
└── .github/workflows/
    └── theshy-monitor.yml    # GitHub Actions：每 5 分钟检测 + 自动部署 Pages
```

## 🔔 通知事件类型

| 事件 | 触发条件 |
|------|---------|
| 比赛结果 | 排位/匹配/大乱斗对局结束 |
| LP变化 | 单双排/灵活组排LP变动 |
| 段位变化 | 晋升/掉段 |
| 等级变化 | 召唤师等级提升 |
| 连胜 | 3连胜及以上（3/5/7连胜时提醒） |
| 连败 | 3连败及以上 |
| 高光时刻 | MVP、四杀、五杀 |
| LPL提醒 | IG比赛前30分钟、比赛开始时 |
| B站直播 | LPL官方直播间IG比赛开播/结束 |
| 错误 | API请求失败等异常情况 |

## ⚙️ 推送渠道配置

### Bark (iOS)
1. App Store 下载 Bark App
2. 复制推送 URL 末尾的字符串（如 `https://api.day.app/xxxxxxxxxx/` 中的 `xxxxxxxxxx`）
3. 填入 `BARK_KEY` Secret

### Server酱
1. 访问 https://sct.ftqq.com/ 登录获取 SendKey
2. 填入 `SERVERCHAN_KEY` Secret（免费版每天5条）

### Discord
1. 在服务器频道设置 → 整合 → Webhook → 新建Webhook
2. 复制Webhook URL填入 `DISCORD_WEBHOOK` Secret

## 📄 数据源

- [OP.GG](https://op.gg) - 召唤师数据、比赛记录
- [Bilibili API](https://live.bilibili.com) - 直播状态
- CommunityDragon/DataDragon - 英雄/装备/符文图标

## 📜 License

MIT
