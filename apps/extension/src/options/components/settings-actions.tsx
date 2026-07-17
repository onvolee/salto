import { FloppyDiskIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "salto-src/components/ui/button";
import { Spinner } from "salto-src/components/ui/spinner";

import type { SaveStatus } from "../types";

type SettingsActionsProps = {
  onReset: () => void;
  onSave: () => Promise<void>;
  saveStatus: SaveStatus;
};

export function SettingsActions({
  onReset,
  onSave,
  saveStatus,
}: SettingsActionsProps) {
  const isSaving = saveStatus === "saving";

  return (
    <footer className="flex flex-wrap justify-end gap-2 py-5">
      <Button onClick={onReset} type="button" variant="ghost">
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={RefreshIcon}
          strokeWidth={2}
        />
        恢复默认
      </Button>
      <Button disabled={isSaving} onClick={() => void onSave()} type="button">
        {isSaving ? (
          <Spinner aria-label="正在保存设置" data-icon="inline-start" />
        ) : (
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={FloppyDiskIcon}
            strokeWidth={2}
          />
        )}
        {isSaving ? "保存中" : "保存设置"}
      </Button>
    </footer>
  );
}
