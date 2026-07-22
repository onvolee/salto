import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  ExtensionSettings,
  PromptContext,
  QueryTemplate,
} from "@salto/core";

import type { ThemeMode } from "salto-src/theme/theme-settings";
import { useThemeMode } from "salto-src/theme/use-theme-mode";

import { FloatingTrigger } from "./FloatingTrigger";
import { browserMessageClient, type ExtensionMessageClient } from "./message-client";
import { isOpenSelectionPanelMessage } from "./panel-command";
import {
  clampToViewport,
  getInitialPanelPosition,
  getPanelSize,
  getTriggerPosition,
  type Point,
  type Size,
} from "./positioning";
import {
  SelectionPanel,
  type ActiveTemplateState,
  type SelectionPanelProps,
  type TranslationState
} from "./SelectionPanel";
import { extractPromptContext } from "./prompt-context";
import {
  getRangeAnchorRect,
  readSelectionSnapshot,
  type SelectionSnapshot,
} from "./selection";
import { extractSelectionPath } from "./selection-path";

const TRIGGER_SIZE: Size = { width: 32, height: 32 };

type SurfaceMode = "hidden" | "trigger-visible" | "panel-open";
type SaveState = SelectionPanelProps["saveState"];
type PanelOpenSubscription = (listener: () => void) => () => void;

function subscribeToBrowserPanelOpen(listener: () => void): () => void {
  if (typeof browser === "undefined") return () => undefined;
  const handleMessage = (message: unknown) => {
    if (isOpenSelectionPanelMessage(message)) listener();
  };
  browser.runtime.onMessage.addListener(handleMessage);
  return () => browser.runtime.onMessage.removeListener(handleMessage);
}

function getViewportSize(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

function eventIncludesElement(event: Event, element: Element | null): boolean {
  if (!element) {
    return false;
  }

  return event.composedPath().includes(element) || element.contains(event.target as Node | null);
}

export function SelectionPopupApp({
  createRequestId = () => crypto.randomUUID(),
  messageClient = browserMessageClient,
  onSaveSuccess,
  subscribePanelOpen = subscribeToBrowserPanelOpen,
}: {
  readonly createRequestId?: () => string;
  readonly messageClient?: ExtensionMessageClient;
  readonly onSaveSuccess?: (term: string) => void;
  readonly subscribePanelOpen?: PanelOpenSubscription;
}) {
  const [mode, setMode] = useState<SurfaceMode>("hidden");
  const themeMode = useThemeMode();
  const [session, setSession] = useState<SelectionSnapshot | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<Point>({ x: 0, y: 0 });
  const [panelPosition, setPanelPosition] = useState<Point>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocusRef = useRef(false);
  const translationRequestRef = useRef<string | null>(null);
  const panelGenerationRef = useRef(0);
  const templateSnapshotRef = useRef<QueryTemplate | null>(null);
  const saveRequestRef = useRef(0);
  const [promptContext, setPromptContext] = useState<PromptContext | null>(null);
  const [translation, setTranslation] = useState<TranslationState>({ status: "loading" });
  const [activeTemplate, setActiveTemplate] = useState<ActiveTemplateState>({ status: "loading" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [panelSize, setPanelSize] = useState<Size>(getPanelSize(getViewportSize()));

  const refreshTrigger = useCallback(() => {
    const snapshot = readSelectionSnapshot(window.getSelection());
    if (!snapshot) {
      setSession(null);
      setMode("hidden");
      return;
    }

    setSession(snapshot);
    setTriggerPosition(getTriggerPosition(snapshot.anchorRect, TRIGGER_SIZE, getViewportSize()));
    setMode("trigger-visible");
  }, []);

  const closePanel = useCallback((restoreTriggerFocus = true) => {
    panelGenerationRef.current += 1;
    const requestId = translationRequestRef.current;
    translationRequestRef.current = null;
    templateSnapshotRef.current = null;
    if (requestId) {
      void messageClient.cancelTranslation?.(requestId).catch(() => undefined);
    }
    saveRequestRef.current += 1;
    if (restoreTriggerFocus && session) {
      restoreTriggerFocusRef.current = true;
      setMode("trigger-visible");
    } else {
      window.getSelection()?.removeAllRanges();
      setSession(null);
      setMode("hidden");
    }
  }, [messageClient, session]);

  const requestTranslation = useCallback((
    context: PromptContext,
    template: QueryTemplate,
    generation: number,
  ) => {
    const previousRequestId = translationRequestRef.current;
    if (previousRequestId) {
      void messageClient.cancelTranslation?.(previousRequestId).catch(() => undefined);
    }
    const requestId = createRequestId();
    translationRequestRef.current = requestId;
    setTranslation({ status: "loading" });
    void messageClient.send({
      type: "translate-selection",
      payload: { requestId, context, template },
    }).then((response) => {
      if (
        translationRequestRef.current !== requestId
        || panelGenerationRef.current !== generation
      ) {
        return;
      }
      if (response.ok && response.type === "translate-selection") {
        setTranslation((prev) => {
          if (prev.status === "streaming") {
            const streamingFieldIds = new Set(prev.fields.map((f) => f.fieldId));
            const mergedFields = [
              ...prev.fields,
              ...response.data.fields.filter((f) => !streamingFieldIds.has(f.fieldId)),
            ];
            return {
              status: "complete",
              data: {
                templateId: response.data.templateId,
                templateName: response.data.templateName,
                schema: response.data.schema,
                fields: mergedFields,
              },
            };
          }
          return { status: "complete", data: response.data };
        });
      } else {
        setTranslation({
          status: "request-error",
          message: response.ok ? "Unexpected response" : response.error.message,
        });
      }
    }).catch(() => {
      if (
        translationRequestRef.current === requestId
        && panelGenerationRef.current === generation
      ) {
        setTranslation({ status: "request-error", message: "Translation request failed" });
      }
    });
  }, [createRequestId, messageClient]);

  const savePanelSize = useCallback((size: Size) => {
    void messageClient.send({ type: "get-extension-settings" }).then((response) => {
      if (!response.ok || response.type !== "get-extension-settings") {
        return;
      }
      const settings = response.data;
      void messageClient.send({
        type: "save-extension-settings",
        payload: {
          ...settings,
          panelWidth: size.width,
          panelHeight: size.height,
        },
      });
    });
  }, [messageClient]);

  const openPanel = useCallback((requestedSession?: SelectionSnapshot) => {
    const nextSession = requestedSession ?? session;
    if (!nextSession) {
      return;
    }

    const generation = panelGenerationRef.current + 1;
    panelGenerationRef.current = generation;
    templateSnapshotRef.current = null;
    const viewport = getViewportSize();
    const nextTriggerPosition = requestedSession
      ? getTriggerPosition(nextSession.anchorRect, TRIGGER_SIZE, viewport)
      : triggerPosition;
    setSession(nextSession);
    setTriggerPosition(nextTriggerPosition);
    setPanelPosition(
      getInitialPanelPosition(nextTriggerPosition, TRIGGER_SIZE, panelSize, viewport),
    );
    const context = extractPromptContext(nextSession.range, "");
    saveRequestRef.current += 1;
    setPromptContext(context);
    setActiveTemplate({ status: "loading" });
    setTranslation({ status: "loading" });
    setMode("panel-open");

    void messageClient.send({
      type: "check-vocabulary-exists",
      payload: { term: nextSession.text, language: "en" },
    }).then((response) => {
      if (panelGenerationRef.current !== generation) {
        return;
      }
      if (response.ok && response.type === "check-vocabulary-exists" && response.data.exists) {
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    }).catch(() => {
      if (panelGenerationRef.current === generation) {
        setSaveState("idle");
      }
    });

    void messageClient.send({ type: "get-active-query-template" }).then((response) => {
      if (panelGenerationRef.current !== generation) {
        return;
      }
      if (!response.ok || response.type !== "get-active-query-template") {
        setActiveTemplate({
          status: "error",
          message: response.ok ? "Unexpected response" : response.error.message,
        });
        return;
      }
      const snapshot = response.data.template;
      templateSnapshotRef.current = snapshot;
      setActiveTemplate({
        status: "ready",
        template: snapshot,
        resolution: response.data.resolution,
      });
      requestTranslation(context, snapshot, generation);
    }).catch(() => {
      if (panelGenerationRef.current === generation) {
        setActiveTemplate({
          status: "error",
          message: "Active template could not be loaded",
        });
      }
    });
  }, [messageClient, panelSize, requestTranslation, session, triggerPosition]);

  useEffect(() => {
    void messageClient.send({ type: "get-extension-settings" }).then((response) => {
      if (!response.ok || response.type !== "get-extension-settings") {
        return;
      }
      const settings = response.data as ExtensionSettings;
      const viewport = getViewportSize();
      setPanelSize(getPanelSize(viewport, { width: settings.panelWidth, height: settings.panelHeight }));
    });
  }, [messageClient]);

  useEffect(() => subscribePanelOpen(() => {
    if (mode === "panel-open") return;
    const snapshot = readSelectionSnapshot(window.getSelection());
    if (snapshot) openPanel(snapshot);
  }), [mode, openPanel, subscribePanelOpen]);

  useEffect(() => {
    if (mode !== "trigger-visible" || !restoreTriggerFocusRef.current) return;
    restoreTriggerFocusRef.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [mode]);

  const regenerateTranslation = useCallback(() => {
    const template = templateSnapshotRef.current;
    if (promptContext && template) {
      const generation = panelGenerationRef.current + 1;
      panelGenerationRef.current = generation;
      requestTranslation(promptContext, template, generation);
    }
  }, [promptContext, requestTranslation]);

  useEffect(() => {
    if (typeof browser === "undefined" || !browser?.runtime?.onMessage) return;
    const handleMessage = (message: unknown) => {
      if (
        typeof message === "object"
        && message !== null
        && (message as { type?: string }).type === "translation-field-ready"
      ) {
        const payload = (message as { payload?: {
          requestId?: string;
          fieldId?: string;
          result?: import("@salto/core").QueryFieldResult;
        } }).payload;
        if (
          !payload
          || typeof payload.requestId !== "string"
          || typeof payload.fieldId !== "string"
          || !payload.result
        ) {
          return;
        }
        if (translationRequestRef.current !== payload.requestId) {
          return;
        }
        setTranslation((prev) => {
          if (prev.status === "streaming") {
            const existingFields = prev.fields.filter((f) => f.fieldId !== payload.fieldId);
            return {
              ...prev,
              fields: [...existingFields, payload.result!],
            };
          }
          if (prev.status === "loading") {
            const template = templateSnapshotRef.current;
            if (!template) return prev;
            const schema = template.fields
              .filter((field) => field.enabled)
              .toSorted((left, right) => left.order - right.order)
              .map(({ id, label }) => ({ id, label }));
            return {
              status: "streaming" as const,
              templateId: template.id,
              templateName: template.name,
              schema,
              fields: [payload.result!],
            };
          }
          return prev;
        });
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const saveSelection = useCallback(() => {
    if (!session || !promptContext || saveState === "saving" || saveState === "saved") {
      return;
    }
    setSaveState("saving");
    const requestId = ++saveRequestRef.current;
    const savedTerm = session.text;
    const selectionPath = extractSelectionPath(session.range);
    void messageClient.send({
      type: "save-vocabulary",
      payload: {
        term: session.text,
        language: "en",
        context: {
          sentence: promptContext.sentence,
          paragraphs: promptContext.paragraphs,
          pageTitle: promptContext.webTitle,
          pageUrl: promptContext.webUrl,
          selectionPath: selectionPath ?? undefined
        }
      }
    }).then((response) => {
      const saved = response.ok && response.type === "save-vocabulary";
      if (saved) {
        onSaveSuccess?.(savedTerm);
      }
      if (saveRequestRef.current === requestId) {
        setSaveState(saved ? "saved" : "error");
      }
    }).catch(() => {
      if (saveRequestRef.current === requestId) {
        setSaveState("error");
      }
    });
  }, [messageClient, onSaveSuccess, promptContext, saveState, session]);

  useEffect(() => {
    refreshTrigger();
  }, [refreshTrigger]);

  useEffect(() => {
    let pointerIsDown = false;
    let pointerStartedOutsidePanel = false;
    let selectionChangedDuringPointer = false;
    let suppressNextOutsideClick = false;

    const handleSelectionChange = () => {
      if (mode === "panel-open") {
        if (pointerIsDown && pointerStartedOutsidePanel) {
          selectionChangedDuringPointer = true;
        }
        return;
      }

      if (pointerIsDown) {
        return;
      }
      refreshTrigger();
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerIsDown = true;
      if (mode !== "panel-open" || eventIncludesElement(event, panelRef.current)) {
        return;
      }

      pointerStartedOutsidePanel = true;
      selectionChangedDuringPointer = false;
    };

    const handlePointerUp = () => {
      pointerIsDown = false;

      if (mode !== "panel-open") {
        refreshTrigger();
        return;
      }

      if (!pointerStartedOutsidePanel) {
        return;
      }

      const selection = window.getSelection();
      suppressNextOutsideClick = selectionChangedDuringPointer
        && Boolean(selection && selection.rangeCount > 0 && !selection.isCollapsed);
      pointerStartedOutsidePanel = false;
      selectionChangedDuringPointer = false;
    };

    const handlePointerCancel = () => {
      pointerIsDown = false;
      pointerStartedOutsidePanel = false;
      selectionChangedDuringPointer = false;
    };

    const handleClick = (event: MouseEvent) => {
      if (mode !== "panel-open" || eventIncludesElement(event, panelRef.current)) {
        return;
      }

      if (suppressNextOutsideClick) {
        suppressNextOutsideClick = false;
        return;
      }

      closePanel(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (mode === "panel-open" && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerCancel, true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerCancel, true);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closePanel, mode, refreshTrigger]);

  useEffect(() => {
    const handleScroll = () => {
      if (mode !== "trigger-visible" || !session) {
        return;
      }

      const anchorRect = getRangeAnchorRect(session.range);
      if (!anchorRect) {
        setSession(null);
        setMode("hidden");
        return;
      }

      setTriggerPosition(getTriggerPosition(anchorRect, TRIGGER_SIZE, getViewportSize()));
    };

    const handleResize = () => {
      const viewport = getViewportSize();
      setPanelSize((prevSize) => getPanelSize(viewport, prevSize));
      if (mode === "trigger-visible") {
        handleScroll();
      } else if (mode === "panel-open") {
        setPanelPosition((position) => clampToViewport(position, getPanelSize(viewport, panelSize), viewport));
      }
    };

    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [mode, panelSize, session]);

  const preserveSelection = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  if (mode === "trigger-visible") {
    return wrapSurface(
      <FloatingTrigger
        onOpen={() => openPanel()}
        onPointerDown={preserveSelection}
        position={triggerPosition}
        triggerRef={triggerRef}
      />,
      themeMode,
    );
  }

  if (mode === "panel-open" && session) {
    return wrapSurface(
      <SelectionPanel
        activeTemplate={activeTemplate}
        onClose={() => closePanel(true)}
        onPositionChange={setPanelPosition}
        onRegenerate={regenerateTranslation}
        onSave={saveSelection}
        onSizeChange={savePanelSize}
        panelRef={panelRef}
        position={panelPosition}
        size={panelSize}
        selectionText={session.text}
        saveState={saveState}
        translation={translation}
      />,
      themeMode,
    );
  }

  return null;
}

function wrapSurface(surface: ReactNode, themeMode: ThemeMode) {
  return (
    <div className="salto-theme-scope" data-theme={themeMode}>
      {surface}
    </div>
  );
}
