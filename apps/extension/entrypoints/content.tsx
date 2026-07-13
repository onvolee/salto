import "salto-src/selection/selection-popup.css";

import { createRoot, type Root } from "react-dom/client";

import { SelectionPopupApp } from "salto-src/selection/SelectionPopupApp";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: "salto-selection-popup",
      position: "overlay",
      zIndex: 2_147_483_646,
      anchor: "body",
      isolateEvents: ["click", "pointerdown", "pointermove", "pointerup"],
      onMount(container) {
        const app = document.createElement("div");
        container.append(app);

        const root = createRoot(app);
        root.render(<SelectionPopupApp />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  },
});
