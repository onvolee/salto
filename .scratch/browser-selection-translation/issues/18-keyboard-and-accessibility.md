# 18 — 键盘快捷键和无障碍

Status: ready-for-human

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

- [x] keyboard-only 可完成 template 选择并 Save、field reorder、panel regenerate、save、close 和错误恢复。
- [x] focus 不逃出 viewport；panel close 后 focus 恢复，动态状态不会夺走用户 focus。
- [x] 所有 icon control 有稳定 accessible name，表单错误与控件关联。
- [x] light/dark/system、200% zoom、窄 viewport 下文本不重叠、不被裁切、不逃出控件。
- [x] 对比度与 non-color status matrix 有自动或可复现的验证证据。

## Verification

- options/selection accessibility tests 覆盖 labels、focus order、keyboard reorder、error association、dialog confirmation 和 panel focus restore。
- 用 axe 或等价工具及手动键盘矩阵检查三个 theme 和两个 viewport/zoom 档位；运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。

## Exit criteria

- 无障碍验收结果和已知限制已记录，21 可以直接引用矩阵证据。

## Rollback boundary

回滚视觉改动不得移除 accessible names、focus restoration、keyboard commands 或错误文本。

## Comments

### 2026-07-20 — implementation evidence

- Manifest 注册 `open-selection-panel`：Windows/Linux `Alt+Shift+S`，macOS `MacCtrl+Shift+S`。background 查询当前活动 tab 并向 content script 发消息；无有效 selection、无 tab ID、受限页或无 receiver 均静默结束。
- Panel 打开聚焦 Close；Tab/Shift+Tab 保持在 panel controls 内；Close/Escape 返回并聚焦 floating trigger，同时保留 selection；普通外部点击继续清理 selection 和临时 UI。Tab loop 与 focus restore 另有 `attachShadow` + `createRoot` 测试，避免以 light DOM 的 `document.activeElement` 误证；Regenerate、save、save retry、close 和 options template select/reorder/save 均有键盘事件测试。
- Panel 使用单个精简 `aria-live` announcer，不再播报整个结果区域；状态更新不移动焦点。Panel icon-only controls 有稳定 `aria-label`，装饰 icon 隐藏；template name/type/instruction/dictionary 与 AI 配置错误均关联到对应 control。
- `accessibility-contract.test.ts` 从实际 theme CSS token 计算 light/dark 正文、secondary、primary、destructive、success 的 4.5:1 和 focus ring 的 3:1 阈值，并验证 system dark 使用同一组审计 token。修正 light primary 与 dark destructive token 后通过。状态均有文本或结构信息，不依赖颜色；窄 effective viewport 的 panel size/position 有自动测试。
- reduced-motion 产物包含 `.motion-reduce\:animate-none`，selection trigger transition 也在 `prefers-reduced-motion: reduce` 下关闭。

Verification passed:

- `pnpm --filter @salto/extension exec vitest run src/selection/panel-command.test.ts src/selection/SelectionPopupApp.test.tsx src/selection/local-slice.integration.test.tsx src/selection/positioning.test.ts src/options/sections/selection-section.test.tsx src/options/OptionsApp.test.tsx src/options/sections/sources-section.test.tsx src/theme/accessibility-contract.test.ts` — 8 files, 53 tests.
- Shadow DOM blocker follow-up: `pnpm --filter @salto/extension exec vitest run src/selection/SelectionPanel.shadow-dom.test.tsx src/selection/SelectionPopupApp.test.tsx` — 2 files, 28 tests; covers Tab loop and focus restore through `attachShadow` + `createRoot`.
- `pnpm --filter @salto/extension typecheck`.
- `pnpm --filter @salto/extension build`; generated Chrome MV3 manifest contains the expected command and suggested keys.
- `git diff --check`.

Residual human checks: press the physical browser-level shortcut on a normal and restricted page, and perform a calibrated screen-reader pass for dialog name, concise status/error announcements, and error descriptions. Automated checks and accessibility-tree inspection are not screen-reader certification.

### 2026-07-20 — Chromium acceptance

- Loaded the exact production output in Chrome for Testing with an isolated profile. `chrome://extensions/shortcuts` showed the macOS command as `Control+Shift+S`; the manifest and background-to-content route remain covered by focused tests because CDP key injection does not pass through Chrome's browser-level accelerator handling.
- On a real page-mounted Shadow DOM, opening the panel focused Close. Tab from Close wrapped to Regenerate, Shift+Tab wrapped back to Close, and Escape restored focus to the floating trigger while preserving the selection.
- At a 360 by 320 viewport with the root text size at 200%, the panel stayed inside the viewport (8 px inset, no horizontal overflow); only its content region scrolled vertically. The options page had no horizontal document overflow or interactive control outside the viewport.
- Light and dark options themes rendered their audited token sets, while system mode followed emulated dark preference. With reduced motion enabled, the floating trigger's computed transition duration was `0s`.
