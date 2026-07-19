import "salto-src/selection/selection-popup.css";

import { createRoot, type Root } from "react-dom/client";

import {
  createIncrementalHighlightScanner,
  type IncrementalHighlightScanner,
} from "salto-src/highlighting/incremental-highlighter";
import { browserMessageClient } from "salto-src/selection/message-client";
import { SelectionPopupApp } from "salto-src/selection/SelectionPopupApp";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    let highlightScanner: IncrementalHighlightScanner | undefined;
    let invalidated = false;
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
    void browserMessageClient.send({ type: "list-highlight-terms" }).then((highlightResponse) => {
      if (!invalidated && highlightResponse.ok && highlightResponse.type === "list-highlight-terms") {
        highlightScanner?.teardown();
        highlightScanner = createIncrementalHighlightScanner({
          document,
          terms: highlightResponse.data.terms,
        });
      }
    }).catch(() => {
      // The selection UI remains available if persisted highlights cannot be read.
    });
    ctx.onInvalidated(() => {
      invalidated = true;
      highlightScanner?.teardown();
      ui.remove();
    });
  },
});
