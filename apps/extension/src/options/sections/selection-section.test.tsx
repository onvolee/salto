// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultQueryTemplate } from "@salto/core";

import type { useQueryTemplates } from "../hooks/use-query-templates";
import { templateDraftFromQueryTemplate } from "../template-editor";
import { SelectionSection } from "./selection-section";

describe("selection settings", () => {
  afterEach(cleanup);

  it("updates the active-template settings draft without an immediate persistence action", async () => {
    const systemTemplate = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const userTemplate = { ...systemTemplate, id: "reading", name: "Reading" };
    const selectTemplate = vi.fn();
    const onActiveTemplateChange = vi.fn();
    const editor = {
      activeTemplateId: systemTemplate.id,
      addField: vi.fn(),
      cancelDraft: vi.fn(),
      changeFieldSource: vi.fn(),
      copyTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      draft: templateDraftFromQueryTemplate(systemTemplate),
      errors: { field: {} },
      isSystemTemplate: true,
      message: null,
      moveField: vi.fn(),
      removeField: vi.fn(),
      saveDraft: vi.fn(),
      selectTemplate,
      selectedTemplateId: systemTemplate.id,
      startNewTemplate: vi.fn(),
      status: "idle" as const,
      templates: [systemTemplate, userTemplate],
      toggleField: vi.fn(),
      updateDraft: vi.fn(),
      updateField: vi.fn(),
    } as unknown as ReturnType<typeof useQueryTemplates>;
    render(
      <SelectionSection
        activeTemplateId={systemTemplate.id}
        editor={editor}
        onActiveTemplateChange={onActiveTemplateChange}
      />,
    );
    const user = userEvent.setup();

    const templateSelect = screen.getByRole("combobox", { name: "当前翻译模板" });
    templateSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(selectTemplate).toHaveBeenCalledWith("reading");
    expect(onActiveTemplateChange).toHaveBeenCalledWith("reading");
    expect(screen.queryByRole("button", { name: "设为当前" })).not.toBeInTheDocument();
  });

  it("reorders fields and saves a user template with keyboard controls", async () => {
    const systemTemplate = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const userTemplate = {
      ...systemTemplate,
      id: "reading",
      name: "Reading",
      fields: [
        { ...systemTemplate.fields[0], id: "translation", label: "Translation", order: 0 },
        { ...systemTemplate.fields[0], id: "context", label: "Context", order: 1 },
      ],
    };
    const moveField = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue(true);
    const editor = {
      activeTemplateId: userTemplate.id,
      addField: vi.fn(),
      cancelDraft: vi.fn(),
      changeFieldSource: vi.fn(),
      copyTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      draft: templateDraftFromQueryTemplate(userTemplate),
      errors: { field: {} },
      isSystemTemplate: false,
      message: null,
      moveField,
      removeField: vi.fn(),
      saveDraft,
      selectTemplate: vi.fn(),
      selectedTemplateId: userTemplate.id,
      startNewTemplate: vi.fn(),
      status: "idle" as const,
      templates: [systemTemplate, userTemplate],
      toggleField: vi.fn(),
      updateDraft: vi.fn(),
      updateField: vi.fn(),
    } as unknown as ReturnType<typeof useQueryTemplates>;
    render(
      <SelectionSection
        activeTemplateId={userTemplate.id}
        editor={editor}
        onActiveTemplateChange={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    const moveDown = screen.getByRole("button", { name: "下移Translation" });
    moveDown.focus();
    await user.keyboard("{Enter}");
    expect(moveField).toHaveBeenCalledWith(0, 1);

    const save = screen.getByRole("button", { name: "保存模板" });
    save.focus();
    await user.keyboard("{Enter}");
    expect(saveDraft).toHaveBeenCalledOnce();
  });
});
