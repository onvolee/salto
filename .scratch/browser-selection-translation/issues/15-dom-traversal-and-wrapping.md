# 15 — DOM 遍历和包装

**What to build:** DOM 遍历使用 TreeWalker/NodeIterator 遍历文本节点，跳过规则（a、button、input、code、contenteditable 等），拆分和包装匹配的文本范围，标记 Salto 包装器使扫描幂等，确定性清理恢复文本不删除宿主监听器。

**Blocked by:** 14 — 纯匹配引擎

**Status:** ready-for-agent

- [ ] TreeWalker/NodeIterator：使用 TreeWalker 或 NodeIterator 遍历文本节点；永不重写页面 innerHTML
- [ ] 跳过交互元素：跳过 a、button、input、textarea、select、option、code、pre 和 contenteditable 祖先
- [ ] 跳过脚本和隐藏：跳过 script、style、hidden、disconnected 和扩展拥有的节点
- [ ] 跳过 Salto UI：不跳过 Salto 拥有的 UI 内的高亮
- [ ] 拆分和包装：仅拆分和包装每个文本节点中匹配的文本范围
- [ ] 标记 Salto 包装器：标记 Salto 包装器使扫描幂等
- [ ] 确定性清理：提供确定性清理，恢复文本而不删除宿主监听器
- [ ] DOM 测试：证明跳过的元素保持未触及
- [ ] 宿主监听器测试：证明宿主元素监听器在高亮和清理后存活
- [ ] 可见样式：一种可见的波浪下划线样式，不在 UI 其他地方仅依赖颜色表示保存状态
