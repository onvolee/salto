# 22 — 发布准备和打包清理

Status: ready-for-agent

Blocked by: 20 — 安全和隐私审计, 21 — 端到端黄金路径验收

## Outcome

在 21 通过后完成发布候选包的版本、说明、权限理由、隐私披露和包内容清理。此 ticket 只处理可发布 artifact 和文档，不代替产品验收或实际商店提交。

## Frozen decisions

- 只有 21 的完整验收证据和 20 的安全审计通过后才允许修改版本/发布说明。
- 不新增 runtime permission；文档必须解释现有 optional host permissions 的用途和显式请求时机。
- Chrome Web Store 提交由产品/发布负责人另行执行；本 ticket 不自动上传或发布。
- 发布包不得包含 source maps、fixtures 中的敏感数据、测试密钥、开发诊断或未使用资源（除非仓库发布策略明确要求）。

## Scope

- 检查并更新 extension version、CHANGELOG/release notes 和已知 provider limitations。
- 生成 `CHROMEWEBSTORE.md`（若仓库采用该文件）、权限理由、隐私披露和截图清单。
- 检查 MV3 manifest、production output、package file list、icons/assets 和 reproducible build metadata。

## Non-goals

- 不修复业务功能、不重新跑功能实现、不发布到 Chrome Web Store。
- 不改变权限、数据模型、provider 行为或隐私策略；发现问题回到对应 ticket。

## Acceptance criteria

- [ ] 发布版本与通过验收的 production build 一致，release notes 不声称未实现功能。
- [ ] 权限、API key、page content、Youdao adapter 和数据本地化说明准确且可追溯到 PRD/20。
- [ ] package file list 只包含发布所需文件，不包含 secrets、live cookies、测试隐私数据或未批准诊断。
- [ ] 截图/商店素材清单与实际 UI（settings sidebar、panel、highlight）一致。
- [ ] 所有变更在 21/20 证据之后完成并记录检查命令。

## Verification

- 运行 release build、manifest/artifact scan 和文档链接检查；记录版本、hash、日期和命令。
- 不执行上传；如需实际发布，单独获得发布授权并走外部发布流程。

## Exit criteria

- 发布候选包和配套文档可交给发布负责人，且没有把未验证的行为包装成已发布能力。

## Rollback boundary

发布准备失败时保留上一版发布包和用户数据；回滚版本/说明不得修改数据库、权限或清理本地用户记录。
