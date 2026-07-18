# 21 — 端到端黄金路径验收

Status: ready-for-agent

Blocked by: 06 — 模板字段编辑和排序, 08 — 扩展设置持久化, 09 — 活动模板读取和翻译面板集成, 11 — `youdao-web` 字典适配器, 12 — 字典查询执行集成, 13 — 字典充实集成, 17 — 保存后高亮集成, 18 — 键盘快捷键和无障碍, 19 — 迁移安全和恢复, 20 — 安全和隐私审计

## Outcome

在生产构建上验证 PRD 的核心用户路径和浏览器兼容矩阵。该 ticket 只产出验收证据和问题清单，不承担功能修复、商店发布或版本号变更。

## Frozen decisions

- 黄金路径使用本地 deterministic fake 证明默认测试；`youdao-web` live smoke 只作为显式 opt-in 证据。
- template 在 settings 的 Selection section 选择并 Save；panel 只显示并使用 active template，不提供 panel selector。
- selection 本身不请求 provider；floating trigger/keyboard command 或 panel regenerate 才允许请求。
- 保存立即完成本地 transaction；enrichment 可异步，worker restart 后恢复；ready sibling 不因 failed sibling 消失。
- 发布候选构建必须通过 `pnpm test`、`pnpm typecheck`、`pnpm build` 和 manifest/artifact 检查。

## Scope

- 选择最多 500 UTF-16 code units、无查询、显式 trigger、panel viewport/drag/outside-click/Esc、active template name/schema order/regenerate/save。
- mixed LLM/dictionary field batching、field-level failures、immediate save、deduplicated re-save、worker restart、retry 和 meaning-recall card timing。
- highlight 初始/动态内容、disable/restore、options settings、keyboard/accessibility 和 migration/restart evidence。
- Chrome/Chromium 矩阵：静态文章、SPA-like navigation、长页面、表单/code 页面、窄 viewport、light/dark/system、options、worker restart。

## Non-goals

- 不在此 ticket 修复实现问题；发现问题必须链接到新 issue 或对应实现 ticket。
- 不执行 Chrome Web Store 发布、不改版本号、不生成未批准的权限或隐私声明；属于 22/发布流程。
- 不要求默认 CI 发出 live provider requests。

## Acceptance criteria

- [ ] 黄金路径脚本能从 settings 选 Youdao-backed template，到 selection、trigger、ordered output、save、reload、highlight 完成。
- [ ] 重复 save/context dedupe、worker restart、failed field retry 和 card readiness 有证据。
- [ ] 浏览器矩阵每项有 pass/fail、环境、构建版本和截图/日志链接；失败项有明确 owner/issue。
- [ ] test/typecheck/build、manifest permission 和 package file list 检查结果已记录。
- [ ] 没有未归属的失败或以“以后处理”替代的阻断项。

## Verification

- 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
- 在 Chrome 和至少一个 Chromium 环境加载精确 production output，执行矩阵并保存证据。
- 检查默认自动化测试没有 live provider request。

## Exit criteria

- 所有核心路径通过，或每个失败项都有链接、复现步骤和明确阻塞关系。
- 21 只交付验收记录；功能修复不能混入验收 ticket。

## Rollback boundary

删除验收 fixture/脚本不会影响运行时用户数据。不要通过修改生产数据或放宽安全检查来让验收通过。
