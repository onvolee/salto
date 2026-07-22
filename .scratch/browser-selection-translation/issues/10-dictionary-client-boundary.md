# 10 — 字典客户端边界和契约

Status: ready-for-human

Blocked by: 04（已完成）

## Outcome

定义 provider-neutral 的 dictionary lookup contract，统一 query translation 和 vocabulary enrichment 的 text/list 字段形状，并提供确定性 fake。provider URL、HTML、cookie、selector 和解析细节不得泄漏到 core contract。

## Frozen decisions

- normalized fields 为 `phonetic`、`partOfSpeech`、`meaning`、`synonyms`、`wordForms`，value shape 与 fixed vocabulary schema 一致。
- adapter 必须声明 provider ID 和支持语言；MVP 首个 provider 是 `youdao-web`。
- 不支持语言在发送请求前拒绝；missing/unsupported field 是 unavailable，结构改变或类型错误是 parser failure。
- 每次 lookup 都接受 AbortSignal，具有 timeout、最大响应大小和 content-type 检查。
- fake 不访问网络，fixture 由调用方注入；真实 HTTP 只在显式 adapter smoke test 中启用。

## Scope

- 定义 `DictionaryClient`/adapter interface、normalized result、failure categories 和 capability metadata。
- 实现 timeout、cancel、response-size/content-type guard 的共享边界。
- 提供 fake adapter 和不依赖 provider 的 contract test suite。

## Non-goals

- 不实现 Youdao HTML parser；属于 11。
- 不实现 query execution、enrichment mapping、settings selector 或 UI；属于 12/13/08。
- 不做 provider aggregation、fallback、offline dictionary 或跨语言推断。

## Acceptance criteria

- [x] normalized contract 能表达所有 fixed dictionary fields，并拒绝错误 value shape。
- [x] adapter capability 和 unsupported-language rejection 在请求前生效。
- [x] timeout、cancel、size、content-type 和 parser failure 都返回稳定、无 secret 的错误分类。
- [x] 同一 contract tests 可运行于 fake 和 11 的 `youdao-web` adapter。
- [x] 默认测试不发送 live dictionary request。

## Verification

- core/client contract tests 覆盖成功、缺失字段、错误类型、语言拒绝、超时、取消、超大响应和错误 content type。
- `pnpm test`、`pnpm typecheck`、`pnpm build`。

验证记录（2026-07-19）：

- deterministic fake 已运行 `@salto/core/testing` 导出的共享 adapter contract suite；11 可用相同 scenario factory 接入本地 HTML fixtures。
- HTTP boundary 测试只注入 fake fetch，覆盖 timeout、中途取消、stream byte limit、content-type、HTTP failure、network failure 和 `credentials: omit`，未发送 live request。
- 初次 `pnpm test`：core 49 tests、extension 163 tests 通过。
- dictionary 单一真源修复后：core 50 tests、core/extension typecheck、template-editor 3 tests 和 production build 通过；09 的异步等待竞态修复后，主验收重跑 workspace test 为 core 50、extension 163 全部通过。
- `pnpm typecheck`：通过。
- `pnpm build`：通过，Chrome MV3 production bundle 生成成功。

## Exit criteria

- 11、12、13 不需要自行定义 normalized field、错误分类或取消语义。

## Rollback boundary

可以禁用 dictionary execution，但不能改变已有 vocabulary schema 或删除待处理 jobs。contract 扩展必须保持旧 adapter 的兼容解析路径。
