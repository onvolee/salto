import type { ExtensionResponse } from "@salto/core";

import type { BackgroundServices } from "./background-services";

type SendResponse = (response: ExtensionResponse) => void;
type MessageSender = { readonly url?: string; readonly tab?: unknown };

export function createRuntimeMessageListener(
  services: Pick<BackgroundServices, "handleMessage">,
  extensionRoot = "",
) {
  return (message: unknown, sender: MessageSender, sendResponse: SendResponse): true => {
    const source = extensionRoot && sender.url?.startsWith(extensionRoot)
      ? "extension-page"
      : sender.tab
        ? "content-script"
        : "unknown";
    void services.handleMessage(message, { source }).then(sendResponse);
    return true;
  };
}
