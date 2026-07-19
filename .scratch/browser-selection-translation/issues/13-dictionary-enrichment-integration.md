# 13 — 字典充实集成

Status: ready-for-human

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

- [x] 同一 item 的多个 pending dictionary fields 一次 lookup 即可填充。
- [x] 部分成功后 ready fields 保留，失败 fields 独立记录错误和 retry state。
- [x] service-worker restart、retry 和 provider missing 行为与 04 一致。
- [x] 成功处理不会覆盖已有 ready value，也不会创建重复 field/job/card。

## Verification

- enrichment tests 用 fake adapter 覆盖 batch、partial success、failure retry、restart 和 idempotency。
- security test 确认请求只在 background-owned adapter path；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

验证记录（2026-07-20）：

- production background 复用固定 `youdao-web` adapter 的 core `DictionaryClient`，query execution 与 enrichment 共用同一 normalized boundary；content/options message 未新增 provider、URL 或独立 enrichment term 参数。
- dictionary source tests 使用 fake adapter 覆盖单 item 多字段一次 lookup、text/list/missing mapping、provider failure 的逐字段脱敏错误，以及 permission/provider missing 保持 pending。
- queue integration tests 使用 fake adapter 覆盖 partial success 后仅重试未完成 jobs、timeout 的 attempts/backoff retry 与成功后清除 error、service-worker restart、stale recovery、并发 wake 和 card idempotency。
- queue 在 claim/source batch 前通过原子 field/job transaction 删除 ready field 的冗余 queued job，并保留 result-time 并发二次保护；provider missing 时 source 只收到 pending sibling，普通 retry 不覆盖既有 ready value。
- `pnpm --filter @salto/extension exec vitest run src/enrichment`：3 files、20 tests 通过；dictionary/enrichment/background 聚焦组合：6 files、68 tests 通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过；Chrome MV3 production bundle 生成成功。bundle audit 确认 Youdao request path 只存在于 `background.js`。
- `pnpm test` 在本票测试全部通过后仍被并行 Ticket 16 的未完成 highlighting 断言阻断；主代理将在 Ticket 16 checkpoint 后统一重跑 workspace test，本票未修改 highlighting 文件。

## Exit criteria

- dictionary enrichment 和 query execution 都使用 10 的 normalized contract，且 field-level state 可追踪。

## Rollback boundary

停止 Youdao enrichment 后保留 vocabulary 和 pending jobs；不得删除 ready fields、contexts 或 learning cards。
