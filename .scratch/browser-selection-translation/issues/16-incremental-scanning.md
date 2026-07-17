# 16 — 增量扫描和观察

**What to build:** 实现初始扫描（document idle 后）、MutationObserver 观察新增节点、忽略 Salto 包装引起的变更、合并快速变更为有界队列、requestAnimationFrame 批处理 DOM 写入、在支持时让出工作并在内容上下文失效时停止。

**Blocked by:** 15 — DOM 遍历和包装

**Status:** ready-for-agent

- [ ] 初始扫描：在 document idle 后运行一次初始扫描
- [ ] MutationObserver：使用 MutationObserver 观察新增节点
- [ ] 忽略 Salto 变更：忽略由 Salto 包装引起的变更
- [ ] 合并快速变更：通过有界队列合并快速变更
- [ ] requestAnimationFrame 批处理：在 requestAnimationFrame 批处理中处理 DOM 写入
- [ ] 让出工作：在支持时在批处理之间让出工作，并在内容上下文失效时停止工作
- [ ] 定义批处理大小：定义批处理大小和每帧最大工作量，并测量 fixture 结果
- [ ] 避免全文档扫描：避免在每次变更后扫描未更改的整个文档
- [ ] 避免病态正则：避免一个无界病态行为的正则表达式（对于非常大的术语集）
- [ ] 开发诊断：仅在开发诊断中记录扫描持续时间、节点数和匹配数，不捕获页面文本
- [ ] 性能 fixtures：在性能检查中包含大型静态文章和快速无限滚动 fixture
- [ ] Mutation 测试：覆盖新增文本、移动节点、Salto 变更和重复观察器传递
- [ ] 性能断言：性能 fixtures 断言有界批处理而不是脆弱的墙钟时间
