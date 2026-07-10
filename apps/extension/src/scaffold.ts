export const EXTENSION_ENTRYPOINTS = ["background", "content", "options"] as const;

export type ExtensionEntrypoint = (typeof EXTENSION_ENTRYPOINTS)[number];
