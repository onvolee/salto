# 20 — 安全和隐私审计

Status: ready-for-agent

Blocked by: 08 — 扩展设置持久化, 10 — 字典客户端边界和契约, 11 — `youdao-web` 字典适配器, 12 — 字典查询执行集成, 13 — 字典充实集成, 17 — 保存后高亮集成, 19 — 迁移安全和恢复

## Outcome

审计所有 LLM/dictionary 请求、API-key、page context、权限、日志、错误、打包 artifacts 和 background message boundaries，形成可复现的安全验收证据。

## Frozen decisions

- 所有外部请求只从 background 发出；content/options 通过 typed messages，不携带 API key。
- LLM 只能请求 settings 配置且已 granted 的 origin；dictionary 只能请求 registered `youdao-web` origin，不接受任意 URL proxy。
- API key 不出现在 UI read response、message、logs、errors、analytics、fixtures 或 packaged source。
- selection/page content 在发送前 bounded/transient；`webContent` 最大 2000 UTF-16 code units，不写日志、cache 或持久化记录。
- permission 请求只发生在显式 save/test gesture；权限拒绝是可见、可恢复状态。

## Scope

- message payload validation、origin allowlist、permission handling、secret redaction、page-content bounds 和 adapter request guards。
- 核对 `<all_urls>` content script 对 optional host permission 的实际覆盖范围；验证 LLM/Youdao 显式手势是否产生真实权限提示，并决定保留现状或收窄注入/host permission 模型。
- source scan/packaged artifact 检查，日志/error fixture 检查，异常和拒绝路径测试。
- 记录 manifest permissions 的最小性、provider brittleness 和已知隐私限制。

## Non-goals

- 不增加 authentication、cloud sync、analytics 或新的 provider。
- 不把“通过审计”扩展为正式第三方安全认证。

## Acceptance criteria

- [ ] malformed/unknown messages 被拒绝且返回稳定、无 secret 的错误。
- [ ] 不能通过 background message 访问任意 URL；LLM/Youdao origin 检查覆盖配置、授权和替换后的状态。
- [ ] API key 和完整 page content 的 source/artifact/log scan 无命中；错误路径也无泄露。
- [ ] permission denied、timeout、provider failure、worker restart 和 stale response 不泄露敏感输入。
- [ ] 记录 `<all_urls>` content script 与 optional host permissions 的实际 Chrome 行为；若显式手势不会产生权限提示，收窄权限模型或明确记录可接受的产品限制。
- [ ] 审计结果记录命令、日期、构建版本和已知限制。

## Verification

- security/message tests、origin tests、artifact grep/scan、异常路径测试；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
- 检查 MV3 manifest 与实际请求路径一致；不执行默认 live provider request。

## Exit criteria

- 所有请求和 secret ownership 都能追溯到 background seam，21/22 可引用审计证据。

## Rollback boundary

发现问题时可禁用 provider/request path，保留本地 vocabulary 和 settings；不得以清理日志之外的方式删除用户数据。
