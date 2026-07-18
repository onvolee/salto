# 11 — `youdao-web` 字典适配器

Status: ready-for-agent

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

- [ ] 每个 fixture 都能稳定产生预期 normalized fields 或预期 failure category。
- [ ] 常见词和多词性覆盖固定字段；缺失字段不导致其他成功字段丢失。
- [ ] not-found、markup change、timeout、cancel、permission denied 和 oversized/invalid response 有稳定结果。
- [ ] 请求只允许 `youdao-web` 所需 origin，不接受任意 URL proxy 参数。
- [ ] contract tests、parser tests 和 opt-in live smoke test（若运行）均有结果记录。

## Verification

- parser fixture tests 覆盖每个 normalized output field 和失败类别。
- adapter boundary tests 覆盖权限、取消、超时、响应大小和 content-type。
- `pnpm test`、`pnpm typecheck`、`pnpm build`；live smoke test 单独命令运行。

## Exit criteria

- `youdao-web` 通过 query/enrichment 所需字段覆盖和错误验收；后续工作无需选择首个 provider。
- provider-specific details 留在 adapter 内，core contract 不包含 Youdao DOM 名称。

## Rollback boundary

可以移除或禁用 Youdao adapter，保留 template、vocabulary fields 和 jobs；受影响 jobs 保持 pending/failed 且可在未来明确启用 provider 后重试。
