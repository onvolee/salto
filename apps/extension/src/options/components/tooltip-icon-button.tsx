import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "salto-src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "salto-src/components/ui/tooltip";

type TooltipIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "size"
> & {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  label: string;
};

export function TooltipIconButton({
  icon,
  label,
  variant = "ghost",
  ...props
}: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            size="icon-sm"
            type="button"
            variant={variant}
            {...props}
          />
        }
      >
        <HugeiconsIcon aria-hidden="true" icon={icon} strokeWidth={2} />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
