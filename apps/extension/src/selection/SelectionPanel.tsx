import { Bookmark01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, type PointerEvent, type RefObject } from "react";

import { Button } from "salto-src/components/ui/button";

import { clampToViewport, getPanelSize, type Point } from "./positioning";
import type { ExtensionSuccessResponse, QueryFieldResult } from "@salto/core";

export type TranslationData = Extract<ExtensionSuccessResponse, { type: "translate-selection" }>["data"];
export type TranslationState =
  | { readonly status: "loading" }
  | { readonly status: "complete"; readonly data: TranslationData }
  | { readonly status: "request-error"; readonly message: string };

export type SelectionPanelProps = {
  panelRef: RefObject<HTMLElement | null>;
  position: Point;
  selectionText: string;
  saveState: "idle" | "saving" | "saved" | "error";
  translation: TranslationState;
  onClose: () => void;
  onPositionChange: (position: Point) => void;
  onSave: () => void;
};

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

function getViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function SelectionPanel({
  panelRef,
  position,
  selectionText,
  saveState,
  translation,
  onClose,
  onPositionChange,
  onSave,
}: SelectionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const saveLabel = saveState === "saving"
    ? "Saving selection"
    : saveState === "saved"
      ? "Selection saved"
      : "Save selection";

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, []);

  const handleHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) {
      return;
    }

    event.preventDefault();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleHeaderPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const viewport = getViewportSize();
    onPositionChange(
      clampToViewport(
        { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
        getPanelSize(viewport),
        viewport,
      ),
    );
  };

  const handleHeaderPointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const preserveSelection = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <section
      aria-label={`Selection panel for ${selectionText}`}
      className="salto-selection-panel"
      ref={panelRef}
      role="dialog"
      style={{ left: position.x, top: position.y }}
    >
      <header
        className="salto-selection-panel__header"
        data-testid="selection-panel-header"
        onPointerCancel={handleHeaderPointerEnd}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerEnd}
      >
        <span aria-hidden="true" className="salto-selection-panel__grip" />
        <div className="salto-selection-panel__actions">
          <Button
            aria-label={saveLabel}
            disabled={saveState === "saving" || saveState === "saved"}
            onClick={onSave}
            onPointerDown={preserveSelection}
            size="icon"
            title={saveLabel}
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={Bookmark01Icon} size={16} strokeWidth={1.8} />
          </Button>
          <Button
            aria-label="Close panel"
            onClick={onClose}
            onPointerDown={preserveSelection}
            ref={closeButtonRef}
            size="icon"
            title="Close panel"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </header>
      <div aria-live="polite" className="salto-selection-panel__content">
        {translation.status === "loading" ? (
          <p className="salto-selection-panel__status">Translating...</p>
        ) : translation.status === "request-error" ? (
          <p className="salto-selection-panel__status salto-selection-panel__status--error">
            {translation.message}
          </p>
        ) : (
          <TranslationResults data={translation.data} />
        )}
        {saveState === "error" ? (
          <p className="salto-selection-panel__save-error">Could not save selection</p>
        ) : saveState === "saving" ? (
          <p className="salto-selection-panel__status">Saving selection...</p>
        ) : null}
      </div>
    </section>
  );
}

function TranslationResults({ data }: { readonly data: TranslationData }) {
  const results = new Map(data.fields.map((result) => [result.fieldId, result]));
  return (
    <div className="salto-selection-panel__results">
      <h2>{data.templateName}</h2>
      <dl>
        {data.schema.map((field) => (
          <div className="salto-selection-panel__field" key={field.id}>
            <dt>{field.label}</dt>
            <dd>{renderFieldResult(results.get(field.id))}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function renderFieldResult(result: QueryFieldResult | undefined) {
  if (!result) {
    return <span className="salto-selection-panel__error">Missing field result</span>;
  }
  if (result.status === "failed") {
    return <span className="salto-selection-panel__error">{result.error.message}</span>;
  }
  if (result.status === "unavailable") {
    return <span className="salto-selection-panel__unavailable">Field unavailable</span>;
  }
  if (result.type === "list") {
    return <ul>{result.value.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  return result.value;
}
