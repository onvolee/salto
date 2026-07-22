// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultQueryTemplate,
  createDefaultTemplateFieldDefinitions,
} from "@salto/core";

import type { useQueryTemplates } from "../hooks/use-query-templates";
import type { useTemplateFieldDefinitions } from "../hooks/use-template-field-definitions";
import { templateDraftFromQueryTemplate } from "../template-editor";
import { SelectionSection } from "./selection-section";

function definitionEditor() {
  return {
    createDefinition: vi.fn(),
    definitions: createDefaultTemplateFieldDefinitions("2026-07-23T00:00:00.000Z"),
    deleteDefinition: vi.fn(),
    message: null,
    status: "idle" as const,
    updateDefinition: vi.fn(),
  } as unknown as ReturnType<typeof useTemplateFieldDefinitions>;
}

describe("selection settings", () => {
  afterEach(cleanup);

  it("updates the active-template settings draft without immediate persistence", async () => {
    const systemTemplate = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const userTemplate = { ...systemTemplate, id: "reading", name: "Reading" };
    const selectTemplate = vi.fn();
    const onActiveTemplateChange = vi.fn();
    const editor = {
      activeTemplateId: systemTemplate.id,
      draft: templateDraftFromQueryTemplate(systemTemplate),
      errors: { field: {} },
      isSystemTemplate: true,
      message: null,
      selectedTemplateId: systemTemplate.id,
      selectTemplate,
      status: "idle" as const,
      templates: [systemTemplate, userTemplate],
    } as unknown as ReturnType<typeof useQueryTemplates>;
    render(
      <SelectionSection
        activeTemplateId={systemTemplate.id}
        definitions={definitionEditor()}
        editor={editor}
        onActiveTemplateChange={onActiveTemplateChange}
        onViewChange={vi.fn()}
        view="templates"
      />,
    );
    const user = userEvent.setup();

    const templateSelect = screen.getByRole("combobox", { name: "当前翻译模板" });
    templateSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(selectTemplate).toHaveBeenCalledWith("reading");
    expect(onActiveTemplateChange).toHaveBeenCalledWith("reading");
  });

  it("restores the requested tab and routes tab changes", async () => {
    const template = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const onViewChange = vi.fn();
    render(
      <SelectionSection
        activeTemplateId={template.id}
        definitions={definitionEditor()}
        editor={{} as ReturnType<typeof useQueryTemplates>}
        onActiveTemplateChange={vi.fn()}
        onViewChange={onViewChange}
        view="fields"
      />,
    );

    expect(screen.getByRole("heading", { name: "Template fields" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Templates" }));
    expect(onViewChange).toHaveBeenCalledWith("templates");
  });

  it("reorders snapshots with keyboard controls and edits appearance in the draft", async () => {
    const systemTemplate = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const userTemplate = {
      ...systemTemplate,
      id: "reading",
      name: "Reading",
      fields: [
        { ...systemTemplate.fields[0], id: "translation", content: { ...systemTemplate.fields[0].content, label: "Translation" }, order: 0 },
        { ...systemTemplate.fields[0], id: "context", content: { ...systemTemplate.fields[0].content, label: "Context" }, order: 1 },
      ],
    };
    const moveField = vi.fn();
    const updateField = vi.fn();
    const editor = {
      activeTemplateId: userTemplate.id,
      addField: vi.fn(),
      cancelDraft: vi.fn(),
      copyTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      draft: templateDraftFromQueryTemplate(userTemplate),
      errors: { field: {} },
      isSystemTemplate: false,
      message: null,
      moveField,
      removeField: vi.fn(),
      saveDraft: vi.fn(),
      selectTemplate: vi.fn(),
      selectedTemplateId: userTemplate.id,
      startNewTemplate: vi.fn(),
      status: "idle" as const,
      templates: [systemTemplate, userTemplate],
      toggleField: vi.fn(),
      updateDraft: vi.fn(),
      updateField,
    } as unknown as ReturnType<typeof useQueryTemplates>;
    render(
      <SelectionSection
        activeTemplateId={userTemplate.id}
        definitions={definitionEditor()}
        editor={editor}
        onActiveTemplateChange={vi.fn()}
        onViewChange={vi.fn()}
        view="templates"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "下移Translation" }));
    expect(moveField).toHaveBeenCalledWith(0, 1);

    await user.click(screen.getByRole("button", { name: "编辑Translation外观" }));
    const preview = screen.getByLabelText("当前模板预览");
    expect(preview).toHaveTextContent("Reading");
    expect(preview).toHaveTextContent("Context");
    expect(within(preview).getByRole("button", { name: "重新生成模拟翻译" }))
      .toBeDisabled();
    fireEvent.change(screen.getByLabelText("Key CSS"), {
      target: { value: "color: tomato;" },
    });
    expect(updateField).toHaveBeenCalledWith("translation", expect.objectContaining({
      keyCss: expect.stringContaining("color: tomato;"),
    }));
  });
});
