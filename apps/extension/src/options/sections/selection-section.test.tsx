// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultQueryTemplate,
  createDefaultTemplateFieldDefinitions,
  PROMPT_CONTEXT_VARIABLES,
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
    const definitions = definitionEditor();
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
        definitions={definitions}
        editor={editor}
        onActiveTemplateChange={onActiveTemplateChange}
        onViewChange={vi.fn()}
        view="templates"
      />,
    );
    const user = userEvent.setup();

    const templateSelect = screen.getByRole("combobox", { name: "当前翻译模板" });
    expect(templateSelect).toHaveTextContent(systemTemplate.name);
    expect(templateSelect).not.toHaveTextContent(systemTemplate.id);
    templateSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(selectTemplate).toHaveBeenCalledWith("reading");
    expect(onActiveTemplateChange).toHaveBeenCalledWith("reading");
  });

  it("displays field definition labels while retaining UUID values", async () => {
    const template = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const definitions = definitionEditor();
    const addField = vi.fn();
    const editor = {
      activeTemplateId: template.id,
      addField,
      draft: templateDraftFromQueryTemplate(template),
      errors: { field: {} },
      isSystemTemplate: false,
      message: null,
      selectedTemplateId: template.id,
      status: "idle" as const,
      templates: [template],
    } as unknown as ReturnType<typeof useQueryTemplates>;
    render(
      <SelectionSection
        activeTemplateId={template.id}
        definitions={definitions}
        editor={editor}
        onActiveTemplateChange={vi.fn()}
        onViewChange={vi.fn()}
        view="templates"
      />,
    );
    const user = userEvent.setup();

    const fieldDefinitionSelect = screen.getByRole("combobox", { name: "添加字段快照" });
    const firstDefinition = definitions.definitions[0]!;
    const secondDefinition = definitions.definitions[1]!;
    expect(fieldDefinitionSelect).toHaveTextContent(firstDefinition.label);
    expect(fieldDefinitionSelect).not.toHaveTextContent(firstDefinition.id);
    fieldDefinitionSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(fieldDefinitionSelect).toHaveTextContent(secondDefinition.label);
    expect(fieldDefinitionSelect).not.toHaveTextContent(secondDefinition.id);

    await user.click(screen.getByRole("button", { name: "添加字段" }));
    expect(addField).toHaveBeenCalledWith(secondDefinition);
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

  it("lists every built-in instruction variable and inserts at the cursor", async () => {
    const template = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    render(
      <SelectionSection
        activeTemplateId={template.id}
        definitions={definitionEditor()}
        editor={{} as ReturnType<typeof useQueryTemplates>}
        onActiveTemplateChange={vi.fn()}
        onViewChange={vi.fn()}
        view="fields"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "新建字段定义" }));
    const instruction = screen.getByRole<HTMLTextAreaElement>(
      "textbox",
      { name: "Instruction" },
    );
    await user.type(instruction, "Translate this.");
    instruction.setSelectionRange(10, 10);

    for (const variable of PROMPT_CONTEXT_VARIABLES) {
      expect(screen.getByRole("button", { name: `插入 {{${variable}}}` }))
        .toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "插入 {{selection}}" }));

    expect(instruction).toHaveValue("Translate {{selection}}this.");
    expect(instruction).toHaveFocus();
    expect(instruction).toHaveProperty("selectionStart", 23);
    expect(instruction).toHaveProperty("selectionEnd", 23);
  });

  it("displays Chinese select labels while saving English values", async () => {
    const template = createDefaultQueryTemplate("2026-07-19T00:00:00.000Z");
    const definitions = definitionEditor();
    definitions.createDefinition = vi.fn().mockResolvedValue({});
    render(
      <SelectionSection
        activeTemplateId={template.id}
        definitions={definitions}
        editor={{} as ReturnType<typeof useQueryTemplates>}
        onActiveTemplateChange={vi.fn()}
        onViewChange={vi.fn()}
        view="fields"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "新建字段定义" }));
    await user.type(screen.getByRole("textbox", { name: "字段名称" }), "音标");

    const sourceSelect = screen.getByRole("combobox", { name: "来源" });
    expect(sourceSelect).toHaveTextContent("大语言模型");
    expect(sourceSelect).not.toHaveTextContent("llm");
    sourceSelect.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(sourceSelect).toHaveTextContent("词典");
    expect(sourceSelect).not.toHaveTextContent("dictionary");

    const dictionaryFieldSelect = screen.getByRole("combobox", { name: "词典字段" });
    expect(dictionaryFieldSelect).toHaveTextContent("释义");
    expect(dictionaryFieldSelect).not.toHaveTextContent("meaning");
    dictionaryFieldSelect.focus();
    await user.keyboard("{Enter}{Home}{Enter}");
    expect(dictionaryFieldSelect).toHaveTextContent("音标");
    expect(dictionaryFieldSelect).not.toHaveTextContent("phonetic");

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(definitions.createDefinition).toHaveBeenCalledWith({
      dictionaryField: "phonetic",
      label: "音标",
      source: "dictionary",
      type: "text",
    });
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
    const draft = templateDraftFromQueryTemplate(userTemplate);
    const editor = {
      activeTemplateId: userTemplate.id,
      addField: vi.fn(),
      cancelDraft: vi.fn(),
      copyTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      draft,
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
    const rendered = render(
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
    const appearanceDialog = screen.getByRole("dialog", { name: "翻译外观 · Translation" });
    expect(appearanceDialog).toHaveTextContent("调整当前模板字段的标签和值样式；修改会保留在模板草稿中。");
    expect(appearanceDialog).toHaveTextContent("字段样式");
    expect(appearanceDialog).toHaveTextContent("使用标准 CSS 声明块分别控制标签和值。");
    expect(appearanceDialog).toHaveTextContent("无效声明会被忽略，不影响其他字段。");
    expect(appearanceDialog).toHaveTextContent("实时预览");
    expect(appearanceDialog).toHaveTextContent("模拟结果 · 无需请求翻译");
    expect(appearanceDialog).toHaveTextContent("更改保留在模板草稿中");
    expect(within(appearanceDialog).getByRole("button", { name: "取消" })).toBeEnabled();
    expect(within(appearanceDialog).getByRole("button", { name: "完成" })).toBeEnabled();
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

    rendered.rerender(
      <SelectionSection
        activeTemplateId={userTemplate.id}
        definitions={definitionEditor()}
        editor={{
          ...editor,
          draft: {
            ...draft,
            fields: draft.fields.map((draftField) => draftField.id === "translation"
              ? { ...draftField, keyCss: "color: tomato;" }
              : draftField),
          },
        } as ReturnType<typeof useQueryTemplates>}
        onActiveTemplateChange={vi.fn()}
        onViewChange={vi.fn()}
        view="templates"
      />,
    );
    expect(within(screen.getByLabelText("当前模板预览")).getByText("Translation"))
      .toHaveStyle({ color: "tomato" });

    await user.click(within(appearanceDialog).getByRole("button", { name: "重置当前字段样式" }));
    expect(updateField).toHaveBeenLastCalledWith("translation", { keyCss: "", valueCss: "" });

    await user.click(within(appearanceDialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "翻译外观 · Translation" }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑Translation外观" }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByRole("dialog", { name: "翻译外观 · Translation" }))
      .not.toBeInTheDocument();
  });
});
