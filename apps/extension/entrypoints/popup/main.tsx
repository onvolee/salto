import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { useThemeMode } from "salto-src/theme/use-theme-mode";

import "./style.css";

function PopupApp() {
  const themeMode = useThemeMode();

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    root.dataset.theme = themeMode;

    return () => {
      if (previousTheme) {
        root.dataset.theme = previousTheme;
      } else {
        delete root.dataset.theme;
      }
    };
  }, [themeMode]);

  const openSettings = async () => {
    await browser.tabs.create({ url: browser.runtime.getURL("/setting.html") });
  };

  return (
    <main className="popup salto-theme-scope" data-od-id="salto-popup" data-theme={themeMode}>
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
