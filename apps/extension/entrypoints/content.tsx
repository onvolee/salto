import "salto-src/selection/selection-popup.css";

import { createRoot, type Root } from "react-dom/client";

import { createHighlightSession } from "salto-src/highlighting/highlight-session";
import { browserMessageClient } from "salto-src/selection/message-client";
import { SelectionPopupApp } from "salto-src/selection/SelectionPopupApp";
import { isExtensionNotification } from "@salto/core";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  async main(ctx) {
    const highlightSession = createHighlightSession({
      document,
      async loadSnapshot() {
        const response = await browserMessageClient.send({ type: "list-highlight-terms" });
        if (!response.ok || response.type !== "list-highlight-terms") {
          throw new Error("Highlight snapshot unavailable");
        }
        return { enabled: response.data.enabled, terms: response.data.terms };
      },
      subscribeSettings(listener) {
        const handleMessage = (message: unknown) => {
          if (isExtensionNotification(message) && message.type === "extension-settings-changed") {
            listener(message.payload);
          }
        };
        browser.runtime.onMessage.addListener(handleMessage);
        return () => browser.runtime.onMessage.removeListener(handleMessage);
      },
    });
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
        root.render(<SelectionPopupApp onSaveSuccess={(term) => highlightSession.addSavedTerm(term)} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
    highlightSession.start();
    ctx.onInvalidated(() => {
      highlightSession.teardown();
      ui.remove();
    });
  },
});
