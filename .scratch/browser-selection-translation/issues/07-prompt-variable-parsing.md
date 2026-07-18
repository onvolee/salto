# 07 — 提示词变量解析和验证

Status: ready-for-human

Blocked by: 03（已完成）, 05 — 模板持久化和仓库操作

## Outcome

为 template editor 和 runtime 共用一个 prompt-variable parser/renderer。编辑器可以插入变量；保存时对未知或畸形变量给出警告但不阻止保存；运行时缺失上下文值使用 frozen contract 的空字符串，并保留明确诊断。

## Frozen decisions

- 仅支持 `selection`、`sentence`、`paragraphs`、`targetLanguage`、`webTitle`、`webUrl`、`webContent`。
- 变量语法统一为 `{{variableName}}`；重复、相邻变量和普通文本均合法。
- 未知变量和畸形 token 是 warning，不阻止模板保存；runtime 不静默替换未知变量。
- 缺失上下文值是合法的 unavailable input，渲染为空字符串；`webContent` 上限为 2000 UTF-16 code units。
- 插入菜单只编辑文本，不发送 provider 请求或执行预览请求。

## Scope

- 提供 parser result（tokens、known/unknown/malformed diagnostics）和 renderer。
- 在现有 options“划词翻译”分区的 template editor 中提供变量插入菜单和保存 warning summary。
- 让 03 已有 runtime path 改为调用同一 parser/renderer，避免 editor/runtime 语义分叉。

## Non-goals

- 不实现模板字段 CRUD、排序或模板持久化；属于 05/06。
- 不执行真实 LLM preview，不做变量自动补全或复杂表达式。
- 不扩展变量名、嵌套语法、条件语法或 markdown 渲染。

## Acceptance criteria

- [x] 七个 frozen variables 都能从插入菜单插入，手动输入产生相同 parser result。
- [x] 有效、重复、相邻、未知、空名和畸形 token 都有确定性测试结果。
- [x] 未知/畸形变量在保存界面显示 warning，保存成功；运行时为该字段保留可诊断错误，不把未知 token 当成上下文值。
- [x] missing context 与 unknown variable 在 UI 和 runtime result 中可区分。
- [x] parser 不触发网络请求，`webContent` 截断测试覆盖边界。

## Verification

- core parser/renderer tests；options test 检查 warning、插入和无网络编辑。
- translation service test 证明 editor 保存的指令在下一次运行使用同一 rendering 规则。
- 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- editor/runtime 只存在一个变量语义；所有 warning 与 runtime diagnostic 均有稳定测试。
- 09 可复用该 contract，不需要重新定义 settings 选择或渲染规则。

## Rollback boundary

可以回滚变量菜单，但不能改变已保存模板的变量解释方式而不提供迁移/兼容规则；未知变量不得因回滚被静默执行。

## Comments

- 2026-07-19：实现单一 core parser/renderer，兼容 `{{ selection }}`，插入统一输出 `{{selection}}`。unknown 与 malformed 分别使用 `unknown-prompt-variable` 和 `malformed-prompt-variable`，missing known context 渲染为空字符串。
- 2026-07-19：options 字段编辑器提供七项原生变量选择器，在当前 caret/selection 插入并恢复 textarea 焦点；warning 通过 `aria-describedby` 关联 instruction，且模板保存测试证明 warning 不阻塞保存。
- 2026-07-19：验证通过：`pnpm test`（core 38，extension 133）、`pnpm typecheck`、`pnpm build`（Chrome MV3 总大小 1.87 MB）。
