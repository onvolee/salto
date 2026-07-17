import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { OptionsApp } from "salto-src/options/OptionsApp";

import "./style.css";

if (import.meta.env.DEV) {
  import("react-grab");
}

export default { openInTab: true };

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>,
  );
}
