# 18 — 键盘快捷键和无障碍

Status: ready-for-agent

Blocked by: 06 — 模板字段编辑和排序, 08 — 扩展设置持久化, 09 — 活动模板读取和翻译面板集成, 17 — 保存后高亮集成

## Outcome

为当前 options/sidebar、translation panel 和 save/retry flows 建立键盘与 WCAG AA 验收；清单中的命令、焦点管理、图标名称、错误关联和窄视口行为都可验证。

## Frozen decisions

- panel 打开后焦点进入 close control，关闭后恢复到触发 panel 的元素；options 使用 sidebar 当前 focus model。
- 每个 icon-only button 有 accessible name；只有不熟悉的图标才额外提供 tooltip，tooltip 不能替代 accessible name。
- 状态必须同时有文本、图标、ARIA 或结构差异，不能只用颜色；`aria-live` 只读出真正变化的状态。
- 尊重 `prefers-reduced-motion`；不使用会导致内容重叠的移动动画。
- 验收矩阵覆盖 light/dark/system、100%/200% zoom、窄 viewport、keyboard-only 和 screen-reader 语义检查。

## Scope

- manifest keyboard command 注册和 handler 到 panel open 的连接。
- options template select/save/edit/reorder、panel close/regenerate/save、field error/retry 的 tab order/focus/error association。
- 对比度检查矩阵：正文/secondary text、按钮、focus ring、destructive/error、highlight treatment 在三种 theme 下达到 WCAG AA；大字按对应阈值。

## Non-goals

- 不新增产品功能或重新设计 sidebar/panel；不改变 09 的“settings 选择、panel 只读取”语义。
- 不把自动化扫描声称为完整 screen-reader certification。

## Acceptance criteria

- [ ] keyboard-only 可完成 template 选择并 Save、field reorder、panel regenerate、save、close 和错误恢复。
- [ ] focus 不逃出 viewport；panel close 后 focus 恢复，动态状态不会夺走用户 focus。
- [ ] 所有 icon control 有稳定 accessible name，表单错误与控件关联。
- [ ] light/dark/system、200% zoom、窄 viewport 下文本不重叠、不被裁切、不逃出控件。
- [ ] 对比度与 non-color status matrix 有自动或可复现的验证证据。

## Verification

- options/selection accessibility tests 覆盖 labels、focus order、keyboard reorder、error association、dialog confirmation 和 panel focus restore。
- 用 axe 或等价工具及手动键盘矩阵检查三个 theme 和两个 viewport/zoom 档位；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- 无障碍验收结果和已知限制已记录，21 可以直接引用矩阵证据。

## Rollback boundary

回滚视觉改动不得移除 accessible names、focus restoration、keyboard commands 或错误文本。
