import {
  PROMPT_CONTEXT_LIMITS,
  normalizePromptContext,
  type PromptContext,
} from "@salto/core";

const BLOCK_SELECTOR = "p, li, blockquote";
const EXCLUDED_SELECTOR = [
  "nav",
  "footer",
  "aside",
  "script",
  "style",
  "template",
  "code",
  "pre",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "[hidden]",
  "[aria-hidden='true']",
  "[contenteditable]:not([contenteditable='false'])",
  "salto-selection-popup"
].join(",");

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function isInsideClosedDetails(element: Element): boolean {
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName !== "DETAILS" || ancestor.hasAttribute("open")) {
      continue;
    }
    const summary = Array.from(ancestor.children).find(({ tagName }) => tagName === "SUMMARY");
    if (!summary?.contains(element)) {
      return true;
    }
  }
  return false;
}

function hasHiddenStyle(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) {
    return false;
  }
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor);
    if (
      style.display === "none"
      || style.visibility === "hidden"
      || style.visibility === "collapse"
      || style.contentVisibility === "hidden"
      || style.opacity === "0"
    ) {
      return true;
    }
  }
  return false;
}

function isExcluded(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  return Boolean(
    element
    && (element.closest(EXCLUDED_SELECTOR) || isInsideClosedDetails(element) || hasHiddenStyle(element))
  );
}

function getSelectedBlock(range: Range): Element | null {
  const element = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element
    : range.startContainer.parentElement;
  const block = element?.closest(BLOCK_SELECTOR) ?? null;
  return block && !isExcluded(block) ? block : null;
}

function getSentence(block: Element | null, range: Range): string {
  if (!block || !block.contains(range.startContainer)) {
    return "";
  }

  const text = normalizeText(block.textContent ?? "");
  if (!text) {
    return "";
  }

  try {
    const prefix = document.createRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(range.startContainer, range.startOffset);
    const selectionOffset = normalizeText(prefix.toString()).length;
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    for (const segment of segmenter.segment(text)) {
      if (selectionOffset >= segment.index && selectionOffset < segment.index + segment.segment.length) {
        return normalizeText(segment.segment);
      }
    }
  } catch {
    return "";
  }

  return "";
}

function getTextBlocks(document: Document): readonly Element[] {
  return Array.from(document.querySelectorAll(BLOCK_SELECTOR)).filter((block) => {
    return !isExcluded(block) && normalizeText(block.textContent ?? "").length > 0;
  });
}

function getNearbyParagraphs(block: Element | null, blocks: readonly Element[]): string {
  if (!block) {
    return "";
  }
  const index = blocks.indexOf(block);
  if (index < 0) {
    return "";
  }
  return blocks
    .slice(Math.max(0, index - 1), index + 2)
    .map((candidate) => normalizeText(candidate.textContent ?? ""))
    .join("\n");
}

function getReadableBodyContent(document: Document, range: Range, selectedBlock: Element | null): {
  readonly text: string;
  readonly selectionOffset: number;
} {
  const root = document.querySelector("main, article") ?? document.body;
  if (!root) {
    return { text: "", selectionOffset: 0 };
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return !isExcluded(node) && normalizeText(node.textContent ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const chunks: string[] = [];
  let selectionOffset: number | null = null;
  let textLength = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const chunk = normalizeText(node.data);
    if (selectionOffset === null && node === range.startContainer) {
      selectionOffset = textLength + normalizeText(node.data.slice(0, range.startOffset)).length;
    } else if (selectionOffset === null && selectedBlock?.contains(node)) {
      selectionOffset = textLength;
    }
    chunks.push(chunk);
    textLength += chunk.length + 1;
  }
  return { text: normalizeText(chunks.join(" ")), selectionOffset: selectionOffset ?? 0 };
}

function cropAround(text: string, selectionOffset: number): string {
  if (text.length <= PROMPT_CONTEXT_LIMITS.webContent) {
    return text;
  }
  const idealStart = selectionOffset - Math.floor(PROMPT_CONTEXT_LIMITS.webContent / 2);
  const start = Math.min(Math.max(0, idealStart), text.length - PROMPT_CONTEXT_LIMITS.webContent);
  return text.slice(start, start + PROMPT_CONTEXT_LIMITS.webContent);
}

function getPageUrl(location: Location): string {
  try {
    const url = new URL(location.href);
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function extractPromptContext(range: Range, targetLanguage: string): PromptContext {
  const ownerDocument = range.startContainer.ownerDocument ?? document;
  const block = getSelectedBlock(range);
  const blocks = getTextBlocks(ownerDocument);
  const selection = range.toString().trim();
  const bodyContent = getReadableBodyContent(ownerDocument, range, block);
  const webContent = cropAround(bodyContent.text, bodyContent.selectionOffset);

  return normalizePromptContext({
    selection,
    sentence: getSentence(block, range),
    paragraphs: getNearbyParagraphs(block, blocks),
    targetLanguage,
    webTitle: normalizeText(ownerDocument.title),
    webUrl: getPageUrl(ownerDocument.location),
    webContent
  });
}
