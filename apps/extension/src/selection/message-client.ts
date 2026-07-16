import type { ExtensionRequest, ExtensionResponse } from "@salto/core";

export interface ExtensionMessageClient {
  send(request: ExtensionRequest): Promise<ExtensionResponse>;
}

export const browserMessageClient: ExtensionMessageClient = {
  send(request) {
    return browser.runtime.sendMessage(request) as Promise<ExtensionResponse>;
  }
};
