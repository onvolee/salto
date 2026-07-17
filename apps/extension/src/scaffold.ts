export const EXTENSION_ENTRYPOINTS = ["background", "content", "setting"] as const;

export type ExtensionEntrypoint = (typeof EXTENSION_ENTRYPOINTS)[number];
