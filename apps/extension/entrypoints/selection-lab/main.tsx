import "salto-src/selection/selection-popup.css";
import "./style.css";

import { createRoot } from "react-dom/client";

import { SelectionPopupApp } from "salto-src/selection/SelectionPopupApp";

function SelectionLab() {
  return (
    <div className="salto-live-token-scope">
      <main className="selection-lab-shell">
        <section aria-labelledby="selection-lab-title" className="selection-lab-reader">
          <p className="selection-lab-kicker">Selection test page</p>
          <h1 id="selection-lab-title">Reading should not become a detour.</h1>
          <p>
            Select any unfamiliar word or short phrase in this paragraph. Salto should place a
            compact translation icon near the selected text, wait for an intentional click, and
            then open a nearby panel without clearing the reading context.
          </p>
          <p>
            The useful interaction is deliberately small: choose text, inspect the nearby panel,
            save the word if it matters, and return to the article. The floating controls should
            stay precise, legible, and quiet above arbitrary page content.
          </p>
          <blockquote>
            A vocabulary tool earns trust when it feels like a margin note, not a modal workflow.
          </blockquote>
        </section>
      </main>
      <SelectionPopupApp />
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Selection lab root is missing");
}

createRoot(rootElement).render(<SelectionLab />);
