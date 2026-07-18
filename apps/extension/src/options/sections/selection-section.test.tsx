// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDefaultQueryTemplate } from "@salto/core";

import type { useQueryTemplates } from "../hooks/use-query-templates";
import { templateDraftFromQueryTemplate } from "../template-editor";
import { SelectionSection } from "./selection-section";

describe("selection settings", () => {
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

    await user.click(screen.getByRole("combobox", { name: "当前翻译模板" }));
    await user.click(screen.getByRole("option", { name: "Reading" }));

    expect(selectTemplate).toHaveBeenCalledWith("reading");
    expect(onActiveTemplateChange).toHaveBeenCalledWith("reading");
    expect(screen.queryByRole("button", { name: "设为当前" })).not.toBeInTheDocument();
  });
});
