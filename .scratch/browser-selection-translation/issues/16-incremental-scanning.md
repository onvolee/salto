# 16 — 增量扫描和观察

Status: ready-for-agent

Blocked by: 15 — DOM 遍历和包装

## Outcome

对页面执行一次 idle 初始扫描，并用 MutationObserver 以有界、可取消的队列处理新增/移动内容；Salto 自有包装引起的 mutation 被忽略，DOM 写入按 frame 批处理。

## Frozen decisions

- 初始扫描在 document idle 后运行一次；后续 mutation 只扫描受影响的新增 subtree/text nodes。
- 使用 bounded queue、合并重复节点和 `requestAnimationFrame` 批处理写入；不在每次 mutation 做全文档扫描。
- 定义并测试每批节点数和每帧最大工作量；预算是稳定上限，不用脆弱的墙钟阈值。
- 支持时在批次间让出工作；content context 失效、observer disconnect 或 extension teardown 后停止工作。
- 只记录开发诊断的 duration/node/match counts，不记录页面文本。

## Scope

- initial idle scheduling、MutationObserver、Salto mutation filter、bounded queue、RAF writer、teardown。
- 静态长文章和快速无限滚动 performance fixtures。

## Non-goals

- 不改变 14 matcher 或 15 wrapper/cleanup 规则。
- 不实现 provider 请求、词汇查询或持久化。

## Acceptance criteria

- [ ] 新增文本、移动节点、重复 mutation 和 Salto wrapper mutation 的行为有测试。
- [ ] queue 有明确容量/批次上限，超出时合并或丢弃可重新扫描的冗余 work，不阻塞页面。
- [ ] observer teardown 后不再写 DOM；快速 mutation 不触发全页扫描。
- [ ] 大文章和无限滚动 fixture 证明每批工作受上限约束，诊断不含页面文本。

## Verification

- Mutation/performance tests 断言 bounded batches、scan target 和 teardown，不断言固定毫秒数。
- `pnpm test`、`pnpm typecheck`、`pnpm build`；开发构建检查诊断内容。

## Exit criteria

- 17 可以订阅一个明确的 scan/apply/cleanup seam；20 可以审计页面内容边界和日志。

## Rollback boundary

停止 observer 后允许保留已有 highlights，或由 17 显式 cleanup；不得继续处理失效 context，也不得清空页面原文。
