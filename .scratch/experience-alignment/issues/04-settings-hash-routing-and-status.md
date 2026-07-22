# 04 — 设置 Hash 路由与分区状态摘要

**What to build:** 使设置页以 URL hash 作为唯一导航来源，并在每个分区右上角提供一个当前且真实的只读状态摘要，替代统一的“已同步”提示。

**Blocked by:** None — can start immediately.

Status: ready-for-agent

- [ ] 支持 `#/general`、`#/translate-template`、`#/translate-template/fields`、`#/translation-sources`、`#/vocabulary` 与 `#/api-providers`；缺失或未知 hash 规范化并回退到 `#/general`。
- [ ] 菜单和 tab 操作更新 hash；`hashchange`、刷新和浏览器历史导航恢复正确页面，而不会保留脱离 URL 的本地菜单状态。
- [ ] 通用分区显示保存状态；划词翻译显示当前活动模板；翻译源显示当前词典和本次会话的测试结果。
- [ ] 词汇分区显示富集失败数量或完成状态；AI 服务显示已配置/未配置和本次会话的连接测试结果。
- [ ] 状态项不可交互，绿色仅用于已验证成功或完成，灰色用于普通摘要，黄色用于需要注意，红色用于失败；不增加后台探测或持久化验证状态。
