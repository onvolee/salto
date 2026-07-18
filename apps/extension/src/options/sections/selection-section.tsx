import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  FloppyDiskIcon,
  Refresh01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";

import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "salto-src/components/ui/field";
import { Input } from "salto-src/components/ui/input";
import { Textarea } from "salto-src/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "salto-src/components/ui/select";
import { Switch } from "salto-src/components/ui/switch";

import type { useQueryTemplates } from "../hooks/use-query-templates";
import type { TemplateFieldDraft } from "../template-editor";

type TemplateEditor = ReturnType<typeof useQueryTemplates>;

type TemplateNameEditorProps = {
  readonly draft: NonNullable<TemplateEditor["draft"]>;
  readonly error?: string;
  readonly disabled: boolean;
  readonly onChange: (name: string) => void;
};

function TemplateNameEditor({ draft, error, disabled, onChange }: TemplateNameEditorProps) {
  const form = useForm({
    defaultValues: { name: draft.name },
    validators: {
      onChange: ({ value }) => value.name.trim() ? undefined : "模板名称不能为空",
    },
  });

  useEffect(() => {
    form.setFieldValue("name", draft.name);
  }, [draft.id, draft.name, form]);

  return (
    <form.Field name="name">
      {(field) => (
        <Field data-invalid={Boolean(error || field.state.meta.errors.length)}>
          <FieldLabel htmlFor="query-template-name">模板名称</FieldLabel>
          <Input
            aria-describedby={error ? "query-template-name-error" : undefined}
            aria-invalid={Boolean(error || field.state.meta.errors.length)}
            disabled={disabled}
            id="query-template-name"
            onChange={(event) => {
              field.handleChange(event.target.value);
              onChange(event.target.value);
            }}
            value={field.state.value}
          />
          <FieldError id="query-template-name-error">{error ?? field.state.meta.errors[0]}</FieldError>
        </Field>
      )}
    </form.Field>
  );
}

function transformStyle(transform: { readonly x: number; readonly y: number } | null): string | undefined {
  return transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
}

const DICTIONARY_FIELDS = [
  { value: "phonetic", label: "音标", type: "text" },
  { value: "partOfSpeech", label: "词性", type: "text" },
  { value: "meaning", label: "释义", type: "text" },
  { value: "synonyms", label: "同义词", type: "list" },
  { value: "wordForms", label: "词形", type: "list" },
] as const;

function fieldError(
  errors: TemplateEditor["errors"],
  id: string,
  key: string,
): string | undefined {
  return errors.field[id]?.[key];
}

type SortableFieldRowProps = {
  field: TemplateFieldDraft;
  index: number;
  total: number;
  errors: TemplateEditor["errors"];
  onChangeSource: TemplateEditor["changeFieldSource"];
  onMove: TemplateEditor["moveField"];
  onRemove: TemplateEditor["removeField"];
  onToggle: TemplateEditor["toggleField"];
  onUpdate: TemplateEditor["updateField"];
};

function SortableFieldRow({
  field,
  index,
  total,
  errors,
  onChangeSource,
  onMove,
  onRemove,
  onToggle,
  onUpdate,
}: SortableFieldRowProps) {
  const sortable = useSortable({ id: field.id });
  const style = {
    transform: transformStyle(sortable.transform),
    transition: sortable.transition,
  };
  const labelError = fieldError(errors, field.id, "label");
  const instructionError = fieldError(errors, field.id, "instruction");
  const dictionaryError = fieldError(errors, field.id, "dictionaryField");
  const typeError = fieldError(errors, field.id, "type");

  return (
    <li
      className="flex flex-col gap-3 rounded-md border border-border/70 bg-background p-3"
      ref={sortable.setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`拖动字段${field.label}`}
          title="拖动字段"
        >
          <HugeiconsIcon aria-hidden="true" icon={DragDropVerticalIcon} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">字段 {index + 1}</span>
            <Badge variant={field.enabled ? "success" : "outline"}>
              {field.enabled ? "已启用" : "已停用"}
            </Badge>
            <Badge variant="secondary">{field.source === "llm" ? "LLM" : "词典"}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">顺序 {field.order}</p>
        </div>
        <Switch
          aria-label={`${field.enabled ? "停用" : "启用"}${field.label || "字段"}`}
          checked={field.enabled}
          onCheckedChange={() => onToggle(field.id)}
        />
      </div>

      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={Boolean(labelError)}>
          <FieldLabel htmlFor={`${field.id}-label`}>Label</FieldLabel>
          <Input
            aria-describedby={labelError ? `${field.id}-label-error` : undefined}
            aria-invalid={Boolean(labelError)}
            id={`${field.id}-label`}
            onChange={(event) => onUpdate(field.id, { label: event.target.value })}
            value={field.label}
          />
          <FieldError id={`${field.id}-label-error`}>{labelError}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${field.id}-source`}>来源</FieldLabel>
          <Select
            items={[
              { label: "LLM", value: "llm" },
              { label: "词典", value: "dictionary" },
            ]}
            onValueChange={(value) => {
              if (value === "llm" || value === "dictionary") onChangeSource(field.id, value);
            }}
            value={field.source}
          >
            <SelectTrigger aria-label={`${field.label || "字段"}来源`} id={`${field.id}-source`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="llm">LLM</SelectItem>
                <SelectItem value="dictionary">词典</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {field.source === "llm" ? (
          <Field>
            <FieldLabel htmlFor={`${field.id}-type`}>类型</FieldLabel>
            <Select
              items={[{ label: "文本", value: "text" }, { label: "列表", value: "list" }]}
              onValueChange={(value) => {
                if (value === "text" || value === "list") onUpdate(field.id, { type: value });
              }}
              value={field.type}
            >
              <SelectTrigger aria-label={`${field.label || "字段"}类型`} id={`${field.id}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="text">文本</SelectItem>
                  <SelectItem value="list">列表</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field data-invalid={Boolean(dictionaryError || typeError)}>
            <FieldLabel htmlFor={`${field.id}-dictionary`}>词典字段</FieldLabel>
            <Select
              items={DICTIONARY_FIELDS.map(({ label, value }) => ({ label, value }))}
              onValueChange={(value) => {
                const option = DICTIONARY_FIELDS.find((candidate) => candidate.value === value);
                if (option) onUpdate(field.id, { dictionaryField: option.value, type: option.type });
              }}
              value={field.dictionaryField}
            >
              <SelectTrigger
                aria-describedby={dictionaryError || typeError ? `${field.id}-dictionary-error` : undefined}
                aria-invalid={Boolean(dictionaryError || typeError)}
                aria-label={`${field.label || "字段"}词典字段`}
                id={`${field.id}-dictionary`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DICTIONARY_FIELDS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>类型由固定词典字段决定：{field.type === "list" ? "列表" : "文本"}</FieldDescription>
            <FieldError id={`${field.id}-dictionary-error`}>{dictionaryError ?? typeError}</FieldError>
          </Field>
        )}

        {field.source === "llm" ? (
          <Field className="sm:col-span-2" data-invalid={Boolean(instructionError)}>
            <FieldLabel htmlFor={`${field.id}-instruction`}>Instruction</FieldLabel>
            <Textarea
              aria-describedby={instructionError ? `${field.id}-instruction-error` : undefined}
              aria-invalid={Boolean(instructionError)}
              id={`${field.id}-instruction`}
              onChange={(event) => onUpdate(field.id, { instruction: event.target.value })}
              rows={3}
              value={field.instruction}
            />
            <FieldDescription>保存前必须填写 LLM instruction。</FieldDescription>
            <FieldError id={`${field.id}-instruction-error`}>{instructionError}</FieldError>
          </Field>
        ) : null}
      </FieldGroup>

      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border/60 pt-2">
        <Button
          aria-label={`上移${field.label || "字段"}`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={ArrowUp01Icon} strokeWidth={2} />
        </Button>
        <Button
          aria-label={`下移${field.label || "字段"}`}
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={ArrowDown01Icon} strokeWidth={2} />
        </Button>
        <Button
          aria-label={`删除${field.label || "字段"}`}
          onClick={() => onRemove(field.id)}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>
    </li>
  );
}

export function SelectionSection(editor: TemplateEditor) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const fields = editor.draft?.fields ?? [];
  const isSaving = editor.status === "saving";

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = fields.findIndex((field) => field.id === event.active.id);
    const to = fields.findIndex((field) => field.id === event.over?.id);
    editor.moveField(from, to);
  };

  return (
    <section aria-label="划词翻译模板" className="flex flex-col gap-5 py-6" data-od-id="selection-section">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-56 flex-1">
          <FieldLabel htmlFor="query-template">当前模板</FieldLabel>
          <Select items={editor.templates.map((template) => ({ label: template.name, value: template.id }))} onValueChange={(value) => { if (value) editor.selectTemplate(value); }} value={editor.selectedTemplateId ?? ""}>
            <SelectTrigger aria-label="当前翻译模板" id="query-template">
              <SelectValue placeholder="选择模板" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {editor.templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span>{template.name}</span>
                    {editor.activeTemplateId === template.id ? <Badge variant="success">当前</Badge> : null}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={editor.startNewTemplate} type="button" variant="outline">
          <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Add01Icon} strokeWidth={2} />
          新建模板
        </Button>
        <Button disabled={!editor.selectedTemplateId || isSaving} onClick={() => { if (editor.selectedTemplateId) void editor.copyTemplate(editor.selectedTemplateId); }} type="button" variant="outline">
          <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Copy01Icon} strokeWidth={2} />
          复制
        </Button>
      </div>

      {editor.draft ? (
        <div className="flex flex-col gap-4">
          <TemplateNameEditor
            disabled={editor.isSystemTemplate}
            draft={editor.draft}
            error={editor.errors.name}
            onChange={(name) => editor.updateDraft((current) => ({ ...current, name }))}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <FieldTitle>模板字段</FieldTitle>
              <p className="mt-1 text-xs text-muted-foreground">{fields.length} 个字段 · 至少保留一个已启用字段</p>
            </div>
            <Button disabled={editor.isSystemTemplate} onClick={editor.addField} type="button" variant="outline">
              <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Add01Icon} strokeWidth={2} />
              添加字段
            </Button>
          </div>
          <FieldError>{editor.errors.fields}</FieldError>

          <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
            <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
              <ol aria-label="翻译模板字段" className="flex list-none flex-col gap-3 p-0">
                {fields.map((field, index) => (
                  <SortableFieldRow
                    errors={editor.errors}
                    field={field}
                    index={index}
                    key={field.id}
                    onChangeSource={editor.changeFieldSource}
                    onMove={editor.moveField}
                    onRemove={editor.removeField}
                    onToggle={editor.toggleField}
                    onUpdate={editor.updateField}
                    total={fields.length}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <div aria-live="polite" className="text-xs text-muted-foreground" role="status">
              {editor.message}
            </div>
            <div className="flex gap-2">
              <Button disabled={isSaving || editor.isSystemTemplate} onClick={editor.cancelDraft} type="button" variant="ghost">
                <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Refresh01Icon} strokeWidth={2} />
                取消
              </Button>
              <Button disabled={isSaving || editor.isSystemTemplate} onClick={() => void editor.saveDraft()} type="button">
                <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={FloppyDiskIcon} strokeWidth={2} />
                {isSaving ? "保存中" : "保存模板"}
              </Button>
              <Button
                disabled={isSaving || editor.activeTemplateId === editor.selectedTemplateId}
                onClick={() => { if (editor.selectedTemplateId) void editor.setDefaultTemplate(editor.selectedTemplateId); }}
                type="button"
                variant="outline"
              >
                <HugeiconsIcon aria-hidden="true" data-icon="inline-start" icon={Tick02Icon} strokeWidth={2} />
                设为当前
              </Button>
              <Button
                aria-label={`删除模板${editor.draft.name}`}
                disabled={isSaving || editor.isSystemTemplate || !editor.selectedTemplateId}
                onClick={() => { if (editor.selectedTemplateId) void editor.deleteTemplate(editor.selectedTemplateId); }}
                size="icon"
                type="button"
                variant="destructive"
              >
                <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">暂无可编辑模板。</p>
      )}
    </section>
  );
}
