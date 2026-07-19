# 11 — `youdao-web` 字典适配器

Status: ready-for-human

Blocked by: 10 — 字典客户端边界和契约

## Outcome

实现第一个生产字典适配器 `youdao-web`，用脱敏 HTML fixtures 和结构化 DOM parser 产出 10 定义的 normalized lookup result，达到稳定验收后再考虑 `cambridge-web`。

## Frozen decisions

- 首个 provider 固定为 `youdao-web`；MVP 不实现 Cambridge、聚合或 fallback。
- Settings 只显示 Youdao 为当前 provider，不提供单选下拉；provider ID 由 adapter registration 固定。
- fixture 必须脱敏，不含 cookies、用户输入之外的页面隐私、登录信息或凭据，并记录来源日期。
- parser 使用 provider-specific DOM selectors，不使用覆盖整个 HTML 的宽泛正则表达式。
- 结构改变返回稳定 parser failure；未找到和缺失字段分别映射为 contract 定义的 unavailable 类别。
- live smoke test 显式 opt-in，默认 test suite 和 CI 不访问 Youdao。

## Scope

- 常见词、多词性、缺失字段、未找到和畸形/变更 markup fixtures。
- Youdao HTTP adapter：origin/permission、ofetch timeout/retry/error handling、AbortSignal 和 response guard。
- 将 DOM 结果映射到 phonetic、partOfSpeech、meaning、synonyms、wordForms，并执行 10 的 contract tests。
- 记录 provider brittleness、已知限制和诊断信息。

## Non-goals

- 不实现第二 provider、自动 fallback、离线数据或多 provider aggregation。
- 不改变 fixed vocabulary schema，不实现 query/enrichment orchestration；属于 12/13。
- 不把真实页面内容或 live response 写入日志、fixtures 以外的 artifacts。

## Acceptance criteria

- [x] 每个 fixture 都能稳定产生预期 normalized fields 或预期 failure category。
- [x] 常见词和多词性覆盖固定字段；缺失字段不导致其他成功字段丢失。
- [x] not-found、markup change、timeout、cancel、permission denied 和 oversized/invalid response 有稳定结果。
- [x] 请求只允许 `youdao-web` 所需 origin，不接受任意 URL proxy 参数。
- [x] contract tests、parser tests 和 opt-in live smoke test（若运行）均有结果记录。

## Verification

- parser fixture tests 覆盖每个 normalized output field 和失败类别。
- adapter boundary tests 覆盖权限、取消、超时、响应大小和 content-type。
- `pnpm test`、`pnpm typecheck`、`pnpm build`；live smoke test 单独命令运行。

验证记录（2026-07-19）：

- 本地 dictionary suite：23 tests 通过，opt-in live smoke 默认 1 skipped；所有默认 HTTP 使用本地 fixture 或 injected fetch。
- `youdao-web` 已运行 Ticket 10 导出的共享 adapter contract suite。
- 显式 live smoke：`SALTO_YOUDAO_LIVE_SMOKE=1 ... youdao-web-live.test.ts`，仅查询 `example`，1 test 通过。
- `pnpm test`：core 51 tests、extension 179 tests 通过，live smoke 1 skipped。
- `pnpm typecheck`：通过。
- `pnpm build`：通过；manifest 不声明 required dictionary host permission，adapter 只检查现有 optional coverage 下的 `https://dict.youdao.com/*` exact grant。
- Provider selectors、脆弱点、已知限制和 live 命令记录于 `apps/extension/src/dictionary/YOUDAO-WEB.md`；fixtures 为 2026-07-19 脱敏最小结构。

补充验证（2026-07-20）：

- Sources 只显示固定 `youdao-web`，显式“启用并测试”手势才请求 `https://dict.youdao.com/*`；拒绝授权后不发送测试消息并可重试。
- `test-dictionary-connection` typed message 不接受 payload；background 只允许 extension settings page 触发，并固定用 adapter 查询 `example`，响应仅包含连接状态和 provider ID。
- 聚焦消息/runtime/background/options suite：36 tests 通过；options 全组：31 tests 通过。
- `pnpm --filter @salto/core test`：51 tests 通过；`pnpm --filter @salto/extension test`：188 tests 通过、live smoke 1 skipped。
- `pnpm --filter @salto/extension typecheck`、`pnpm --filter @salto/extension build`：通过；生产 setting bundle 不含 Youdao HTTP 请求路径或 dictionary term request payload，provider HTTP 路径只存在于 background bundle。
- Chrome for Testing 133 真实扩展验收：Sources 仅显示 Youdao；点击前无 Youdao 请求；点击后固定查询 `example` 并显示成功；desktop/mobile、light/dark、键盘 focus、文本溢出和 console error 检查通过。
- 已知权限限制：现有 `<all_urls>` content script 使 Chrome 在请求 `https://dict.youdao.com/*` 时可能判定权限已覆盖而不再弹窗。Ticket 11 仍保证显式手势、精确请求参数和 adapter origin guard；manifest 权限最小性与真实提示语义由 Ticket 20 审计，不在本票中重构全局 content-script 注入模型。

## Exit criteria

- `youdao-web` 通过 query/enrichment 所需字段覆盖和错误验收；后续工作无需选择首个 provider。
- provider-specific details 留在 adapter 内，core contract 不包含 Youdao DOM 名称。

## Rollback boundary

可以移除或禁用 Youdao adapter，保留 template、vocabulary fields 和 jobs；受影响 jobs 保持 pending/failed 且可在未来明确启用 provider 后重试。
