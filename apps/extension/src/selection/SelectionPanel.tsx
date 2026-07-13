import { Bookmark01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, type PointerEvent, type RefObject } from "react";

import { Button } from "salto-src/components/ui/button";

import { clampToViewport, getPanelSize, type Point } from "./positioning";

type SelectionPanelProps = {
  panelRef: RefObject<HTMLElement | null>;
  position: Point;
  selectionText: string;
  onClose: () => void;
  onPositionChange: (position: Point) => void;
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
  onClose,
  onPositionChange,
}: SelectionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);

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
            aria-disabled="true"
            aria-label="Save selection"
            onPointerDown={preserveSelection}
            size="icon"
            title="Save selection (not available yet)"
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
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </header>
      <div aria-hidden="true" className="salto-selection-panel__content" />
    </section>
  );
}
