# 02 — 模板字段库与字段快照编排

**What to build:** 在划词翻译设置中提供 Template fields 与 Templates 两个协同 tab。用户可管理可复用的模板字段定义，并从字段库向模板添加独立字段快照；模板页只管理快照的选择、启用状态和顺序。

**Blocked by:** 01 — 模板字段定义与快照模型迁移.

Status: ready-for-agent

- [ ] `#/translate-template` 默认显示 Templates，`#/translate-template/fields` 显示 Template fields，两个 tab 均能在刷新后恢复正确视图。
- [ ] 字段库可创建、编辑和确认删除 LLM、词典两类定义；定义有可选描述且不提供排序，删除不会影响既有模板快照。
- [ ] 模板可从字段库选择同一个定义多次，每次创建独立的结果标识、启用状态和顺序。
- [ ] 模板字段快照可拖拽排序、启用或禁用；任何模板均不能保存为零个启用字段，系统默认模板保持只读。
