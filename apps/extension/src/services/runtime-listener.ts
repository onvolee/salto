import type { ExtensionResponse } from "@salto/core";

import type { BackgroundServices } from "./background-services";

type SendResponse = (response: ExtensionResponse) => void;

export function createRuntimeMessageListener(services: Pick<BackgroundServices, "handleMessage">) {
  return (message: unknown, _sender: unknown, sendResponse: SendResponse): true => {
    void services.handleMessage(message).then(sendResponse);
    return true;
  };
}
