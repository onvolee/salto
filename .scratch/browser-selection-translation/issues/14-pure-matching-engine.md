# 14 — 纯匹配引擎

Status: ready-for-agent

Blocked by: 04（已完成）

## Outcome

提供 storage-neutral、纯函数的 saved-term matcher：英文大小写不敏感、完整词边界、无词形还原、同一文本节点内最长术语优先；匹配计算与 DOM 变更完全分离。

## Frozen decisions

- term 使用 PRD 的 NFKC/空白规范化和 English lowercase；不做 stemming、lemmatization、punctuation rewriting 或 cross-node matching。
- 术语文本进入正则前必须 escape；空术语和重复 canonical key 被过滤。
- 英文单词边界遵守 ASCII letter/digit/underscore 规则；撇号和 Unicode 非 ASCII 行为必须由测试明确记录，不依赖浏览器 locale 偶然行为。
- overlap 时同一文本节点优先最长有效术语；同长度使用 deterministic order。

## Scope

- matcher input/output 类型、term normalization/dedupe、boundary check 和 overlap resolution。
- 对空、大术语集、mixed case、punctuation、apostrophe、special regex chars 和 Unicode fixtures 的测试。

## Non-goals

- 不遍历 DOM、不包装文本、不观察 mutation；属于 15/16。
- 不做跨节点短语、不做词形匹配、不读写 IndexedDB。

## Acceptance criteria

- [ ] 所有 frozen matching rules 有纯函数测试，包括最长术语、边界和特殊字符。
- [ ] matcher 不修改输入、不触碰 DOM、不生成未 escape 的正则。
- [ ] 大术语集测试证明结果确定且不会因词序改变而改变。

## Verification

- `packages/core` 或 highlighting seam 的 unit tests；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- 15 可以直接消费稳定的 match ranges，不需要自行决定 Unicode、边界或 overlap 规则。

## Rollback boundary

回滚 matcher 不得清除 saved vocabulary 或改变 vocabulary canonical keys；改变匹配规则必须补充迁移/兼容说明和回归测试。
