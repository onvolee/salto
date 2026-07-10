import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { OptionsApp } from "../../src/options/OptionsApp";
import "./style.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>
  );
}
