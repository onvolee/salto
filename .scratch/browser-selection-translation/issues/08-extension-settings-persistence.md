# 08 — 扩展设置持久化

Status: ready-for-human

Blocked by: 03（已完成）, 04（已完成）, 05 — 模板持久化和仓库操作

## Outcome

在现有 options sidebar 中持久化 active query template、target language、highlight、theme 和 LLM 配置；API key 与公开配置分离，exact-origin permission 只在显式保存或测试时请求，拒绝后可恢复。

## Frozen decisions

- UI 入口为 `apps/extension/entrypoints/setting.options/`，沿用 General/Selection/Sources/Vocabulary/AI Provider sections。
- Selection section 选择的是全局 `activeQueryTemplateId`；修改后进入现有 dirty draft，点击页面底部统一的 Save 才持久化。
- 旧 settings 中的 `translationTemplate: compact | context` 是历史 UI preset，不是独立 template entity；迁移时先幂等 seed `system-default`，两种旧值都映射为 `activeQueryTemplateId=system-default`，再移除旧 key。
- 默认值为 `targetLanguage=zh-CN`、`highlightEnabled=true`、`themeMode=system`；`activeDictionaryProvider` 在 MVP 固定为 `youdao-web`，不显示 provider 下拉框。
- 只有一个 active OpenAI-compatible config：provider、baseUrl、model、可选 temperature。
- API key 只能写入和替换；读取接口只返回 `hasApiKey`，UI、message、content script、日志和错误中不得出现 key。
- 仅对配置 origin 请求 `<origin>/*` optional host permission；save/test 是显式 gesture，拒绝显示可重试错误，替换 origin 后删除旧 grant（若浏览器允许）。

## Scope

- settings repository/service、公开/secret 分离读取、幂等默认值和时间戳。
- General/Selection/AI Provider sections 的表单校验、保存状态、permission denied recovery 和 theme 应用。
- 设置变更通知供 panel/highlighting 订阅；组件卸载时移除监听器。

## Non-goals

- 不实现 dictionary adapter 或 provider selection UI；11/12 负责 `youdao-web` 的执行和字段映射。
- 不实现 template field editor、面板内模板切换或 vocabulary dashboard。
- 不实现多个 LLM profile、key read-back、云同步或新的 appearance system。

## Acceptance criteria

- [x] 缺失、旧的和畸形 settings 恢复到安全默认值，不删除 vocabulary 数据。
- [x] 含旧 `translationTemplate` 的 settings 只迁移一次，映射结果稳定，且不重复创建 template 或丢失 vocabulary。
- [x] active template、target language、highlight、theme 和公开 LLM config 重启后保持。
- [x] 保存/测试前未请求 host permission；显式 gesture 只请求配置 origin；deny 后可重试或修改 origin。
- [x] key replace 后只能看到 configured/not-configured，任何 public message 都没有 secret。
- [x] 设置变更被相关扩展表面收到；卸载后不再收到事件。

## Verification

- service/repository tests 覆盖默认值、公开/secret 分离、permission allow/deny/revoke、origin replacement、重启和 malformed settings。
- options tests 覆盖 active template 选择、全局 Save、表单错误、保存成功/失败、键盘操作和主题三种模式。
- 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`，并检查打包产物不含 key fixture。

## Exit criteria

- 配置路径不暴露 secret，权限边界和恢复路径都有测试；09、17、19 可依赖稳定 settings contract。

## Rollback boundary

回滚设置 UI 不得删除 key、template 或 vocabulary 数据。权限撤销只能移除 origin grant，不得清理无关本地记录。

## Comments

- 2026-07-19：extension settings 已统一迁移到 Dexie/background typed-message 路径；旧 `salto-settings` 在 durable migration 成功后才移除，并覆盖 legacy preset、畸形记录、重复执行和 vocabulary 保留。
- 2026-07-19：General/Selection 使用 TanStack Form + Zod 全局草稿；active template、目标翻译语言、高亮和三种主题仅由底部 Save 持久化。LLM key 继续独立保存且只公开 `hasApiKey`，permission deny、重试和旧 origin 显式确认清理均有覆盖。
- 2026-07-19：`extension-settings-changed` 会广播到 extension pages 和 tabs，订阅 cleanup 删除原 listener；创建、复制、删除活动模板及 repository fallback 会保持 settings draft/notification 一致。
- 2026-07-19：双轴代码审查最终未发现剩余可执行问题。验证通过：`pnpm test`（core 38，extension 148）、`pnpm typecheck`、`pnpm build`（Chrome MV3 1.88 MB），打包产物未包含 secret fixture。
- 2026-07-19：验收补强为 legacy migration 增加 Dexie-only durable completion marker。迁移写入成功但旧 key cleanup 失败时，后续用户设置保存会保留 marker；worker 重试只清理旧 key，不会重新应用 stale legacy language/theme。marker 不进入 public settings、message、notification 或 UI。聚焦测试 27 项及 extension typecheck 通过。
