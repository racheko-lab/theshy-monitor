# TheShy Monitor V2 Release Notes

## 1. Release Status

- **当前版本**：TheShy Monitor V2
- **状态**：Release Candidate / Production Ready
- **Release Gate**：PASS

V2 是一个完全独立的新前端，部署在 GitHub Pages 的 `/v2/` 子路径，**不修改、不覆盖旧版 `web/` 前端**（旧版仍位于根目录 `/`）。

---

## 2. Final Verification Results

### TypeScript

- 命令：`npm run typecheck`（`tsc --noEmit`）
- exit code：**0**
- error：**0**

### Lint

- 命令：`npm run lint`（`eslint src`）
- error：**0**
- warning：**0**

### Build

- 命令：`npm run build`（`vite build`）
- exit code：**0**
- warning：**0**（无 chunk 超阈值告警）

---

## 3. Performance Metrics

### 首屏 JS

- raw size：**362.57 KB**（`assets/index-*.js`）
- gzip size：**111 KB**

### 目标

- **< 150 KB**（gzip，不含 ECharts chunk）→ **达成**

### 说明

- ECharts 被打包为独立的 `assets/theme-*.js` chunk（gzip ~342 KB），通过 `React.lazy` 懒加载，**不计入首屏**。
- 首屏仅加载 React 运行时 + 应用核心逻辑，首次加载体积满足 <150 KB 目标。

---

## 4. Deployment Structure

### 开发构建（仅产出未注入的 `v2/`，用于本地调试）

```bash
npm run build
```

### 正式部署（完整可部署产物）

```bash
python build.py
```

### `build.py` 负责

1. **React build** — 调用 `frontend-v2` 的 `npm run build`，输出到 `v2/`
2. **复制数据** — 将全量 `data.json` / `events.json` 写入 `v2/`（供 30s 轮询刷新）
3. **注入首屏数据** — 将已 trim 的 inline 数据注入 `v2/index.html` 的 `<!-- __INITIAL_DATA__ -->` 占位符，生成 `window.__INITIAL_DATA__`，实现首屏秒开

### 重要说明

单独执行 `npm run build`（即裸 `vite build`）会因为 `vite.config.ts` 的 `emptyOutDir: true` **清空整个 `v2/` 目录**，导致此前注入的 `window.__INITIAL_DATA__` 内联数据消失。

> 这是**预期行为，不是错误**。正式部署必须经由 `python build.py`（它在 React build 之后立即执行 inline 注入），CI 工作流跑的也正是 `build.py`。

---

## 5. Architecture Overview

```
frontend-v2/
└── src/
    ├── components/   # ui/ (原子组件) · layout/ (骨架) · sections/ (区块 + charts/)
    ├── hooks/        # useData · useLenis · useInView · useCountUp
    ├── utils/        # time.ts · data.ts (纯函数聚合)
    ├── types/        # 全局类型定义 (AppData / AppEvent 联合类型等)
    └── constants/    # Design Token · 动画变体 · 常量
```

### 技术栈

- **React 19** — UI 框架
- **TypeScript** — 类型安全（strict 模式）
- **Vite** — 构建工具（输出至 `../v2`）
- **Tailwind CSS** — 样式（v4，`@theme` 集中 Design Token）
- **Framer Motion** — 入场 / 滚动视差动画
- **Lenis** — 平滑滚动
- **ECharts** — 数据图表（懒加载）
- **CountUp.js** — 数字滚动动画

---

## 6. Code Quality

已完成项：

- ✅ TypeScript **strict** 模式通过
- ✅ **无 `any`**（含 `Record<string, any>`）
- ✅ **无 TODO / FIXME / XXX / HACK**
- ✅ **无 `eslint-disable`**
- ✅ **无 `@ts-ignore` / `@ts-expect-error`**
- ✅ **生命周期清理完整** — interval / requestAnimationFrame / 事件监听 / Lenis / ECharts 均在卸载时正确释放
- ✅ **useMemo 优化完成** — 重计算（`computeStats` / `aggregateDailyMatches` / `aggregateDailyLp` / `buildHistory` / 图表 `option` 等）均已缓存，依赖最小化
- ✅ **死代码清理完成** — 删除未使用的 `Avatar.tsx` / `Divider.tsx` / `EASE_IN_OUT` 常量

---

## 7. Known Future Improvements

以下为 **P2 可选优化**，**只记录、不实施，不影响当前发布**：

- **ECharts `core` 按需加载** — 当前 `import * as echarts` 引入全量，可改为 `echarts/core` + 按需注册图表/渲染器，预计可将图表 chunk 从 ~1MB 降到 ~300–400KB
- **ErrorBoundary** — 为 `App` 增加错误边界，防止单个图表崩溃拖垮整页
- **Design Token 完整化** — 少量图表硬编码颜色（如 `#4F8CFF` / `#4ADE80`）与 `bg-white/5` 魔法值统一收口到 Token
- **Lighthouse CI** — 接入 `lighthouse-ci` 在 CI 中设性能门禁（当前环境无法运行 Lighthouse）
- **`React.lazy` 进一步拆包** — 将 `Stats` / `Heatmap` 区块也懒加载，首屏仅载 Hero + StatusCards

---

## 8. Release Checklist

- [x] TypeScript `typecheck` 通过（exit 0，0 error）
- [x] ESLint `lint` 通过（0 error，0 warning）
- [x] Production `build` 通过（exit 0，0 warning）
- [x] Deployment assets 齐备（`v2/index.html` / `assets/` / `data.json` / `events.json`）
- [x] Inline data injection 生效（`window.__INITIAL_DATA__`，18.1 KB）
- [x] Bundle size check 通过（首屏 JS gzip 111 KB < 150 KB）

---

## 9. Security Check

- **No secrets detected** — 全项目（不含 `node_modules`）扫描 `SendKey` / `token` / `secret` / `password` / `apikey` / `private_key` / `.env` / GitHub PAT 模式，无真实凭证硬编码
- **无真实 `.env` 文件** —— 仅存在 `.env.example` 模板（815 B，无真实值）
- `README.md` 中的 `SERVERCHAN_KEY` / `BARK_KEY` / `DISCORD_WEBHOOK` 仅为 GitHub Actions Secrets **配置说明**，非硬编码凭据
- **无 GitHub PAT / token 硬编码**（`ghp_` / `gho_` 等模式零命中）
- 注：V2 为纯静态前端，部署本身不需要任何密钥；上述 Secrets 仅服务于旧 monitor 后端的推送通知，与 V2 无关

（与最终 Handoff Report 的 Security Check 结论一致）
