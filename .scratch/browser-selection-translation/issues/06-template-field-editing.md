# 06 — 模板字段编辑和排序

Status: ready-for-agent

Blocked by: 05 — 模板持久化和仓库操作

## Outcome

在现有 options 侧边栏的“划词翻译”分区中，用户可以管理模板并编辑 template field 的 label、source、type、instruction、dictionary field、enabled 状态和顺序，并通过键盘完成相同操作。

## Frozen decisions

- 沿用 `apps/extension/entrypoints/setting.options/` 的现有 sidebar/settings 结构，不新建 Tabs 页面。
- `source=llm` 时允许 `type=text|list` 并要求 instruction；`source=dictionary` 时只能选择 frozen dictionary field，type 从 field map 派生。
- source 切换必须先确认；确认后清除不兼容的 instruction/dictionary 值，取消则保留原值。
- 每个可保存 template 至少包含一个 enabled field；删除字段只影响 template，不影响固定 vocabulary schema。
- 模板列表提供新建、复制、编辑、删除和设为 active/default；删除最后一个 template 或 system template 被拒绝。
- 顺序在一个保存操作中从 0 开始连续归一化；拖拽之外必须提供上移/下移或等价键盘操作。
- 使用已安装的 `@dnd-kit/core`、`@dnd-kit/sortable`、`@tanstack/react-form` 和 `zod`；不为本 ticket 重新引入 UI 框架。

## Scope

- 实现 field 编辑 draft、保存/取消、字段增删、来源/类型校验、enabled 切换和顺序归一化。
- 在同一 Selection section 实现模板列表、active 标记、新建、复制、删除确认和设为 active/default。
- 为拖拽和键盘重排提供稳定的 accessible name、focus order 和错误关联。
- 将表单提交通过 05 的 repository/service 边界写入。

## Non-goals

- 不实现 prompt variable parser/menu；属于 07。
- 不实现翻译面板模板切换；面板只读取 settings 选出的 active template。
- 不修改固定 vocabulary field schema，不添加隐藏或来源编辑控件。
- 不调用 LLM/dictionary 验证字段；保存时只做本地 schema validation。

## Acceptance criteria

- [ ] label、enabled、LLM type/instruction、dictionary field 和 order 可保存并在重新打开后保持。
- [ ] 新建、复制、编辑、删除和设为 active/default 可完成；删除 system template 或最后一个 template 被拒绝。
- [ ] 非法 source/type/field 组合、空 label、空 instruction 和重复/断裂 order 被拒绝并显示字段级错误。
- [ ] source 切换确认、取消和清空规则可测试；切换不会留下同时存在的 LLM 与 dictionary 专属值。
- [ ] pointer drag、键盘上移/下移和禁用状态产生相同的最终顺序。
- [ ] 保存空字段列表或全部 disabled 的 template 被拒绝，并显示可关联的表单错误。

## Verification

- options/service tests 覆盖 template CRUD、active/default、draft cancel、每种字段 union、来源切换、删除保护、拖拽、键盘重排和保存失败。
- 手动用键盘完成编辑、重排、取消和错误修复；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- 字段编辑行为由测试和 frozen contract 定义，agent 不需要再决定 source/type 规则。
- 页面无 direct Dexie access，保存后 09 可以直接读取新模板。

## Rollback boundary

可以回滚字段编辑 UI，但不能丢弃已保存模板字段。若未来 schema 扩展，旧的未知字段必须经迁移保留。
