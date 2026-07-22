import type { ExtensionResponse } from "@salto/core";

import type { BackgroundServices } from "./background-services";

type SendResponse = (response: ExtensionResponse) => void;
type MessageSender = { readonly url?: string; readonly tab?: unknown };

export function createRuntimeMessageListener(
  services: Pick<BackgroundServices, "handleMessage">,
  extensionRoot = "",
  optionsPageUrl = extensionRoot ? `${extensionRoot}setting.html` : "",
) {
  return (message: unknown, sender: MessageSender, sendResponse: SendResponse): true => {
    const senderDocumentUrl = sender.url?.split(/[?#]/, 1)[0];
    const source = optionsPageUrl && senderDocumentUrl === optionsPageUrl
      ? "options-page"
      : extensionRoot && sender.url?.startsWith(extensionRoot)
        ? "extension-page"
        : sender.tab
          ? "content-script"
          : "unknown";
    void services.handleMessage(message, { source }).then(sendResponse).catch(() => {
      sendResponse({
        ok: false,
        error: {
          code: "request-failed",
          message: "The extension request could not be completed",
        },
      });
    });
    return true;
  };
}
