# 17 — 保存后高亮集成

Status: ready-for-agent

Blocked by: 08 — 扩展设置持久化, 16 — 增量扫描和观察

## Outcome

保存成功后在当前页面无需 reload 即显示新术语；highlight 设置在启用、禁用、重新启用之间正确控制扫描和 cleanup，并在 settings listener 卸载时停止更新。

## Frozen decisions

- 只有本地 save transaction 成功后才加入 highlight term；save error 不改变页面。
- 禁用 highlighting 立即 cleanup Salto wrappers 并停止新的 scan；重新启用执行 bounded rescan。
- 高亮通过 16 的增量 seam 或单 term apply，不触发 provider request。
- listener 由 content context 注册并在 teardown 时移除；设置变化不依赖全局可变 state。

## Scope

- save-success event/message 到 highlighter 的连接。
- enable/disable/re-enable、当前页面新 term、动态新增内容和 cleanup integration tests。

## Non-goals

- 不重新实现 matcher、DOM wrapper 或 observer queue。
- 不实现 vocabulary dashboard、手动高亮颜色配置或跨页面同步。

## Acceptance criteria

- [ ] 新 term 保存成功后当前页面显示波浪下划线，无需 reload。
- [ ] save failure 不高亮；重复保存不创建重复 wrapper。
- [ ] disable 清理并恢复原文，enable 重新扫描后恢复匹配；dynamic content 仍受 observer 处理。
- [ ] listener teardown 后设置变化不再触发扫描或 DOM 写入。

## Verification

- integration tests 覆盖 save success/error、enable/disable/re-enable、dynamic content 和 teardown。
- 手动禁用高亮并检查页面原文、表单/代码区域和宿主 listener；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- 保存与高亮之间只存在一个成功事件契约；18、20、21 可复用该验收路径。

## Rollback boundary

回滚 save integration 不得删除 vocabulary；停止 highlight 时仅 cleanup Salto-owned wrappers。
