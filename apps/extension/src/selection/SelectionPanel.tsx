import {
  Bookmark01Icon,
  Cancel01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

import { Button } from "salto-src/components/ui/button";
import { ScrollArea } from "salto-src/components/ui/scroll-area";
import { Skeleton } from "salto-src/components/ui/skeleton";
import { parseCssDeclarations } from "salto-src/query-template/css-declarations";
import {
  TranslationFieldList,
  TranslationFieldValue,
} from "salto-src/query-template/translation-field-list";

import {
  clampAutoFitSize,
  clampResizeSize,
  clampToViewport,
  PANEL_AUTO_FIT_MAX_SIZE,
  type Point,
  type Size,
} from "./positioning";
import type {
  ActiveQueryTemplateResolution,
  ExtensionSuccessResponse,
  QueryFieldResult,
  QueryTemplate,
} from "@salto/core";
import { templateFieldSupportsCustomCss } from "@salto/core";

export type TranslationData = Extract<
  ExtensionSuccessResponse,
  { type: "translate-selection" }
>["data"];
export type TranslationState =
  | { readonly status: "loading" }
  | {
      readonly status: "streaming";
      readonly templateId: string;
      readonly templateName: string;
      readonly schema: readonly {
        readonly id: string;
        readonly label: string;
      }[];
      readonly fields: readonly QueryFieldResult[];
    }
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
  size?: Size;
  selectionText: string;
  saveState: "idle" | "saving" | "saved" | "error";
  translation: TranslationState;
  onClose: () => void;
  onPositionChange: (position: Point) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onSizeChange?: (size: Size) => void;
};

export type PanelResizePhase = "locked" | "animating" | "manual";

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type ResizeHandle = "right" | "bottom" | "bottom-right";

type ResizeState = {
  pointerId: number;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

function getViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

const DEFAULT_PANEL_SIZE = { width: 360, height: 220 };
const AUTO_FIT_TRANSITION_MS = 180;
const AUTO_FIT_TRANSITION_FALLBACK_MS = AUTO_FIT_TRANSITION_MS + 70;

export function SelectionPanel({
  activeTemplate,
  panelRef,
  position,
  size = DEFAULT_PANEL_SIZE,
  selectionText,
  saveState,
  translation,
  onClose,
  onPositionChange,
  onRegenerate,
  onSave,
  onSizeChange,
}: SelectionPanelProps) {
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const lastAutoFitDataRef = useRef<TranslationData | null>(null);
  const pendingAutoFitTransitionsRef = useRef(new Set<"width" | "height">());
  const [resizePhase, setResizePhase] = useState<PanelResizePhase>("locked");
  const saveLabel =
    saveState === "saving"
      ? "Saving selection"
      : saveState === "saved"
        ? "Selection saved"
        : "Save selection";
  const effectiveResizePhase = translation.status === "complete" ? resizePhase : "locked";
  const canResize = effectiveResizePhase === "manual";

  useLayoutEffect(() => {
    if (
      translation.status !== "complete"
      || lastAutoFitDataRef.current === translation.data
    ) {
      return;
    }
    lastAutoFitDataRef.current = translation.data;

    if (!onSizeChange) {
      setResizePhase("manual");
      return;
    }

    const panel = panelRef.current;
    const scrollViewport = panel?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const content = panel?.querySelector<HTMLElement>(".salto-selection-panel__content");
    if (!panel || !scrollViewport || !content) {
      setResizePhase("manual");
      return;
    }

    const viewport = getViewportSize();
    const maximumSize = clampAutoFitSize(
      PANEL_AUTO_FIT_MAX_SIZE,
      size,
      viewport,
      position,
    );
    const horizontalChrome = Math.max(0, panel.offsetWidth - scrollViewport.clientWidth);
    const verticalChrome = Math.max(0, panel.offsetHeight - scrollViewport.clientHeight);
    const previousWidth = content.style.width;
    const previousMaxWidth = content.style.maxWidth;

    content.style.width = "max-content";
    content.style.maxWidth = `${Math.max(0, maximumSize.width - horizontalChrome)}px`;
    const naturalContentWidth = Math.ceil(Math.max(
      content.scrollWidth,
      content.getBoundingClientRect().width,
    ));
    const targetWidth = clampAutoFitSize(
      { width: naturalContentWidth + horizontalChrome, height: size.height },
      size,
      viewport,
      position,
    ).width;

    content.style.width = `${Math.max(0, targetWidth - horizontalChrome)}px`;
    const contentHeight = Math.ceil(Math.max(
      content.scrollHeight,
      content.getBoundingClientRect().height,
    ));
    content.style.width = previousWidth;
    content.style.maxWidth = previousMaxWidth;

    const nextSize = clampAutoFitSize(
      { width: naturalContentWidth + horizontalChrome, height: contentHeight + verticalChrome },
      size,
      viewport,
      position,
    );
    const pending = new Set<"width" | "height">();
    if (nextSize.width !== size.width) pending.add("width");
    if (nextSize.height !== size.height) pending.add("height");
    pendingAutoFitTransitionsRef.current = pending;
    onSizeChange(nextSize);

    const reduceMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setResizePhase(pending.size > 0 && !reduceMotion ? "animating" : "manual");
  }, [onSizeChange, panelRef, position, size, translation]);

  useEffect(() => {
    if (translation.status !== "complete") {
      pendingAutoFitTransitionsRef.current.clear();
      setResizePhase("locked");
    }
  }, [translation.status]);

  useEffect(() => {
    if (resizePhase !== "animating") return;
    const timeout = window.setTimeout(() => {
      pendingAutoFitTransitionsRef.current.clear();
      setResizePhase("manual");
    }, AUTO_FIT_TRANSITION_FALLBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [resizePhase]);

  const finishAutoFitTransition = (property: "width" | "height") => {
    pendingAutoFitTransitionsRef.current.delete(property);
    if (pendingAutoFitTransitionsRef.current.size === 0) {
      setResizePhase("manual");
    }
  };

  const handleHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as Element).closest("button")
    ) {
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
        size,
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

  const handleResizePointerDown = (event: PointerEvent<HTMLElement>, handle: ResizeHandle) => {
    if (!canResize || !event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    resizeRef.current = {
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    const viewport = getViewportSize();
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;

    let newWidth = resize.startWidth;
    let newHeight = resize.startHeight;

    if (resize.handle === "right" || resize.handle === "bottom-right") {
      newWidth = resize.startWidth + deltaX;
    }
    if (resize.handle === "bottom" || resize.handle === "bottom-right") {
      newHeight = resize.startHeight + deltaY;
    }

    const newSize = clampResizeSize(
      { width: newWidth, height: newHeight },
      viewport,
      position,
    );
    onSizeChange?.(newSize);
  };

  const handleResizePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }

    resizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const preserveSelection = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const containKeyboardFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ),
    ];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !controls.includes(target)) return;

    if (event.shiftKey && target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && target === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const announcement = getPanelAnnouncement(
    activeTemplate,
    translation,
    saveState,
  );

  return (
    <section
      aria-label={`Selection panel for ${selectionText}`}
      className="salto-selection-panel"
      data-resize-phase={effectiveResizePhase}
      ref={panelRef}
      role="dialog"
      onKeyDown={containKeyboardFocus}
      onTransitionEnd={(event) => {
        if (
          effectiveResizePhase === "animating"
          && event.target === event.currentTarget
          && (event.propertyName === "width" || event.propertyName === "height")
        ) {
          finishAutoFitTransition(event.propertyName);
        }
      }}
      onWheel={(e) => {
        e.stopPropagation();
      }}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        "--salto-panel-auto-fit-duration": `${AUTO_FIT_TRANSITION_MS}ms`,
      } as CSSProperties}
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
          <h2
            className="salto-selection-panel__title"
            title={activeTemplate.template.name}
          >
            {activeTemplate.template.name}
          </h2>
        ) : (
          <span className="salto-selection-panel__title">
            {activeTemplate.status === "loading"
              ? "Loading template..."
              : "Template unavailable"}
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
            <HugeiconsIcon
              aria-hidden="true"
              icon={RefreshIcon}
              size={16}
              strokeWidth={1.8}
            />
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
            <HugeiconsIcon
              aria-hidden="true"
              icon={Bookmark01Icon}
              size={16}
              strokeWidth={1.8}
            />
          </Button>
          <Button
            aria-label="Close panel"
            onClick={onClose}
            onPointerDown={preserveSelection}
            size="icon"
            title="Close panel"
            variant="ghost"
            type="button"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Cancel01Icon}
              size={16}
              strokeWidth={1.8}
            />
          </Button>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="salto-selection-panel__resize-handle salto-selection-panel__resize-handle--right"
        data-disabled={!canResize}
        onPointerDown={(e) => handleResizePointerDown(e, "right")}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
      />
      <div
        aria-hidden="true"
        className="salto-selection-panel__resize-handle salto-selection-panel__resize-handle--bottom"
        data-disabled={!canResize}
        onPointerDown={(e) => handleResizePointerDown(e, "bottom")}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
      />
      <div
        aria-hidden="true"
        className="salto-selection-panel__resize-handle salto-selection-panel__resize-handle--bottom-right"
        data-disabled={!canResize}
        onPointerDown={(e) => handleResizePointerDown(e, "bottom-right")}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
      />
      <p
        aria-atomic="true"
        aria-live="polite"
        className="salto-visually-hidden"
      >
        {announcement}
      </p>
      <ScrollArea className="min-h-0 flex-1">
        <div className="salto-selection-panel__content">
          {activeTemplate.status === "loading" ? (
            <p className="salto-selection-panel__status">
              Loading active template...
            </p>
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
                  The active template was unavailable. Using{" "}
                  {activeTemplate.template.name}.
                </p>
              ) : null}
              <TranslationResults
                template={activeTemplate.template}
                translation={translation}
              />
            </>
          )}
          {saveState === "error" ? (
            <p className="salto-selection-panel__save-error">
              Could not save selection
            </p>
          ) : saveState === "saving" ? (
            <p className="salto-selection-panel__status">Saving selection...</p>
          ) : null}
        </div>
      </ScrollArea>
    </section>
  );
}

function getPanelAnnouncement(
  activeTemplate: ActiveTemplateState,
  translation: TranslationState,
  saveState: SelectionPanelProps["saveState"],
): string {
  if (saveState === "error") return "Could not save selection";
  if (saveState === "saved") return "Selection saved";
  if (activeTemplate.status === "error")
    return `Template unavailable: ${activeTemplate.message}`;
  if (translation.status === "request-error")
    return `Translation unavailable: ${translation.message}`;
  if (translation.status === "complete") return "Translation ready";
  return "";
}

function TranslationResults({
  template,
  translation,
}: {
  readonly template: QueryTemplate;
  readonly translation: TranslationState;
}) {
  const fieldStyles = useMemo(() => new Map(template.fields
    .filter((field) => templateFieldSupportsCustomCss(field.content))
    .map((field) => [
      field.id,
      {
        key: parseCssDeclarations(field.keyCss ?? ""),
        value: parseCssDeclarations(field.valueCss ?? ""),
      },
    ])), [template.fields]);
  const schema = template.fields
    .filter((field) => field.enabled)
    .toSorted((left, right) => left.order - right.order)
    .map(({ id, content }) => ({ id, label: content.label }));
  if (translation.status === "loading") {
    return (
      <TranslationFieldList
        fieldStyles={fieldStyles}
        schema={schema}
        renderValue={() => (
          <Skeleton className="salto-selection-panel__loading-field"></Skeleton>
        )}
      />
    );
  }
  if (translation.status === "request-error") {
    return (
      <>
        <p className="salto-selection-panel__status salto-selection-panel__status--error">
          {translation.message}
        </p>
        <TranslationFieldList
          fieldStyles={fieldStyles}
          schema={schema}
          renderValue={() => (
            <span className="salto-selection-panel__error">
              Translation unavailable
            </span>
          )}
        />
      </>
    );
  }

  const data =
    translation.status === "streaming"
      ? { schema: translation.schema, fields: translation.fields }
      : translation.data;
  const results = new Map(
    data.fields.map((result) => [result.fieldId, result]),
  );
  if (data.schema.length === 0) {
    return <p className="salto-selection-panel__status">No results</p>;
  }
  return (
    <TranslationFieldList
      fieldStyles={fieldStyles}
      schema={data.schema}
      renderValue={(fieldId, valueStyle) =>
        renderFieldResult(
          results.get(fieldId),
          translation.status === "streaming",
          valueStyle,
        )
      }
    />
  );
}

function renderFieldResult(
  result: QueryFieldResult | undefined,
  isStreaming: boolean = false,
  valueStyle?: CSSProperties,
) {
  if (!result) {
    return isStreaming ? (
      <Skeleton className="salto-selection-panel__loading-field"></Skeleton>
    ) : (
      <span className="salto-selection-panel__error">Missing field result</span>
    );
  }
  if (result.status === "failed") {
    return (
      <span className="salto-selection-panel__error">
        {result.error.message}
      </span>
    );
  }
  if (result.status === "unavailable") {
    return (
      <span className="salto-selection-panel__unavailable">
        Field unavailable
      </span>
    );
  }
  return <TranslationFieldValue style={valueStyle} value={result.value} />;
}
