import type { SelectionPath } from "@salto/core";

type PathSegment = {
  readonly tag: string;
  readonly index: number;
};

function getElementIndex(element: Element): number {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function getTextIndex(node: Node): number {
  let index = 1;
  let sibling = node.previousSibling;
  while (sibling) {
    if (sibling.nodeType === node.nodeType) {
      index += 1;
    }
    sibling = sibling.previousSibling;
  }
  return index;
}

function buildPathSegments(node: Node): PathSegment[] {
  const segments: PathSegment[] = [];
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const element = current as Element;
    segments.unshift({
      tag: element.tagName.toLowerCase(),
      index: getElementIndex(element)
    });
    current = element.parentElement;
  }

  return segments;
}

function segmentsToXPath(segments: readonly PathSegment[], textIndex?: number): string {
  const parts = segments.map((s) => `${s.tag}[${s.index}]`);
  if (textIndex !== undefined) {
    parts.push(`text()[${textIndex}]`);
  }
  return "/" + parts.join("/");
}

export function extractSelectionPath(range: Range): SelectionPath | null {
  try {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    if (startContainer !== endContainer) {
      return null;
    }

    const segments = buildPathSegments(startContainer);
    let xpath: string;

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textIndex = getTextIndex(startContainer);
      xpath = segmentsToXPath(segments, textIndex);
    } else {
      xpath = segmentsToXPath(segments);
    }

    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    if (startOffset < 0 || endOffset < startOffset) {
      return null;
    }

    return { xpath, startOffset, endOffset };
  } catch {
    return null;
  }
}

function parseXPathSegments(xpath: string): { segments: PathSegment[]; textIndex: number | null } {
  const parts = xpath.split("/").filter(Boolean);
  const segments: PathSegment[] = [];
  let textIndex: number | null = null;

  for (const part of parts) {
    const textMatch = part.match(/^text\(\)\[(\d+)\]$/);
    if (textMatch) {
      textIndex = parseInt(textMatch[1], 10);
      continue;
    }

    const elementMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (elementMatch) {
      segments.push({
        tag: elementMatch[1],
        index: parseInt(elementMatch[2], 10)
      });
    }
  }

  return { segments, textIndex };
}

function findNodeBySegments(
  document: Document,
  segments: readonly PathSegment[],
  textIndex: number | null
): Node | null {
  let current: Node = document.documentElement;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) {
      return null;
    }

    if (i === 0 && segment.tag === "html") {
      if ((current as Element).tagName.toLowerCase() !== "html") {
        return null;
      }
      if (getElementIndex(current as Element) !== segment.index) {
        return null;
      }
      continue;
    }

    const children = Array.from(current.childNodes).filter(
      (child) => child.nodeType === Node.ELEMENT_NODE
    );
    const elementChildren = children.filter(
      (child) => (child as Element).tagName.toLowerCase() === segment.tag
    );

    const target = elementChildren[segment.index - 1];
    if (!target) {
      return null;
    }
    current = target;
  }

  if (textIndex !== null) {
    const textChildren = Array.from(current.childNodes).filter(
      (child) => child.nodeType === Node.TEXT_NODE
    );
    return textChildren[textIndex - 1] ?? null;
  }

  return current;
}

export function findNodeByPath(document: Document, path: SelectionPath): {
  readonly node: Text;
  readonly startOffset: number;
  readonly endOffset: number;
} | null {
  try {
    const { segments, textIndex } = parseXPathSegments(path.xpath);
    const node = findNodeBySegments(document, segments, textIndex);

    if (!node || node.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    const textNode = node as Text;
    const textLength = textNode.length;

    if (path.startOffset > textLength || path.endOffset > textLength) {
      return null;
    }

    return {
      node: textNode,
      startOffset: path.startOffset,
      endOffset: path.endOffset
    };
  } catch {
    return null;
  }
}
