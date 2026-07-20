# TheShy 排位监控

> 基于 OP.GG MCP API 的 TheShy 排位状态实时监控, GitHub Actions 自动部署。

🌐 **前端面板**: https://racheko-lab.github.io/theshy-monitor/

📋 **监控历史**: https://github.com/racheko-lab/theshy-monitor/commits/main/.theshy_opgg_state.json

## 工作原理

1. GitHub Actions 每 10 分钟调用一次 OP.GG 官方 MCP API (`https://mcp-api.op.gg/mcp`)
2. 拉取 TheShy 的召唤师资料, 检测 `updated_at` 字段变化
3. 检测到状态变化 (上线/打完排位/升级) 时:
   - 推送通知到 Bark / Server酱 / Discord
   - 把事件追加到 `.theshy_events.json`
   - 把状态写入 `.theshy_opgg_state.json`
   - 自动 commit 回 main 分支
4. 前端网页读取这两个 JSON 文件展示实时状态

## 优势

- **零成本**: GitHub Actions 公开仓库无限免费, OP.GG MCP 完全免费
- **零维护**: 不用服务器, 不用 API key, 不用每天续期
- **完全开源**: 代码 + 状态 + 事件历史全部可见

## 本地运行

```bash
pip install -r requirements_opgg.txt
export BARK_KEY=your_bark_key   # 可选
python3 theshy_opgg_monitor.py --once --verbose
```

## 文件说明

| 文件 | 用途 |
|---|---|
| `theshy_opgg_monitor.py` | 主监控脚本 |
| `index.html` | 前端面板 |
| `.theshy_opgg_state.json` | 状态持久化 (脚本自动写) |
| `.theshy_events.json` | 事件历史 (前端读取) |
| `.github/workflows/theshy-monitor.yml` | 监控 workflow |
| `.github/workflows/deploy-pages.yml` | 前端部署 workflow |

## 限制说明

- GitHub Actions cron 不保证准时, 实际触发延迟 5-15 分钟
- OP.GG MCP 数据非真实时 (依赖 OP.GG 后端刷新频率, 通常 1-3 分钟延迟)
- 因此实际响应时间约 6-18 分钟, **不是秒级监控**

如果需要秒级监控, 请用 Riot Spectator API (需要申请 API key).

## License

MIT
