# 19 — 迁移安全和恢复

Status: ready-for-human

Blocked by: 05 — 模板持久化和仓库操作, 08 — 扩展设置持久化, 13 — 字典充实集成, 18 — keyboard/accessibility

## Outcome

为每个已发布 schema 版本提供前向 Dexie migration test；畸形 settings 恢复安全默认值而不删除 vocabulary；service worker 重启后 queued/running/failed/completed jobs 能继续或安全结束。

## Frozen decisions

- migration 只前向执行，任何失败都保留原数据并返回稳定 recovery/error 状态；不得清库。
- malformed settings 恢复 `system-default`、`zh-CN`、highlight enabled、system theme 和 MVP 的 `youdao-web` provider defaults。
- startup 将 stale running jobs 恢复为 queued/failed（遵循 04 的 claim policy）；completed jobs 不重复执行。
- provider 配置被移除时，相关待处理 dictionary jobs 保持 pending/queued，不消耗 attempt；ready fields 保留。
- install/update 的 default seed、alarm、command registration 都必须幂等。
- 所有 async response 在 close/restart/retry 后验证 request identity，不写入过期结果。

## Scope

- 每个历史 schema version 的 fixture 和 forward migration。
- malformed/missing/old settings、job recovery、provider removal、idempotent installation/update registration。
- service worker async rejection、stale response 和 listener startup audit。

## Non-goals

- 不新增 schema feature、不改 04 retry policy、不实现 sync/cloud migration。
- 不通过删除用户数据修复 migration failure。

## Acceptance criteria

- [x] 每个已发布 schema fixture 可升级到当前版本，vocabulary/contexts/fields/jobs 保留。
- [x] 缺失、旧的、畸形 settings 恢复安全默认值并可重复执行。
- [x] 各 job status 在 restart 后按 frozen policy 处理，completed 不重复、running 不永久卡住。
- [x] provider removal 不丢 ready data、不消耗无意义 attempts，重新启用后可恢复执行。
- [x] install/update 重复触发不会重复 alarms、commands、system template 或 listener。

## Verification

- migration/queue tests 覆盖历史 fixtures、restart、provider removal、repeated startup 和 stale response。
- `pnpm test`、`pnpm typecheck`、`pnpm build`；必要时执行扩展 reload/restart 手动检查。

## Exit criteria

- 数据安全和 worker recovery 有可重复证据；20 可以审计所有外部请求和 secret path。

## Rollback boundary

migration 失败只能停止升级并保留原库；不得 reset/delete IndexedDB、vocabulary、contexts、fields、cards 或 jobs。

## Comments

- Checkpoint (2026-07-20): v1-v7 Dexie forward fixtures now preserve vocabulary, fields, contexts, templates, settings, and v4+ jobs. A duplicate canonical-key fixture proves a failed unique-index upgrade leaves the original v1 database readable without clearing it.
- Checkpoint (2026-07-20): queue restart tests cover queued, stale running, failed, and completed jobs; missing providers keep queued work at zero attempts and preserve ready fields. Queue writes now require the same running attempt that claimed the request, so stale worker responses cannot overwrite a reclaimed job.
- Verification: Ticket-scoped tests pass (44 tests) and `pnpm build` passes. Full `pnpm test` and `pnpm typecheck` are currently blocked by concurrent Ticket 17 highlighting-contract changes: `background-services` returns `enabled` while its tests and one return branch have not yet been updated.
- Follow-up (2026-07-20): migration and recovery implementation is complete, but this ticket remains open until Ticket 18 lands. Verify its declarative command together with repeated install/startup/alarm/listener registration idempotency before closing acceptance criterion 5.
- Correction (2026-07-20): legacy schema fixtures now conditionally declare every version, including a true v1 fixture. Each case opens and asserts its target `Dexie.verno` before seeding, then asserts the upgraded database is v7.
- Closure (2026-07-20): Ticket 18 registers one declarative manifest command and one background listener per service-worker context. Repeated lifecycle events reuse the named `salto-enrichment-queue` alarm, while the existing repository test proves repeated default preparation retains one system template and one settings record. The production manifest, focused command tests, extension typecheck, and build all pass.
