import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "salto-src/components/ui/button";
import { Spinner } from "salto-src/components/ui/spinner";

import type { SaveStatus } from "../types";

type SettingsActionsProps = {
  saveStatus: SaveStatus;
};

export function SettingsActions({
  saveStatus,
}: SettingsActionsProps) {
  const isSaving = saveStatus === "saving";

  return (
    <footer className="flex flex-wrap justify-end gap-2 py-5">
      <Button disabled={isSaving} type="submit">
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
