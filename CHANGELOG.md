# Changelog

本项目的重要变更均记录于此。版本号遵循 [Semantic Versioning](https://semver.org/)。

## [1.1.0] - 2026-08-28

### Added

- 新增统一的 Agent 模板运行时契约，持久化模板 ID、项目系统提示词、默认 Skill、必需 MCP 服务和模型能力要求。
- 新增 Agent 就绪状态：区分模型凭证、工具能力、MCP 连接、必填 MCP 凭证和工具启用状态。
- 新增 Skills 路由错误边界与恢复操作。
- 新增 Vitest、Testing Library 测试基础设施与 28 项运行时回归测试。
- 新增 Agent OS P0 实施方案、验收记录和浏览器验收说明。

### Changed

- MCP Agent 模板部署现在绑定实际安装后的 Skill ID，而不是静态展示 ID。
- 项目提示词按“活动 Skill → 线程覆盖 → 项目 Agent 提示词 → 通用默认”解析。
- ProjectChat 的就绪状态和发送给模型的工具使用同一个实时运行时快照。
- 旧版模板项目可读取原有顶层系统提示词；显式解绑 Skill 后，重载不会自动重新绑定。
- 版本号从 `1.0.0` 更新为 `1.1.0`。

### Fixed

- 修复 SkillHub 返回对象型作者或其他异常展示字段时，Skills 页面白屏的问题。
- 修复单条远端坏数据遮住内置 Skill 和其他有效社区卡片的问题。
- 修复缺少模型 API Key、缺少 Brave Key、必需 MCP 未连接或工具被禁用时仍显示“Agent 就绪”的错误状态。
- 修复模板部署后项目系统提示词未被聊天运行时消费的问题。
- 修复 Agent 模板默认 Skill 未正确持久化及旧项目兼容读取不完整的问题。

### Compatibility

- IndexedDB 数据结构保持向后兼容，无需手动迁移。
- 高风险/写入工具继续默认关闭，并保留逐次调用授权机制。
- 非工具模型仍可用于普通聊天，但不会被标记为 MCP Agent 已就绪。

### Known issues

- 跨窗口直接修改 localStorage 时，已挂载的聊天页需发生一次 React 更新或重新进入页面才能刷新 MCP 状态。
- 现有生产构建仍有大 chunk 提示。
- 依赖审计告警和缺失的 `scripts/local-audit.mjs` 将在独立安全维护任务中处理。
- SQLite Agent OS 执行账本、检查点与回滚控制器属于后续阶段，不在 v1.1.0 中。

[1.1.0]: https://github.com/william202404/contextos/releases/tag/v1.1.0
