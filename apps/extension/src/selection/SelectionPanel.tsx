import {
  Bookmark01Icon,
  Cancel01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { Button } from "salto-src/components/ui/button";

import { clampToViewport, getPanelSize, type Point } from "./positioning";
import type {
  ActiveQueryTemplateResolution,
  ExtensionSuccessResponse,
  QueryFieldResult,
  QueryTemplate,
} from "@salto/core";

export type TranslationData = Extract<ExtensionSuccessResponse, { type: "translate-selection" }>["data"];
export type TranslationState =
  | { readonly status: "loading" }
  | { readonly status: "complete"; readonly data: TranslationData }
  | { readonly status: "request-error"; readonly message: string };

export type ActiveTemplateState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly template: QueryTemplate;
      readonly resolution: ActiveQueryTemplateResolution;
    };

export type SelectionPanelProps = {
  activeTemplate: ActiveTemplateState;
  panelRef: RefObject<HTMLElement | null>;
  position: Point;
  selectionText: string;
  saveState: "idle" | "saving" | "saved" | "error";
  translation: TranslationState;
  onClose: () => void;
  onPositionChange: (position: Point) => void;
  onRegenerate: () => void;
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
  activeTemplate,
  panelRef,
  position,
  selectionText,
  saveState,
  translation,
  onClose,
  onPositionChange,
  onRegenerate,
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
        {activeTemplate.status === "ready" ? (
          <h2 className="salto-selection-panel__title" title={activeTemplate.template.name}>
            {activeTemplate.template.name}
          </h2>
        ) : (
          <span className="salto-selection-panel__title">
            {activeTemplate.status === "loading" ? "Loading template..." : "Template unavailable"}
          </span>
        )}
        <div className="salto-selection-panel__actions">
          <Button
            aria-label="Regenerate translation"
            disabled={activeTemplate.status !== "ready"}
            onClick={onRegenerate}
            onPointerDown={preserveSelection}
            size="icon"
            title="Regenerate translation"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
          </Button>
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
        {activeTemplate.status === "loading" ? (
          <p className="salto-selection-panel__status">Loading active template...</p>
        ) : activeTemplate.status === "error" ? (
          <p className="salto-selection-panel__status salto-selection-panel__status--error">
            {activeTemplate.message}
          </p>
        ) : (
          <>
            {activeTemplate.resolution.status === "recovered" ? (
              <p
                className="salto-selection-panel__recovery"
                data-code={activeTemplate.resolution.code}
              >
                The active template was unavailable. Using {activeTemplate.template.name}.
              </p>
            ) : null}
            <TranslationResults
              template={activeTemplate.template}
              translation={translation}
            />
          </>
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

function TranslationResults({
  template,
  translation,
}: {
  readonly template: QueryTemplate;
  readonly translation: TranslationState;
}) {
  const schema = template.fields
    .filter((field) => field.enabled)
    .toSorted((left, right) => left.order - right.order)
    .map(({ id, label }) => ({ id, label }));
  if (translation.status === "loading") {
    return <TranslationFields schema={schema} renderResult={() => (
      <span className="salto-selection-panel__loading-field">Loading field...</span>
    )} />;
  }
  if (translation.status === "request-error") {
    return (
      <>
        <p className="salto-selection-panel__status salto-selection-panel__status--error">
          {translation.message}
        </p>
        <TranslationFields schema={schema} renderResult={() => (
          <span className="salto-selection-panel__error">Translation unavailable</span>
        )} />
      </>
    );
  }

  const data = translation.data;
  const results = new Map(data.fields.map((result) => [result.fieldId, result]));
  if (data.schema.length === 0) {
    return <p className="salto-selection-panel__status">No results</p>;
  }
  return <TranslationFields
    schema={data.schema}
    renderResult={(fieldId) => renderFieldResult(results.get(fieldId))}
  />;
}

function TranslationFields({
  schema,
  renderResult,
}: {
  readonly schema: readonly { readonly id: string; readonly label: string }[];
  readonly renderResult: (fieldId: string) => ReactNode;
}) {
  return (
    <div className="salto-selection-panel__results">
      <dl>
        {schema.map((field) => (
          <div className="salto-selection-panel__field" key={field.id}>
            <dt>{field.label}</dt>
            <dd>{renderResult(field.id)}</dd>
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
