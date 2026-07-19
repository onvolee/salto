# 12 — 字典查询执行集成

Status: ready-for-human

Blocked by: 09 — 活动模板读取和翻译面板集成, 10 — 字典客户端边界和契约, 11 — `youdao-web` 字典适配器

## Outcome

翻译执行根据 active template 的 enabled dictionary fields 调用 `youdao-web`，每次 selection/provider/run 最多一次 lookup，映射 normalized values，保留 schema order，并隔离字段级 unavailable/failed 状态。

## Frozen decisions

- MVP 的 active dictionary provider 固定为 `youdao-web`；没有 provider selector、aggregation 或 fallback。
- 同一 run 的所有 dictionary fields 共用一次 lookup；LLM fields 仍由 03 的一次 LLM request 处理。
- disabled fields 不调用 provider，也不产生 failed result；缺失字段是 unavailable，解析/网络错误是 failed。
- panel close/regenerate/new-open 使用 AbortSignal 或 generation token 取消/忽略旧结果。

## Scope

- 将 template fields 按 source/provider 分组并调用 11 adapter。
- 映射 frozen dictionary field 到 normalized value，输出按原模板顺序排列的 field results。
- 将 dictionary execution 接入 09 panel/runtime path，保持 ready sibling 不受失败 sibling 影响。

## Non-goals

- 不实现 Youdao parser、enrichment queue 或第二 provider。
- 不新增 panel template selector，不改变 active template 的 settings 保存语义。

## Acceptance criteria

- [x] 一个 run 中多个 dictionary fields 只产生一次 Youdao lookup。
- [x] mixed LLM/dictionary fields 以 template schema order 返回，disabled field 缺席。
- [x] missing normalized value 显示 unavailable；单个 field 或 provider failure 不隐藏成功 sibling。
- [x] close/regenerate 后旧 dictionary response 不更新当前 panel。
- [x] 选择本身和 settings template 保存本身不触发 dictionary request。

## Verification

- query executor tests 用 fake adapter 证明 one lookup、mapping、order、disabled omission 和 failure isolation。
- selection integration tests 覆盖 panel state 与 stale response；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

验证记录（2026-07-20）：

- 新增 dictionary query executor，通过 core `DictionaryClient` 包装固定 `youdao-web` fake adapter；4 tests 覆盖单次 lookup、text/list mapping、schema order、disabled omission、missing unavailable，以及 LLM/dictionary 双向 failure isolation。
- production background 只注册固定 Youdao adapter；lookup term 来自已验证 selection、source language 固定为 `en`，message 未新增 provider URL、provider ID 或独立 dictionary term payload。
- 复用 selection integration tests 验证 selection-only 不发请求、close 取消 active request、regenerate/new-open 忽略旧 response；background message test 新增 template update 不执行 query executor 的断言。
- 聚焦 dictionary/background/selection suite：57 tests 通过；extension 聚焦 typecheck 通过。
- `pnpm test`：core 60 tests、extension 192 tests 通过，live smoke 1 skipped。
- `pnpm typecheck`：通过。
- `pnpm build`：通过，Chrome MV3 production bundle 生成成功。

## Exit criteria

- panel 运行路径只依赖 normalized DictionaryClient contract，且与 LLM 字段合并行为可测试。

## Rollback boundary

可以关闭 dictionary query execution 并将相关字段显示为 unavailable，但不得影响 LLM fields、panel close 或 saved vocabulary。
