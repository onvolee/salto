import type { ExtensionRequest, ExtensionResponse } from "@salto/core";

export interface ExtensionMessageClient {
  send(request: ExtensionRequest): Promise<ExtensionResponse>;
  cancelTranslation?(requestId: string): Promise<void>;
}

export const browserMessageClient: ExtensionMessageClient = {
  send(request) {
    return browser.runtime.sendMessage(request) as Promise<ExtensionResponse>;
  },
  async cancelTranslation(requestId) {
    await browser.runtime.sendMessage({
      type: "cancel-translation",
      payload: { requestId },
    } satisfies ExtensionRequest);
  }
};
