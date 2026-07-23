import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "salto-src/components/ui/badge";

import type { SaveStatus } from "../types";

const SAVE_STATUS_CONTENT: Record<
  SaveStatus,
  { label: string; variant: "destructive" | "outline" | "secondary" | "success" }
> = {
  synced: { label: "已同步", variant: "success" },
  dirty: { label: "有未保存更改", variant: "secondary" },
  saving: { label: "保存中", variant: "secondary" },
  saved: { label: "已保存", variant: "success" },
  error: { label: "保存失败", variant: "destructive" },
};

export type StatusSummary =
  | { type: "save"; status: SaveStatus }
  | { type: "template"; name: string }
  | { type: "dictionary"; status: "idle" | "testing" | "success" | "error"; message?: string }
  | { type: "vocabulary"; failedCount: number }
  | { type: "ai"; configured: boolean; connectionStatus: "idle" | "testing" | "success" | "error"; message?: string };

type SettingsHeaderProps = {
  description: string;
  status: StatusSummary;
  title: string;
};

export function SettingsHeader({
  description,
  status,
  title,
}: SettingsHeaderProps) {
  function renderStatus() {
    switch (status.type) {
      case "save": {
        const statusConfig = SAVE_STATUS_CONTENT[status.status];
        const statusIcon =
          status.status === "synced" || status.status === "saved"
            ? CheckmarkCircle02Icon
            : InformationCircleIcon;
        return (
          <Badge aria-live="polite" role="status" variant={statusConfig.variant}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={statusIcon}
              strokeWidth={2}
            />
            {statusConfig.label}
          </Badge>
        );
      }
      case "template":
        return (
          <Badge aria-live="polite" role="status" variant="secondary">
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
            />
            当前：{status.name}
          </Badge>
        );
      case "dictionary": {
        const variant =
          status.status === "success"
            ? "success"
            : status.status === "error"
              ? "destructive"
              : "secondary";
        const icon =
          status.status === "success"
            ? CheckmarkCircle02Icon
            : status.status === "error"
              ? AlertCircleIcon
              : InformationCircleIcon;
        const label =
          status.status === "idle"
            ? "连接就绪"
            : status.status === "testing"
              ? "测试中"
              : status.message ?? "连接就绪";
        return (
          <Badge aria-live="polite" role="status" variant={variant}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={icon}
              strokeWidth={2}
            />
            {label}
          </Badge>
        );
      }
      case "vocabulary": {
        const variant = status.failedCount > 0 ? "destructive" : "success";
        const icon = status.failedCount > 0 ? AlertCircleIcon : CheckmarkCircle02Icon;
        const label =
          status.failedCount === 0
            ? "全部完成"
            : `${status.failedCount} 项失败`;
        return (
          <Badge aria-live="polite" role="status" variant={variant}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={icon}
              strokeWidth={2}
            />
            {label}
          </Badge>
        );
      }
      case "ai": {
        const variant =
          status.connectionStatus === "success"
            ? "success"
            : status.connectionStatus === "error"
              ? "destructive"
              : "secondary";
        const icon =
          status.connectionStatus === "success"
            ? CheckmarkCircle02Icon
            : status.connectionStatus === "error"
              ? AlertCircleIcon
              : InformationCircleIcon;
        const statusLabel =
          status.connectionStatus === "idle"
            ? status.configured
              ? "已配置"
              : "未配置"
            : status.connectionStatus === "testing"
              ? "测试中"
              : status.message ?? (status.configured ? "已配置" : "未配置");
        return (
          <Badge aria-live="polite" role="status" variant={variant}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={icon}
              strokeWidth={2}
            />
            {statusLabel}
          </Badge>
        );
      }
    }
  }

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
      <div className="mt-1 shrink-0">
        {renderStatus()}
      </div>
    </header>
  );
}
