import { TranslateIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PointerEventHandler } from "react";

import { Button } from "salto-src/components/ui/button";

import type { Point } from "./positioning";

type FloatingTriggerProps = {
  position: Point;
  onOpen: () => void;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
};

export function FloatingTrigger({ position, onOpen, onPointerDown }: FloatingTriggerProps) {
  return (
    <Button
      aria-label="Open selection panel"
      className="salto-selection-trigger"
      onClick={onOpen}
      onPointerDown={onPointerDown}
      size="icon-lg"
      style={{ left: position.x, top: position.y }}
      title="Open selection panel"
      type="button"
    >
      <HugeiconsIcon icon={TranslateIcon} size={16} strokeWidth={1.8} />
    </Button>
  );
}
