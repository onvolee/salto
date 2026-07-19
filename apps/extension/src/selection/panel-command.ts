export const OPEN_SELECTION_PANEL_COMMAND = "open-selection-panel";

export type OpenSelectionPanelMessage = {
  readonly type: typeof OPEN_SELECTION_PANEL_COMMAND;
};

export function isOpenSelectionPanelMessage(
  message: unknown,
): message is OpenSelectionPanelMessage {
  return Boolean(
    message
      && typeof message === "object"
      && "type" in message
      && message.type === OPEN_SELECTION_PANEL_COMMAND,
  );
}

type PanelCommandBrowser = {
  readonly onCommand: {
    addListener(listener: (command: string) => void): void;
  };
  queryActiveTab(): Promise<readonly { readonly id?: number }[]>;
  sendToTab(tabId: number, message: OpenSelectionPanelMessage): Promise<unknown>;
};

export function registerSelectionPanelCommand(browserBoundary: PanelCommandBrowser): void {
  browserBoundary.onCommand.addListener((command) => {
    if (command !== OPEN_SELECTION_PANEL_COMMAND) return;

    void browserBoundary.queryActiveTab().then((tabs) => {
      const tabId = tabs[0]?.id;
      if (typeof tabId !== "number") return;
      return browserBoundary.sendToTab(tabId, { type: OPEN_SELECTION_PANEL_COMMAND });
    }).catch(() => undefined);
  });
}
