# 09 — 活动模板读取和翻译面板集成

Status: ready-for-agent

Blocked by: 05 — 模板持久化和仓库操作, 06 — 模板字段编辑和排序, 07 — 提示词变量解析和验证, 08 — 扩展设置持久化

## Outcome

翻译面板在每次打开时读取 settings 中已保存的 `activeQueryTemplateId`，显示活动模板名称，并按该模板执行翻译。模板选择只发生在 options/settings，不在翻译面板内切换。

## Frozen decisions

- options 的 Selection section 负责选择和保存全局 active template；panel 没有 template selector。
- panel 打开时读取一个 template snapshot；template 缺失或损坏时由 05 的 recovery 返回 `system-default`。
- 修改 active template 后，下一次打开或下一次显式翻译使用新模板；不要求当前已打开 panel 自动重跑。
- panel 的 regenerate 只重跑当前已加载的 template snapshot；close、regenerate 或新打开产生的旧 response 必须被 AbortSignal 或 generation token 忽略。
- panel 显示 template name、schema order、disabled omission 和独立 field states；选择或保存 template 本身不触发 provider 请求。

## Scope

- 通过 service/message 读取 active template 和 template snapshot。
- 更新 panel header、loading/error/empty/field-level states，使显示与 template schema 一致。
- 覆盖 active template 改变后下一次打开的行为、system-default recovery 和 stale response。

## Non-goals

- 不实现 panel 内模板切换、模板比较或自动执行。
- 不实现 template CRUD、field editor、variable parser 或 provider adapter。

## Acceptance criteria

- [ ] panel 打开显示当前 settings 选中的 template name，并按启用字段的 schema order 显示结果。
- [ ] 在 settings 选择另一个 template 并 Save 后，下一次打开 panel 使用新 template；当前 panel 不被隐式改写。
- [ ] disabled fields 不发起对应工作且不显示为 failed；unavailable/failed sibling 不隐藏 ready sibling。
- [ ] close/regenerate/new-open 后返回的旧 response 不会覆盖当前状态。
- [ ] active template 删除或损坏时，panel 使用 system-default 并显示可诊断但不泄露 secret 的状态。

## Verification

- selection/runtime tests 覆盖 active setting read、no selector in panel、next-open behavior、schema order、recovery、close/regenerate stale result。
- 手动验收：settings 选择并保存模板，重新打开 panel 检查名称和字段；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- options 选择和 panel 使用之间只有一个明确的 active-template contract；不存在未定义的 panel-switch 行为。
- 18、21 可以按同一面板状态和请求语义验收。

## Rollback boundary

回滚 panel 集成不得改变 settings 中已保存的 active template。旧请求仍必须被忽略，不能恢复为可能覆盖新状态的实现。
