# 15 — DOM 遍历和包装

Status: ready-for-human

Blocked by: 14 — 纯匹配引擎

## Outcome

使用 TreeWalker/NodeIterator 将 14 返回的 match ranges 包装为可清理的 Salto highlight wrapper，不重写宿主页面 `innerHTML`，不触碰交互、编辑、代码、隐藏或扩展自有 UI。

## Frozen decisions

- 跳过 `a`、`button`、`input`、`textarea`、`select`、`option`、`code`、`pre` 和 contenteditable 祖先。
- 跳过 `script`、`style`、hidden/disconnected 节点、已包装节点和 Salto 自有 UI/Shadow DOM。
- 只拆分单个文本节点中的命中范围；不跨 DOM 节点匹配。
- wrapper 有稳定的 Salto marker 和可见波浪下划线，不仅依赖颜色表达状态。
- cleanup 只移除 Salto wrapper 并恢复原文本节点结构，不替换 `innerHTML`，不删除宿主元素 listener。

## Scope

- text-node traversal、skip predicate、range splitting/wrapping、marker 和 deterministic cleanup。
- 与 14 matcher 的 seam adapter；不把 provider/storage 逻辑带入 DOM 层。

## Non-goals

- 不实现 initial scan、MutationObserver、frame budget；属于 16。
- 不实现 saved-term subscription 或设置开关；属于 17。

## Acceptance criteria

- [x] 所有 skip categories 的 fixture 保持原 DOM/text 和 listener 行为。
- [x] 一个文本节点中多个命中可正确拆分；overlap 服从 14 的最长术语规则。
- [x] 重复扫描不会产生嵌套或重复 wrapper。
- [x] cleanup 后页面文本和宿主元素 listener 保持，Salto wrapper 完全移除。
- [x] visible style 在 light/dark 下可见，保存状态不只由颜色表示。

## Verification

- DOM tests 覆盖 skip、split/wrap、idempotent scan、cleanup、listener survival 和 style marker。
- `pnpm test`、`pnpm typecheck`、`pnpm build`；用 fixture 手动检查表单、链接、代码和 Salto UI。

## Exit criteria

- 16 可在不改变 wrapper 语义的情况下加入增量观察；17 可安全调用 cleanup。

## Rollback boundary

停止 highlighting 时只清理 Salto-owned wrappers；不得通过 innerHTML 或全页重建破坏宿主 DOM。

## Comments

- 2026-07-20: Implemented the DOM highlighting seam in `single-pass-highlighter`. `highlightSavedTermsInDocument` snapshots eligible text nodes with `TreeWalker`, consumes core match ranges, and wraps each node from right to left. `cleanupSavedTermHighlights` removes only Salto-owned wrappers, restores text nodes without `innerHTML`, and preserves host listeners. Tests cover longest-overlap range consumption, all frozen skip categories (including Shadow DOM and existing wrappers), idempotence, cleanup, host-owned marker preservation, listener survival, and the wavy underline marker. Verified with `pnpm test`, `pnpm typecheck`, and `pnpm build` (all pass; extension tests: 195 passed, 1 skipped).
- 2026-07-20: Added CSS-hidden ancestor coverage for `display: none` and `visibility: hidden` without layout geometry checks. Focused highlighter test passes (7 tests) and extension typecheck passes. The package-wide extension test command is currently blocked by an unrelated concurrent `enrichment-queue` failure; no enrichment files were changed here.
