import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "salto-src/components/ui/badge";

import type { SaveStatus } from "../types";

const STATUS_CONTENT: Record<
  SaveStatus,
  { label: string; variant: "destructive" | "outline" | "secondary" }
> = {
  synced: { label: "已同步", variant: "outline" },
  dirty: { label: "有未保存更改", variant: "secondary" },
  saving: { label: "保存中", variant: "secondary" },
  saved: { label: "已保存", variant: "outline" },
  error: { label: "保存失败", variant: "destructive" },
};

type SettingsHeaderProps = {
  description: string;
  saveStatus: SaveStatus;
  title: string;
};

export function SettingsHeader({
  description,
  saveStatus,
  title,
}: SettingsHeaderProps) {
  const status = STATUS_CONTENT[saveStatus];
  const statusIcon =
    saveStatus === "synced" || saveStatus === "saved"
      ? CheckmarkCircle02Icon
      : InformationCircleIcon;

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">SALTO / 设置</p>
        <h1
          className="mt-1 text-xl font-semibold tracking-normal"
          data-od-id="settings-title"
        >
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Badge
        aria-live="polite"
        className="mt-1 shrink-0"
        role="status"
        variant={status.variant}
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={statusIcon}
          strokeWidth={2}
        />
        {status.label}
      </Badge>
    </header>
  );
}
