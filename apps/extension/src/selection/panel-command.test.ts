import { describe, expect, it, vi } from "vitest";

import {
  OPEN_SELECTION_PANEL_COMMAND,
  registerSelectionPanelCommand,
} from "./panel-command";

describe("selection panel command", () => {
  it("opens the active tab and ignores unrelated commands", async () => {
    let listener: ((command: string) => void) | undefined;
    const queryActiveTab = vi.fn().mockResolvedValue([{ id: 42 }]);
    const sendToTab = vi.fn().mockResolvedValue(undefined);

    registerSelectionPanelCommand({
      onCommand: { addListener: (nextListener) => { listener = nextListener; } },
      queryActiveTab,
      sendToTab,
    });

    listener?.("unrelated-command");
    expect(queryActiveTab).not.toHaveBeenCalled();

    listener?.(OPEN_SELECTION_PANEL_COMMAND);
    await vi.waitFor(() => expect(sendToTab).toHaveBeenCalledWith(42, {
      type: OPEN_SELECTION_PANEL_COMMAND,
    }));
  });

  it("stays silent when the tab has no content receiver", async () => {
    let listener: ((command: string) => void) | undefined;
    const sendToTab = vi.fn().mockRejectedValue(new Error("No receiver"));
    registerSelectionPanelCommand({
      onCommand: { addListener: (nextListener) => { listener = nextListener; } },
      queryActiveTab: vi.fn().mockResolvedValue([{ id: 7 }]),
      sendToTab,
    });

    listener?.(OPEN_SELECTION_PANEL_COMMAND);
    await vi.waitFor(() => expect(sendToTab).toHaveBeenCalledOnce());
  });
});
