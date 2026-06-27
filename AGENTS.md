# ContextOS — Agent 工作手册

每次开始工作前必读。比 CLAUDE.md 更具体，记录踩过的坑和必须遵守的规则。

---

## 项目是什么

Electron + React 19 + Vite 8 的桌面 AI 工作台。**不是纯网页应用**，是打包成 .app 的桌面程序。

---

## 启动方式（必须用这个，不要用 `npm run dev`）

```bash
# 启动 Electron 桌面 APP（正确方式）
npm run dev:electron

# 这个命令做了两件事：
# 1. 启动 Vite dev server（http://localhost:5173）
# 2. 等 Vite 就绪后自动打开 Electron 窗口
```

**错误做法**：只跑 `npm run dev` 然后叫用户去浏览器访问。这是桌面 APP，用户要的是原生窗口，不是浏览器标签页。

构建打包：
```bash
npm run build:mac   # 产出 release/*.dmg
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19 + Vite 8 |
| 路由 | React Router v7，HashRouter |
| 桌面壳 | Electron 42，入口 `electron/main.cjs` |
| 存储 | IndexedDB via `idb`，封装在 `src/store/db.js` |
| 样式 | CSS variables（`src/index.css`），**无 Tailwind**，inline style |
| 图表 | Mermaid.js（只渲染）+ Markmap（脑图） |
| LLM | 前端直连，API Key 用户自填，`src/lib/llm.js` |
| i18n | react-i18next + i18next，`src/i18n.js`，locale 文件在 `src/locales/` |

---

## i18n 架构

- 语言文件：`src/locales/zh.json`（中文）、`src/locales/en.json`（英文）
- 初始化：`src/i18n.js`，默认语言从 `localStorage.getItem('ctx_lang')` 读取，缺省 `'zh'`
- 用法：组件内用 `useTranslation()` hook，模块级（非组件）用 `import i18n from '../i18n'` + `i18n.t()`
- key 结构：按组件命名空间，如 `filePanel.*`、`artifact.*`、`inputBar.*`
- **Hook 限制**：`useTranslation()` 只能在 React 函数组件内调用，模块级常量若需要翻译必须移进组件函数体
- 动态值：用 `{{variable}}` 插值，如 `t('skills.installedCount', { count: 3 })`
- 日期 locale：`i18n.language === 'zh' ? 'zh-CN' : undefined`
- 列表分隔符：`i18n.language === 'zh' ? '、' : ', '`

---

## 文件地图

```
contextos/
├── electron/main.cjs          # Electron 主进程
├── src/
│   ├── i18n.js                # i18n 初始化
│   ├── locales/
│   │   ├── zh.json            # 中文翻译（所有 key 在这里）
│   │   └── en.json            # 英文翻译（与 zh.json 结构一致）
│   ├── main.jsx               # React 入口，挂载 i18n
│   ├── components/
│   │   ├── ArtifactCard.jsx   # 流程图/脑图/文档卡片（已 i18n）
│   │   ├── ChatMessage.jsx    # 消息气泡（已 i18n）
│   │   ├── CreateProjectModal.jsx（已 i18n）
│   │   ├── DecomposeModal.jsx # 目标拆解（已 i18n）
│   │   ├── FilePanel.jsx      # 右侧文件/摘要/记忆/历史面板（已 i18n）
│   │   ├── InputBar.jsx       # 底部输入栏（已 i18n）
│   │   ├── ProjectCard.jsx    # 项目卡片（已 i18n）
│   │   ├── SearchModal.jsx    # 全局搜索（已 i18n）
│   │   └── SettingsModal.jsx  # 设置弹窗（已 i18n）
│   ├── pages/
│   │   ├── Overview.jsx       # 工作台首页（已 i18n）
│   │   ├── ProjectChat.jsx    # 项目对话页（已 i18n）
│   │   ├── SkillsPage.jsx     # 技能市场（已 i18n）
│   │   └── MCPPage.jsx        # MCP 工具市场（已 i18n）
│   ├── lib/
│   │   ├── llm.js             # LLM 调用，streamMessage()
│   │   ├── skills.js          # BUILTIN_SKILLS，SKILL_CATEGORIES
│   │   ├── mcp.js             # DEMO_SERVERS，MCP 连接管理
│   │   └── skillhub.js        # SkillHub 远程技能市场
│   └── store/db.js            # IndexedDB CRUD（projects/messages/files/skills）
```

---

## 样式规范

- 全用 CSS variables：`var(--bg-base)`、`var(--accent)`、`var(--text-primary)` 等
- **禁止硬编码颜色**
- 组件用 inline style，不引入额外 CSS 库
- 主色：`#8875F5`（`var(--accent)`）

---

## 已知数据约定

- `SKILL_CATEGORIES` 和 `CATEGORIES`（MCP 页）的值是中文字符串（`'全部'`、`'搜索'` 等），是数据层 key，**不翻译**
- `AGENT_TEMPLATES` 的 name/desc/systemPrompt 是中文数据内容，不是 UI 文案
- `DECOMPOSE_SYSTEM` 是 AI 系统提示词，留中文（影响 AI 输出语言）
- `通义千问` 是品牌名，不翻译

---

## 踩过的坑

1. **只跑 `npm run dev` 就叫用户去浏览器** → 错，必须用 `npm run dev:electron`
2. **ArtifactCard zoom 回调参数名用了 `t`** → 与 i18n 的 `t` 函数冲突，箭头函数参数改成 `s`
3. **模块级常量用了 `useTranslation()`** → hook 不能在组件外调，改成移进组件函数体（见 InputBar 的 SLASH_COMMANDS）
4. **JSON 字符串里用了 ASCII `"`** → 破坏 JSON 解析，中文引号改用 `「」`
5. **Edit 前没有 Read** → Write/Edit 工具要求先读，否则报错

---

*最后更新：2026-06-27*
