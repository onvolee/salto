// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QueryTemplate } from "@salto/core";
import { SelectionPopupApp } from "./SelectionPopupApp";
import type { ExtensionMessageClient } from "./message-client";

const anchorRect = {
  x: 180,
  y: 220,
  left: 180,
  top: 220,
  right: 260,
  bottom: 240,
  width: 80,
  height: 20,
  toJSON: () => ({}),
};

const defaultTemplate: QueryTemplate = {
  id: "system-default",
  name: "Default",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  fields: [{
    id: "translation",
    definitionId: "definition-translation",
    content: { label: "Translation", source: "llm", type: "text", instruction: "Translate {{selection}}." },
    order: 0,
    enabled: true,
  }],
};

function withActiveTemplate(
  send: ExtensionMessageClient["send"],
  template: QueryTemplate = defaultTemplate,
): ExtensionMessageClient {
  return {
    send(request) {
      if (request.type === "get-active-query-template") {
        return Promise.resolve({
          ok: true,
          type: "get-active-query-template",
          data: { template, resolution: { status: "active" } },
        });
      }
      if (request.type === "check-vocabulary-exists") {
        return Promise.resolve({
          ok: true,
          type: "check-vocabulary-exists",
          data: { exists: false },
        });
      }
      if (request.type === "get-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        });
      }
      if (request.type === "save-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "save-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        });
      }
      return send(request);
    },
  };
}

function createDeferredTranslationClient(template: QueryTemplate = defaultTemplate) {
  let resolveTranslation: ((
    response: Awaited<ReturnType<ExtensionMessageClient["send"]>>,
  ) => void) | undefined;
  const messageClient = withActiveTemplate((request) => {
    if (request.type === "translate-selection") {
      return new Promise((resolve) => {
        resolveTranslation = resolve;
      });
    }
    return Promise.resolve({
      ok: false,
      type: request.type,
      error: { code: "unknown-message", message: "Unexpected request" },
    });
  }, template);

  return {
    messageClient,
    resolve(response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) {
      if (!resolveTranslation) throw new Error("Translation request has not started");
      resolveTranslation(response);
    },
  };
}

function selectNodeText(source: Element | null, start: number, end: number) {
  const text = source?.firstChild;
  if (!text) {
    throw new Error("Selection source is unavailable");
  }

  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  act(() => document.dispatchEvent(new Event("selectionchange")));
}

function selectText(start: number, end: number) {
  selectNodeText(document.querySelector("[data-selection-source]"), start, end);
}

async function openPanel() {
  selectText(0, 10);
  const trigger = await screen.findByRole("button", { name: "Open selection panel" });
  await userEvent.setup().click(trigger);

  return screen.getByRole("dialog", { name: "Selection panel for unfamiliar" });
}

describe("SelectionPopupApp", () => {
  let browserSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    document.body.innerHTML = '<p data-selection-source>unfamiliar second selection</p>';
    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      anchorRect,
    ] as unknown as DOMRectList);
    browserSendMessage = vi.fn((request: { type: string }) => {
      if (request.type === "get-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        });
      }
      if (request.type === "save-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "save-extension-settings",
          data: undefined,
        });
      }
      if (request.type === "get-active-query-template") {
        return Promise.resolve({
          ok: true,
          type: "get-active-query-template",
          data: {
            template: defaultTemplate,
            resolution: { status: "active" },
          },
        });
      }
      if (request.type === "check-vocabulary-exists") {
        return Promise.resolve({
          ok: true,
          type: "check-vocabulary-exists",
          data: { exists: false },
        });
      }
      if (request.type === "translate-selection") {
        return Promise.resolve({
          ok: true,
          type: "translate-selection",
          data: {
            templateId: "system-default",
            templateName: "Default",
            schema: [{ id: "translation", label: "Translation" }],
            fields: [{ fieldId: "translation", status: "ready", type: "text", value: "陌生的" }],
          },
        });
      }
      return Promise.resolve({ ok: false });
    });
    vi.stubGlobal("browser", {
      runtime: {
        sendMessage: browserSendMessage,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a trigger for a valid selection and opens without moving focus into the panel", async () => {
    render(<SelectionPopupApp />);
    selectText(0, 10);

    const trigger = screen.getByRole("button", { name: "Open selection panel" });
    const user = userEvent.setup();
    await user.hover(trigger);
    trigger.focus();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).not.toBeInTheDocument();
    const panel = screen.getByRole("dialog", { name: "Selection panel for unfamiliar" });
    expect(panel).toBeInTheDocument();
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it("opens from the browser command only for a valid selection", async () => {
    let openFromCommand: (() => void) | undefined;
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: true,
      type: "translate-selection",
      data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] },
    });
    render(
      <SelectionPopupApp
        messageClient={withActiveTemplate(send)}
        subscribePanelOpen={(listener) => {
          openFromCommand = listener;
          return () => undefined;
        }}
      />,
    );

    window.getSelection()?.removeAllRanges();
    act(() => openFromCommand?.());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    selectText(0, 10);
    act(() => openFromCommand?.());

    const panel = screen.getByRole("dialog", { name: "Selection panel for unfamiliar" });
    expect(panel).toBeInTheDocument();
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it("contains Tab focus inside the open panel", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: true,
      type: "translate-selection",
      data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] },
    });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} />);
    await openPanel();
    await screen.findByRole("heading", { name: "Default" });

    const user = userEvent.setup();
    const close = screen.getByRole("button", { name: "Close panel" });
    const regenerate = screen.getByRole("button", { name: "Regenerate translation" });
    expect(close).not.toHaveFocus();

    close.focus();
    expect(close).toHaveFocus();

    await user.tab();
    expect(regenerate).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it("does not query on selection and renders ordered fields after explicit open", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Default",
        schema: [{ id: "translation", label: "Translation" }, { id: "points", label: "Key points" }],
        fields: [
          { fieldId: "translation", status: "ready", type: "text", value: "陌生的" },
          { fieldId: "points", status: "ready", type: "list", value: ["adjective", "not known"] }
        ]
      }
    });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} />);
    selectText(0, 10);

    expect(send).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));

    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual(["Translation", "Key points"]);
    expect(screen.getByText("陌生的")).toBeInTheDocument();
    expect(screen.getByText("adjective")).toBeInTheDocument();
    expect(send).toHaveBeenCalledOnce();
  });

  it("uses the saved active template on the next open without rewriting the current panel", async () => {
    const readingTemplate = { ...defaultTemplate, id: "reading", name: "Reading" };
    const studyTemplate = { ...defaultTemplate, id: "study", name: "Study" };
    const snapshots = [readingTemplate, studyTemplate];
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation(async (request) => {
      if (request.type === "get-active-query-template") {
        const template = snapshots.shift() ?? studyTemplate;
        return {
          ok: true,
          type: "get-active-query-template",
          data: { template, resolution: { status: "active" } },
        };
      }
      if (request.type === "translate-selection") {
        return {
          ok: true,
          type: "translate-selection",
          data: {
            templateId: request.payload.template.id,
            templateName: request.payload.template.name,
            schema: [{ id: "translation", label: "Translation" }],
            fields: [{ fieldId: "translation", status: "ready", type: "text", value: "translated" }],
          },
        };
      }
      if (request.type === "get-extension-settings") {
        return {
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        };
      }
      throw new Error(`Unexpected request: ${request.type}`);
    });
    render(<SelectionPopupApp messageClient={{ send }} />);

    await openPanel();
    expect(await screen.findByRole("heading", { name: "Reading" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await act(async () => undefined);
    expect(screen.getByRole("heading", { name: "Reading" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));
    await openPanel();

    expect(await screen.findByRole("heading", { name: "Study" })).toBeInTheDocument();
    expect(send.mock.calls.filter(([request]) => request.type === "get-active-query-template"))
      .toHaveLength(2);
  });

  it("renders enabled field states in snapshot order while preserving ready siblings", async () => {
    const stateTemplate: QueryTemplate = {
      ...defaultTemplate,
      id: "field-states",
      name: "Field states",
      fields: [
        { ...defaultTemplate.fields[0], id: "ready", content: { ...defaultTemplate.fields[0].content, label: "Ready" }, order: 2 },
        { ...defaultTemplate.fields[0], id: "failed", content: { ...defaultTemplate.fields[0].content, label: "Failed" }, order: 0 },
        { ...defaultTemplate.fields[0], id: "unavailable", content: { ...defaultTemplate.fields[0].content, label: "Unavailable" }, order: 1 },
        { ...defaultTemplate.fields[0], id: "disabled", content: { ...defaultTemplate.fields[0].content, label: "Disabled" }, order: 3, enabled: false },
      ],
    };
    let resolveTranslation!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation((request) => {
      if (request.type === "get-active-query-template") {
        return Promise.resolve({
          ok: true,
          type: "get-active-query-template",
          data: { template: stateTemplate, resolution: { status: "active" } },
        });
      }
      if (request.type === "get-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        });
      }
      if (request.type === "check-vocabulary-exists") {
        return Promise.resolve({
          ok: true,
          type: "check-vocabulary-exists",
          data: { exists: false },
        });
      }
      return new Promise((resolve) => {
        resolveTranslation = resolve;
      });
    });
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();

    expect(await screen.findByRole("heading", { name: "Field states" })).toBeInTheDocument();
    expect(screen.getAllByRole("term").map((node) => node.textContent))
      .toEqual(["Failed", "Unavailable", "Ready"]);
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
    expect(screen.getAllByText("Loading field...")).toHaveLength(3);

    await act(async () => resolveTranslation({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: stateTemplate.id,
        templateName: stateTemplate.name,
        schema: [
          { id: "failed", label: "Failed" },
          { id: "unavailable", label: "Unavailable" },
          { id: "ready", label: "Ready" },
        ],
        fields: [
          { fieldId: "ready", status: "ready", type: "text", value: "Ready sibling" },
          { fieldId: "failed", status: "failed", error: { code: "provider", message: "Field failed" } },
          { fieldId: "unavailable", status: "unavailable", reason: "not-found" },
        ],
      },
    }));

    expect(screen.getByText("Ready sibling")).toBeInTheDocument();
    expect(screen.getByText("Field failed")).toBeInTheDocument();
    expect(screen.getByText("Field unavailable")).toBeInTheDocument();
  });

  it("shows a stable non-secret diagnostic when the active template is recovered", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation(async (request) => {
      if (request.type === "get-active-query-template") {
        return {
          ok: true,
          type: "get-active-query-template",
          data: {
            template: defaultTemplate,
            resolution: { status: "recovered", code: "active-template-unavailable" },
          },
        };
      }
      if (request.type === "translate-selection") {
        return {
          ok: true,
          type: "translate-selection",
          data: {
            templateId: defaultTemplate.id,
            templateName: defaultTemplate.name,
            schema: [],
            fields: [],
          },
        };
      }
      if (request.type === "get-extension-settings") {
        return {
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        };
      }
      throw new Error("Unexpected request");
    });
    render(<SelectionPopupApp messageClient={{ send }} />);
    await openPanel();

    const diagnostic = await screen.findByText("The active template was unavailable. Using Default.");
    expect(diagnostic).toHaveAttribute("data-code", "active-template-unavailable");
    expect(document.body.textContent).not.toContain("apiKey");
  });

  it("renders partial field failures and saves idempotently", async () => {
    const onSaveSuccess = vi.fn();
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: {
          templateId: "system-default",
          templateName: "Default",
          schema: [{ id: "translation", label: "Translation" }, { id: "points", label: "Key points" }],
          fields: [
            { fieldId: "translation", status: "ready", type: "text", value: "陌生的" },
            { fieldId: "points", status: "failed", error: { code: "fake-failure", message: "Field unavailable" } }
          ]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        type: "save-vocabulary",
        data: { status: "saved", vocabularyItemId: "item-1" }
      });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} onSaveSuccess={onSaveSuccess} />);
    await openPanel();

    expect(await screen.findByText("Field unavailable")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save selection" });
    await userEvent.setup().click(save);
    await userEvent.setup().click(save);

    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(onSaveSuccess).toHaveBeenCalledOnce();
    expect(onSaveSuccess).toHaveBeenCalledWith("unfamiliar");
  });

  it("renders a request-level error without changing panel geometry", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: false,
      error: { code: "request-failed", message: "The extension request could not be completed" }
    });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} />);
    const panel = await openPanel();

    expect(await screen.findByText("The extension request could not be completed")).toBeInTheDocument();
    expect(panel).toHaveStyle({ left: "268px", top: "220px" });
  });

  it("allows retrying a failed save", async () => {
    const onSaveSuccess = vi.fn();
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "request-failed", message: "Could not save" }
      })
      .mockResolvedValueOnce({
        ok: true,
        type: "save-vocabulary",
        data: { status: "saved", vocabularyItemId: "item-1" }
      });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} onSaveSuccess={onSaveSuccess} />);
    await openPanel();
    const save = screen.getByRole("button", { name: "Save selection" });

    const user = userEvent.setup();
    save.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Could not save selection", {
      selector: ".salto-selection-panel__save-error",
    })).toBeInTheDocument();
    expect(onSaveSuccess).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: "Selection saved" })).toBeDisabled();
    expect(send).toHaveBeenCalledTimes(3);
    expect(onSaveSuccess).toHaveBeenCalledOnce();
  });

  it("announces a save while the request is pending", async () => {
    let resolveSave!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSave = resolve;
      }));
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} />);
    await openPanel();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));

    expect(screen.getByRole("button", { name: "Saving selection" })).toBeDisabled();
    expect(screen.getByText("Saving selection...")).toBeInTheDocument();

    await act(async () => resolveSave({
      ok: true,
      type: "save-vocabulary",
      data: { status: "saved", vocabularyItemId: "item-1" }
    }));
  });

  it("ignores a translation response after deliberate close", async () => {
    let resolveRequest!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>().mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} />);
    await openPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));

    await act(async () => resolveRequest({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Stale",
        schema: [],
        fields: []
      }
    }));

    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores a previous open response after a new panel is opened", async () => {
    const firstTemplate = { ...defaultTemplate, id: "first-open", name: "First open" };
    const secondTemplate = { ...defaultTemplate, id: "second-open", name: "Second open" };
    const snapshots = [firstTemplate, secondTemplate];
    const translationResolvers: Array<(
      response: Awaited<ReturnType<ExtensionMessageClient["send"]>>,
    ) => void> = [];
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation((request) => {
      if (request.type === "get-active-query-template") {
        const template = snapshots.shift() ?? secondTemplate;
        return Promise.resolve({
          ok: true,
          type: "get-active-query-template",
          data: { template, resolution: { status: "active" } },
        });
      }
      if (request.type === "get-extension-settings") {
        return Promise.resolve({
          ok: true,
          type: "get-extension-settings",
          data: {
            activeQueryTemplateId: "system-default",
            targetLanguage: "zh-CN",
            highlightEnabled: true,
            highlightSameWords: false,
            themeMode: "system",
            activeDictionaryProvider: "youdao-web",
            panelWidth: 360,
            panelHeight: 220,
          },
        });
      }
      if (request.type === "check-vocabulary-exists") {
        return Promise.resolve({
          ok: true,
          type: "check-vocabulary-exists",
          data: { exists: false },
        });
      }
      return new Promise((resolve) => translationResolvers.push(resolve));
    });
    render(<SelectionPopupApp messageClient={{ send }} />);

    await openPanel();
    expect(await screen.findByRole("heading", { name: "First open" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));
    await openPanel();
    expect(await screen.findByRole("heading", { name: "Second open" })).toBeInTheDocument();

    await act(async () => translationResolvers[1]?.({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: secondTemplate.id,
        templateName: secondTemplate.name,
        schema: [{ id: "translation", label: "Translation" }],
        fields: [{ fieldId: "translation", status: "ready", type: "text", value: "Current result" }],
      },
    }));
    await act(async () => translationResolvers[0]?.({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: firstTemplate.id,
        templateName: firstTemplate.name,
        schema: [{ id: "translation", label: "Translation" }],
        fields: [{ fieldId: "translation", status: "ready", type: "text", value: "Stale result" }],
      },
    }));

    expect(screen.getByText("Current result")).toBeInTheDocument();
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("cancels the previous request and ignores stale output when regenerating", async () => {
    const resolvers: Array<(
      response: Awaited<ReturnType<ExtensionMessageClient["send"]>>,
    ) => void> = [];
    const send = vi.fn<ExtensionMessageClient["send"]>().mockImplementation(() => (
      new Promise((resolve) => resolvers.push(resolve))
    ));
    const cancelTranslation = vi.fn().mockResolvedValue(undefined);
    const requestIds = ["request-a", "request-b"];
    render(
      <SelectionPopupApp
        createRequestId={() => requestIds.shift() ?? "unexpected"}
        messageClient={{ ...withActiveTemplate(send), cancelTranslation }}
      />,
    );
    await openPanel();

    const regenerate = screen.getByRole("button", { name: "Regenerate translation" });
    regenerate.focus();
    await userEvent.setup().keyboard("{Enter}");

    expect(cancelTranslation).toHaveBeenCalledWith("request-a");
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: "translate-selection",
      payload: expect.objectContaining({ requestId: "request-b", template: defaultTemplate }),
    }));
    await act(async () => resolvers[1]?.({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Latest",
        schema: [{ id: "translation", label: "Translation" }],
        fields: [{ fieldId: "translation", status: "ready", type: "text", value: "Latest result" }],
      },
    }));
    expect(await screen.findByText("Latest result")).toBeInTheDocument();

    await act(async () => resolvers[0]?.({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Stale",
        schema: [{ id: "translation", label: "Translation" }],
        fields: [{ fieldId: "translation", status: "ready", type: "text", value: "Stale result" }],
      },
    }));
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("cancels the active provider request when the panel closes", async () => {
    const send = vi.fn<ExtensionMessageClient["send"]>().mockResolvedValue({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: "system-default",
        templateName: "Default",
        schema: [],
        fields: [],
      },
    });
    const cancelTranslation = vi.fn().mockResolvedValue(undefined);
    render(
      <SelectionPopupApp
        createRequestId={() => "request-close"}
        messageClient={{ ...withActiveTemplate(send), cancelTranslation }}
      />,
    );
    await openPanel();

    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));

    expect(cancelTranslation).toHaveBeenCalledWith("request-close");
  });

  it("ignores a save response after close and a new selection", async () => {
    const onSaveSuccess = vi.fn();
    let resolveSave!: (response: Awaited<ReturnType<ExtensionMessageClient["send"]>>) => void;
    const send = vi.fn<ExtensionMessageClient["send"]>()
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSave = resolve;
      }))
      .mockResolvedValueOnce({
        ok: true,
        type: "translate-selection",
        data: { templateId: "system-default", templateName: "Default", schema: [], fields: [] }
      });
    render(<SelectionPopupApp messageClient={withActiveTemplate(send)} onSaveSuccess={onSaveSuccess} />);
    await openPanel();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save selection" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));

    selectText(11, 27);
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));
    await screen.findByRole("heading", { name: "Default" });

    await act(async () => resolveSave({
      ok: true,
      type: "save-vocabulary",
      data: { status: "saved", vocabularyItemId: "item-a" }
    }));

    expect(screen.getByRole("button", { name: "Save selection" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Selection saved" })).not.toBeInTheDocument();
    expect(onSaveSuccess).toHaveBeenCalledOnce();
    expect(onSaveSuccess).toHaveBeenCalledWith("unfamiliar");
  });

  it.each([
    ["close button", async () => userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }))],
    ["Escape", async () => userEvent.setup().keyboard("{Escape}")],
  ])("closes with %s, preserves selection, and restores trigger focus", async (_name, closePanel) => {
    render(<SelectionPopupApp />);
    await openPanel();

    await closePanel();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.getSelection()?.rangeCount).toBe(1);
    expect(screen.getByRole("button", { name: "Open selection panel" })).toHaveFocus();
  });

  it("keeps ordinary outside dismissal silent and clears the temporary selection UI", async () => {
    render(<SelectionPopupApp />);
    await openPanel();

    await userEvent.setup().click(document.querySelector("[data-selection-source]")!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.getSelection()?.rangeCount).toBe(0);
    expect(screen.queryByRole("button", { name: "Open selection panel" })).not.toBeInTheDocument();
  });

  it("ignores a new selection gesture while the panel is open", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 2 });
    selectText(11, 27);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 2 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAccessibleName("Selection panel for unfamiliar");
    expect(screen.queryByRole("button", { name: "Open selection panel" })).not.toBeInTheDocument();
  });

  it.each([
    ["whitespace", "   "],
    ["more than 500 characters", "x".repeat(501)],
  ])("does not close for an outside drag selecting %s", async (_name, text) => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.createElement("p");
    source.textContent = text;
    document.body.append(source);

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 5 });
    selectNodeText(source, 0, text.length);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 5 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
  });

  it("does not close when an outside drag produces the same selection range", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 6 });
    selectText(0, 10);
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 6 });
    fireEvent.click(source);

    expect(panel).toBeInTheDocument();
  });

  it("closes after an outside drag that does not form a selection", async () => {
    render(<SelectionPopupApp />);
    await openPanel();
    const source = document.querySelector("[data-selection-source]")!;

    fireEvent.pointerDown(source, { button: 0, clientX: 40, clientY: 40, pointerId: 7 });
    fireEvent.pointerUp(source, { button: 0, clientX: 180, clientY: 40, pointerId: 7 });
    fireEvent.click(source);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.getSelection()?.rangeCount).toBe(0);
  });

  it("drags from the non-button header area and not from header actions", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const header = screen.getByTestId("selection-panel-header");
    const bookmark = screen.getByRole("button", { name: "Save selection" });

    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 300,
      clientY: 250,
      isPrimary: true,
      pointerId: 3,
    });
    fireEvent.pointerMove(header, { clientX: 450, clientY: 380, pointerId: 3 });
    fireEvent.pointerUp(header, { clientX: 450, clientY: 380, pointerId: 3 });

    expect(panel).toHaveStyle({ left: "418px", top: "350px" });

    fireEvent.pointerDown(bookmark, { button: 0, clientX: 430, clientY: 365, pointerId: 4 });
    fireEvent.pointerMove(header, { clientX: 700, clientY: 600, pointerId: 4 });
    fireEvent.pointerUp(header, { clientX: 700, clientY: 600, pointerId: 4 });

    expect(panel).toHaveStyle({ left: "418px", top: "350px" });
  });

  it.each([
    {
      handle: "right",
      selector: ".salto-selection-panel__resize-handle--right",
      expectedWidth: 1004,
      expectedHeight: 220,
    },
    {
      handle: "bottom",
      selector: ".salto-selection-panel__resize-handle--bottom",
      expectedWidth: 360,
      expectedHeight: 572,
    },
    {
      handle: "bottom-right",
      selector: ".salto-selection-panel__resize-handle--bottom-right",
      expectedWidth: 1004,
      expectedHeight: 572,
    },
  ])("resizes from the $handle handle up to the viewport margin", async ({
    selector,
    expectedWidth,
    expectedHeight,
  }) => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const handle = panel.querySelector<HTMLElement>(selector);
    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle!, {
      button: 0,
      clientX: 628,
      clientY: 440,
      isPrimary: true,
      pointerId: 9,
    });
    fireEvent.pointerMove(handle!, {
      clientX: 2000,
      clientY: 2000,
      pointerId: 9,
    });

    expect(panel).toHaveStyle({
      left: "268px",
      top: "220px",
      width: `${expectedWidth}px`,
      height: `${expectedHeight}px`,
    });

    fireEvent.pointerUp(handle!, {
      clientX: 2000,
      clientY: 2000,
      pointerId: 9,
    });
    await act(async () => undefined);
    expect(browserSendMessage.mock.calls.filter(([request]) => (
      request.type === "save-extension-settings"
    ))).toHaveLength(0);

    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));

    expect(screen.getByRole("dialog", { name: "Selection panel for unfamiliar" })).toHaveStyle({
      width: "360px",
      height: "220px",
    });
  });

  it("auto-fits the completed result before enabling manual resizing", async () => {
    const autoFitTemplate: QueryTemplate = {
      ...defaultTemplate,
      fields: [
        defaultTemplate.fields[0],
        {
          ...defaultTemplate.fields[0],
          id: "example",
          definitionId: "definition-example",
          content: {
            ...defaultTemplate.fields[0].content,
            label: "Example",
          },
          order: 1,
        },
      ],
    };
    const deferred = createDeferredTranslationClient(autoFitTemplate);
    render(<SelectionPopupApp messageClient={deferred.messageClient} />);
    const panel = await openPanel();
    await screen.findByRole("heading", { name: "Default" });
    const handle = panel.querySelector<HTMLElement>(
      ".salto-selection-panel__resize-handle--bottom-right",
    );
    const viewport = panel.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const content = panel.querySelector<HTMLElement>(".salto-selection-panel__content");
    expect(handle).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(content).not.toBeNull();

    Object.defineProperties(panel, {
      offsetWidth: { configurable: true, value: 360 },
      offsetHeight: { configurable: true, value: 220 },
    });
    Object.defineProperties(viewport!, {
      clientWidth: { configurable: true, value: 358 },
      clientHeight: { configurable: true, value: 174 },
    });
    let widthMeasurements = 0;
    let heightMeasurements = 0;
    Object.defineProperties(content!, {
      scrollWidth: {
        configurable: true,
        get() {
          widthMeasurements += 1;
          return content!.querySelectorAll("dt").length === 2 ? 900 : 360;
        },
      },
      scrollHeight: {
        configurable: true,
        get() {
          heightMeasurements += 1;
          return content!.querySelectorAll("dd").length === 2 ? 700 : 174;
        },
      },
    });

    expect(panel).toHaveAttribute("data-resize-phase", "locked");
    fireEvent.pointerDown(handle!, {
      button: 0,
      clientX: 628,
      clientY: 440,
      isPrimary: true,
      pointerId: 10,
    });
    fireEvent.pointerMove(handle!, { clientX: 700, clientY: 500, pointerId: 10 });
    expect(panel).toHaveStyle({ width: "360px", height: "220px" });

    await act(async () => deferred.resolve({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: autoFitTemplate.id,
        templateName: autoFitTemplate.name,
        schema: [
          { id: "translation", label: "Translation" },
          { id: "example", label: "Example" },
        ],
        fields: [
          {
            fieldId: "translation",
            status: "ready",
            type: "text",
            value: "A long final translation that needs more room.",
          },
          {
            fieldId: "example",
            status: "ready",
            type: "text",
            value: "A long final example that also participates in measurement.",
          },
        ],
      },
    }));

    expect(screen.getAllByRole("term")).toHaveLength(2);
    expect(widthMeasurements).toBe(1);
    expect(heightMeasurements).toBe(1);
    expect(panel).toHaveAttribute("data-resize-phase", "animating");
    expect(panel).toHaveStyle({
      left: "268px",
      top: "220px",
      width: "560px",
      height: "420px",
    });
    fireEvent.pointerDown(handle!, {
      button: 0,
      clientX: 828,
      clientY: 640,
      isPrimary: true,
      pointerId: 11,
    });
    fireEvent.pointerMove(handle!, { clientX: 858, clientY: 674, pointerId: 11 });
    expect(panel).toHaveStyle({ width: "560px", height: "420px" });

    const finishTransition = (propertyName: "width" | "height") => {
      const event = new Event("transitionend", { bubbles: true });
      Object.defineProperty(event, "propertyName", { value: propertyName });
      fireEvent(panel, event);
    };
    finishTransition("width");
    expect(panel).toHaveAttribute("data-resize-phase", "animating");
    finishTransition("height");
    expect(panel).toHaveAttribute("data-resize-phase", "manual");

    fireEvent.pointerDown(handle!, {
      button: 0,
      clientX: 828,
      clientY: 640,
      isPrimary: true,
      pointerId: 12,
    });
    fireEvent.pointerMove(handle!, { clientX: 858, clientY: 674, pointerId: 12 });
    expect(panel).toHaveStyle({ width: "590px", height: "454px" });
    fireEvent.pointerUp(handle!, { clientX: 858, clientY: 674, pointerId: 12 });

    await userEvent.setup().click(screen.getByRole("button", { name: "Close panel" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Open selection panel" }));
    expect(screen.getByRole("dialog", { name: "Selection panel for unfamiliar" })).toHaveStyle({
      width: "360px",
      height: "220px",
    });
  });

  it("skips the auto-fit transition when reduced motion is preferred", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    const deferred = createDeferredTranslationClient();
    render(<SelectionPopupApp messageClient={deferred.messageClient} />);
    const panel = await openPanel();
    await screen.findByRole("heading", { name: "Default" });
    const viewport = panel.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const content = panel.querySelector<HTMLElement>(".salto-selection-panel__content");

    Object.defineProperties(panel, {
      offsetWidth: { configurable: true, value: 360 },
      offsetHeight: { configurable: true, value: 220 },
    });
    Object.defineProperties(viewport!, {
      clientWidth: { configurable: true, value: 358 },
      clientHeight: { configurable: true, value: 174 },
    });
    Object.defineProperties(content!, {
      scrollWidth: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 300 },
    });

    await act(async () => deferred.resolve({
      ok: true,
      type: "translate-selection",
      data: {
        templateId: defaultTemplate.id,
        templateName: defaultTemplate.name,
        schema: [{ id: "translation", label: "Translation" }],
        fields: [{
          fieldId: "translation",
          status: "ready",
          type: "text",
          value: "A long result shown without motion.",
        }],
      },
    }));

    expect(panel).toHaveStyle({ width: "502px", height: "346px" });
    expect(panel).toHaveAttribute("data-resize-phase", "manual");
  });

  it("does not start dragging from a non-primary pointer", async () => {
    render(<SelectionPopupApp />);
    const panel = await openPanel();
    const header = screen.getByTestId("selection-panel-header");

    fireEvent.pointerDown(header, {
      button: 0,
      clientX: 300,
      clientY: 250,
      isPrimary: false,
      pointerId: 8,
    });
    fireEvent.pointerMove(header, { clientX: 450, clientY: 380, pointerId: 8 });
    fireEvent.pointerUp(header, { clientX: 450, clientY: 380, pointerId: 8 });

    expect(panel).toHaveStyle({ left: "268px", top: "220px" });
  });
});
