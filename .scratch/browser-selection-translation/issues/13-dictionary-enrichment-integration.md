# 13 — 字典充实集成

Status: ready-for-agent

Blocked by: 05 — 模板持久化和仓库操作, 08 — 扩展设置持久化, 10 — 字典客户端边界和契约, 11 — `youdao-web` 字典适配器

## Outcome

将 saved vocabulary 的 pending dictionary fields 批量交给 `youdao-web`，每个 vocabulary item/provider attempt 最多一次 lookup，独立持久化每个 normalized field，并复用 04 的 field-level retry。

## Frozen decisions

- `activeDictionaryProvider` 在 MVP 固定为 `youdao-web`；没有 provider fallback。
- 一次 lookup 的结果可以填充多个 dictionary-backed vocabulary fields。
- 每个 field 独立更新 status/value/error；一个字段失败不能回滚或覆盖 ready sibling。
- ready value 不被普通 retry 覆盖；刷新已有值不在本 ticket 范围内。
- 缺少 provider configuration 不消耗 attempt，按 04 规则保持 pending；Youdao failure 才进入 retry policy。

## Scope

- 从 pending field jobs 按 vocabulary item/provider 分组并调用 11 adapter。
- 将 normalized result 映射到 fixed vocabulary fields，独立持久化和清理成功字段 error。
- 将失败字段路由到 04 的 backoff/max-attempt/stale recovery，并保留 ready fields。

## Non-goals

- 不修改 save transaction、job schema、card generation 或 retry policy。
- 不实现第二 dictionary provider、手动 refresh 已 ready 值或词汇管理页面。

## Acceptance criteria

- [ ] 同一 item 的多个 pending dictionary fields 一次 lookup 即可填充。
- [ ] 部分成功后 ready fields 保留，失败 fields 独立记录错误和 retry state。
- [ ] service-worker restart、retry 和 provider missing 行为与 04 一致。
- [ ] 成功处理不会覆盖已有 ready value，也不会创建重复 field/job/card。

## Verification

- enrichment tests 用 fake adapter 覆盖 batch、partial success、failure retry、restart 和 idempotency。
- security test 确认请求只在 background-owned adapter path；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- dictionary enrichment 和 query execution 都使用 10 的 normalized contract，且 field-level state 可追踪。

## Rollback boundary

停止 Youdao enrichment 后保留 vocabulary 和 pending jobs；不得删除 ready fields、contexts 或 learning cards。
