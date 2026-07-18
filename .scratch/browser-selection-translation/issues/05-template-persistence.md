# 05 — 模板持久化和仓库操作

Status: ready-for-agent

Blocked by: 03（已完成）, 04（已完成）

## Outcome

通过 background/repository 边界持久化 query template 和 active template 设置。用户模板可以创建、复制、更新、删除和设为默认；system template 始终可恢复。options 组件不得直接访问 Dexie。

## Frozen decisions

- template 是 extension-local 配置，不进入 vocabulary sync 数据。
- 至少保留一个不可删除的 `system-default` template；它缺失、损坏或默认 ID 无效时，读操作先幂等恢复再返回。
- 用户模板 ID 由仓库生成，不能由名称派生；复制必须生成新 ID。
- 删除用户模板前由调用方确认；仓库拒绝删除 system template 和最后一个可用 template。
- 更新只接受符合 frozen query-template union 的对象；未知字段在读取和迁移中保留，不静默丢弃。
- 模板保存使用 `createdAt`/`updatedAt`，更新 `updatedAt`，不得依赖 service-worker 内存状态。

## Scope

- 为 template CRUD、default-template recovery、idempotent seeding 和 settings read/write 提供 repository/service 端口。
- 在 background message 边界校验名称、字段 ID、字段 union、唯一顺序和不可变 system template 规则。
- 为缺失、旧版本和畸形的 template/settings 数据提供前向、幂等迁移。
- 覆盖 create、copy、update、delete、set-default、recovery、reopen 和 migration。

## Non-goals

- 不实现 options UI；模板列表、编辑器和字段操作属于 06/07。
- 不实现面板内模板切换；翻译面板只读取 active template，settings 选择属于 08/09。
- 不实现 LLM、dictionary provider 或 API-key 流程；属于 08/10/11。
- 不添加 template import/export、多个 LLM profile 或 per-template model。

## Acceptance criteria

- [ ] 安装、恢复和读取路径重复执行 seed 后只存在一个 `system-default`，且不会覆盖用户模板。
- [ ] create/copy/update/delete/set-default 在成功和非法输入时返回稳定结果；删除最后一个可用模板被拒绝。
- [ ] 删除默认模板或发现默认模板损坏时，事务性恢复 system template 并更新 active template ID。
- [ ] 新建 service/repository 实例后，模板、默认 ID 和时间戳仍可读取。
- [ ] 迁移不会清空 vocabulary、contexts、fields 或 jobs；未知 template 数据按约定保留。

## Verification

- repository/service tests 覆盖成功、重复、非法 ID、删除保护、默认恢复、重启读取和每个历史 schema 迁移。
- 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
- 检查 options 代码只通过 service/message 使用仓库，没有直接 Dexie import。

## Exit criteria

- 05 的所有持久化不变量由测试锁定，且没有遗留产品选择。
- 06、08、09 可以使用稳定的 template/settings repository contract，不需要自行决定 recovery 规则。
- 失败迁移不会删除用户数据；提交前通过完整 test/typecheck/build。

## Rollback boundary

可以回滚 template UI 或新 message，但必须保留 system template 和已有用户模板。schema 变更只能新增前向迁移，不得以清空 IndexedDB 作为回滚。
