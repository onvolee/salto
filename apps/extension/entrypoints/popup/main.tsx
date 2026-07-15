import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import "./style.css";

function PopupApp() {
  const openSettings = async () => {
    await browser.runtime.openOptionsPage();
  };

  return (
    <main className="popup" data-od-id="salto-popup">
      <section className="popup-main" data-od-id="popup-main" aria-label="Salto Popup" />
      <footer className="popup-footer" data-od-id="popup-footer">
        <button
          aria-label="打开设置"
          className="settings-button"
          data-od-id="open-settings"
          onClick={() => void openSettings()}
          title="打开设置"
          type="button"
        >
          <HugeiconsIcon aria-hidden="true" icon={Settings01Icon} size={17} strokeWidth={1.8} />
        </button>
      </footer>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>,
  );
}
