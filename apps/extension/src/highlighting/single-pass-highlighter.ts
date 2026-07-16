const SKIP_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "code",
  "pre",
  "script",
  "style",
  "[hidden]",
  "[aria-hidden='true']",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-salto-highlight]",
  "salto-selection-popup"
].join(",");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSkippable(node: Node): boolean {
  return Boolean(node.parentElement?.closest(SKIP_SELECTOR));
}

export function highlightSavedTerms(document: Document, inputTerms: readonly string[]): number {
  const terms = [...new Set(inputTerms.map((term) => term.trim()).filter(Boolean))]
    .toSorted((left, right) => right.length - left.length);
  if (!terms.length || !document.body) {
    return 0;
  }

  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${terms.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return !isSkippable(node) && node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let count = 0;
  for (const textNode of textNodes) {
    const text = textNode.data;
    const matches = Array.from(text.matchAll(pattern));
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      if (!match || match.index === undefined) continue;
      const range = document.createRange();
      range.setStart(textNode, match.index);
      range.setEnd(textNode, match.index + match[0].length);
      const mark = document.createElement("span");
      mark.dataset.saltoHighlight = match[0].toLocaleLowerCase("en-US");
      mark.className = "salto-saved-term";
      mark.style.textDecorationLine = "underline";
      mark.style.textDecorationStyle = "wavy";
      mark.style.textDecorationThickness = "1px";
      mark.style.textUnderlineOffset = "2px";
      range.surroundContents(mark);
      count += 1;
    }
  }
  return count;
}
