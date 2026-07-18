import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  FloppyDiskIcon,
  InformationCircleIcon,
  PencilEdit02Icon,
  Refresh01Icon,
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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  parsePromptTemplate,
  PROMPT_CONTEXT_VARIABLES,
  type PromptMalformedReason,
} from "@salto/core";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "salto-src/components/ui/dialog";
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
import {
  switchDraftSource,
  validateTemplateDraft,
  type TemplateFieldDraft,
} from "../template-editor";

type TemplateEditor = ReturnType<typeof useQueryTemplates>;

const PROMPT_VARIABLE_LABELS = {
  selection: "所选文本",
  sentence: "所在句子",
  paragraphs: "附近段落",
  targetLanguage: "目标语言",
  webTitle: "页面标题",
  webUrl: "页面地址",
  webContent: "页面正文",
} as const;

const MALFORMED_REASON_LABELS: Record<PromptMalformedReason, string> = {
  "empty-variable": "变量名为空",
  "invalid-identifier": "变量名格式无效",
  "unmatched-opening-braces": "左括号未配对",
  "unmatched-closing-braces": "右括号未配对",
  "triple-brace-run": "不支持三重括号",
};

function promptWarnings(instruction: string) {
  return parsePromptTemplate(instruction).diagnostics.filter(
    (diagnostic) => diagnostic.kind !== "known",
  );
}

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

type FieldEditorDialogProps = Pick<
  SortableFieldRowProps,
  "errors" | "field" | "onChangeSource" | "onUpdate"
>;

function FieldEditorDialog({
  errors,
  field,
  onChangeSource,
  onUpdate,
}: FieldEditorDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(field);
  const [localErrors, setLocalErrors] = useState<Readonly<Record<string, string>>>({});
  const [editedKeys, setEditedKeys] = useState<readonly string[]>([]);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const position = pendingSelectionRef.current;
    if (position === null) return;
    pendingSelectionRef.current = null;
    instructionRef.current?.focus();
    instructionRef.current?.setSelectionRange(position, position);
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(field);
      setLocalErrors({});
      setEditedKeys([]);
    }
    setOpen(nextOpen);
  };

  const updateDraft = (update: Partial<TemplateFieldDraft>) => {
    const keys = Object.keys(update);
    setDraft((current) => ({ ...current, ...update }));
    setLocalErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key]) => !keys.includes(key)),
    ));
    setEditedKeys((current) => [...new Set([...current, ...keys])]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateTemplateDraft({
      name: "field",
      fields: [{ ...draft, enabled: true, order: 0 }],
    });
    if (!validation.success) {
      const nextErrors = validation.errors.field[field.id] ?? {};
      setLocalErrors(nextErrors);
      const firstError = ["label", "dictionaryField", "type", "instruction"]
        .find((key) => nextErrors[key]);
      const control = firstError === "dictionaryField" || firstError === "type"
        ? "dictionary"
        : firstError;
      if (control) document.getElementById(`${field.id}-edit-${control}`)?.focus();
      return;
    }
    if (draft.source !== field.source && !onChangeSource(field.id, draft.source)) return;
    onUpdate(field.id, draft);
    setOpen(false);
  };

  const error = (key: string) => localErrors[key]
    ?? (editedKeys.includes(key) ? undefined : fieldError(errors, field.id, key));
  const labelError = error("label");
  const instructionError = error("instruction");
  const dictionaryError = error("dictionaryField");
  const typeError = error("type");
  const variableWarnings = draft.source === "llm"
    ? promptWarnings(draft.instruction)
    : [];
  const instructionErrorId = `${field.id}-edit-instruction-error`;
  const instructionWarningId = `${field.id}-edit-instruction-warning`;

  const insertVariable = (variable: string) => {
    if (!PROMPT_CONTEXT_VARIABLES.some((candidate) => candidate === variable)) return;
    const textarea = instructionRef.current;
    const instruction = textarea?.value ?? draft.instruction;
    const start = textarea?.selectionStart ?? instruction.length;
    const end = textarea?.selectionEnd ?? start;
    const token = `{{${variable}}}`;
    pendingSelectionRef.current = start + token.length;
    updateDraft({
      instruction: instruction.slice(0, start) + token + instruction.slice(end),
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={(
          <Button
            aria-label={`编辑${field.label || "字段"}`}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        )}
      >
        <HugeiconsIcon aria-hidden="true" icon={PencilEdit02Icon} strokeWidth={2} />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>编辑字段</DialogTitle>
            <DialogDescription>字段 {field.order + 1}</DialogDescription>
          </DialogHeader>

          <FieldGroup className="max-h-[calc(min(85vh,42rem)-8rem)] overflow-y-auto p-5">
            <Field data-invalid={Boolean(labelError)}>
              <FieldLabel htmlFor={`${field.id}-edit-label`}>Label</FieldLabel>
              <Input
                aria-describedby={labelError ? `${field.id}-edit-label-error` : undefined}
                aria-invalid={Boolean(labelError)}
                autoComplete="off"
                id={`${field.id}-edit-label`}
                name="label"
                onChange={(event) => updateDraft({ label: event.target.value })}
                value={draft.label}
              />
              <FieldError id={`${field.id}-edit-label-error`}>{labelError}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${field.id}-edit-source`}>来源</FieldLabel>
              <Select
                items={[
                  { label: "LLM", value: "llm" },
                  { label: "词典", value: "dictionary" },
                ]}
                onValueChange={(value) => {
                  if (value === "llm" || value === "dictionary") {
                    setDraft((current) => switchDraftSource(current, value));
                    setLocalErrors({});
                    setEditedKeys((current) => [
                      ...new Set([...current, "source", "type", "instruction", "dictionaryField"]),
                    ]);
                  }
                }}
                name="source"
                value={draft.source}
              >
                <SelectTrigger id={`${field.id}-edit-source`}>
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

            {draft.source === "llm" ? (
              <Field>
                <FieldLabel htmlFor={`${field.id}-edit-type`}>类型</FieldLabel>
                <Select
                  items={[{ label: "文本", value: "text" }, { label: "列表", value: "list" }]}
                  onValueChange={(value) => {
                    if (value === "text" || value === "list") updateDraft({ type: value });
                  }}
                  name="type"
                  value={draft.type}
                >
                  <SelectTrigger id={`${field.id}-edit-type`}>
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
                <FieldLabel htmlFor={`${field.id}-edit-dictionary`}>词典字段</FieldLabel>
                <Select
                  items={DICTIONARY_FIELDS.map(({ label, value }) => ({ label, value }))}
                  onValueChange={(value) => {
                    const option = DICTIONARY_FIELDS.find((candidate) => candidate.value === value);
                    if (option) updateDraft({ dictionaryField: option.value, type: option.type });
                  }}
                  name="dictionaryField"
                  value={draft.dictionaryField}
                >
                  <SelectTrigger
                    aria-describedby={dictionaryError || typeError ? `${field.id}-edit-dictionary-error` : undefined}
                    aria-invalid={Boolean(dictionaryError || typeError)}
                    id={`${field.id}-edit-dictionary`}
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
                <FieldDescription>类型：{draft.type === "list" ? "列表" : "文本"}</FieldDescription>
                <FieldError id={`${field.id}-edit-dictionary-error`}>{dictionaryError ?? typeError}</FieldError>
              </Field>
            )}

            {draft.source === "llm" ? (
              <Field data-invalid={Boolean(instructionError)}>
                <FieldLabel htmlFor={`${field.id}-edit-instruction`}>Instruction</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium" htmlFor={`${field.id}-edit-variable`}>
                    插入变量
                  </label>
                  <select
                    className="h-8 min-w-48 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    id={`${field.id}-edit-variable`}
                    name="promptVariable"
                    onChange={(event) => insertVariable(event.target.value)}
                    value=""
                  >
                    <option value="">选择变量</option>
                    {PROMPT_CONTEXT_VARIABLES.map((variable) => (
                      <option key={variable} value={variable}>
                        {variable} · {PROMPT_VARIABLE_LABELS[variable]}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  aria-describedby={[
                    instructionError ? instructionErrorId : null,
                    variableWarnings.length > 0 ? instructionWarningId : null,
                  ].filter(Boolean).join(" ") || undefined}
                  aria-invalid={Boolean(instructionError)}
                  autoComplete="off"
                  id={`${field.id}-edit-instruction`}
                  name="instruction"
                  onChange={(event) => updateDraft({ instruction: event.target.value })}
                  ref={instructionRef}
                  rows={5}
                  value={draft.instruction}
                />
                <FieldError id={instructionErrorId}>{instructionError}</FieldError>
                {variableWarnings.length > 0 ? (
                  <Alert id={instructionWarningId} role="note">
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={InformationCircleIcon}
                      strokeWidth={2}
                    />
                    <AlertTitle>变量警告（仍可保存）</AlertTitle>
                    <AlertDescription>
                      {variableWarnings.map((warning) => (
                        <span className="block" key={`${warning.start}:${warning.end}`}>
                          {warning.kind === "unknown"
                            ? `未知变量：{{${warning.variable}}}`
                            : `畸形变量：${warning.raw}（${MALFORMED_REASON_LABELS[warning.reason]}）`}
                        </span>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </Field>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>取消</DialogClose>
            <Button type="submit">应用</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const hasErrors = Boolean(errors.field[field.id]);
  const variableWarningCount = field.source === "llm"
    ? promptWarnings(field.instruction).length
    : 0;

  return (
    <li
      className="rounded-md border border-border/70 bg-background p-3 has-[[data-field-error]]:border-destructive/60"
      ref={sortable.setNodeRef}
      style={style}
    >
      <div className="flex w-full items-center gap-2">
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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="max-w-full truncate text-xs font-medium">{field.label || `字段 ${index + 1}`}</span>
            <Badge variant="secondary">{field.source === "llm" ? "LLM" : "词典"}</Badge>
            <Badge variant="outline">{field.type === "list" ? "列表" : "文本"}</Badge>
          </div>
          {hasErrors ? (
            <p className="mt-1 text-xs text-destructive" data-field-error>字段配置有误</p>
          ) : null}
          {variableWarningCount > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <HugeiconsIcon aria-hidden="true" icon={InformationCircleIcon} strokeWidth={2} />
              {variableWarningCount} 个变量警告（仍可保存）
            </p>
          ) : null}
        </div>
        <Switch
          aria-label={`${field.enabled ? "停用" : "启用"}${field.label || "字段"}`}
          checked={field.enabled}
          onCheckedChange={() => onToggle(field.id)}
        />
        <FieldEditorDialog
          errors={errors}
          field={field}
          onChangeSource={onChangeSource}
          onUpdate={onUpdate}
        />
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

type SelectionSectionProps = {
  readonly activeTemplateId: string;
  readonly editor: TemplateEditor;
  readonly onActiveTemplateChange: (templateId: string) => void;
};

export function SelectionSection({
  activeTemplateId,
  editor,
  onActiveTemplateChange,
}: SelectionSectionProps) {
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
          <Select items={editor.templates.map((template) => ({ label: template.name, value: template.id }))} onValueChange={(value) => {
            if (!value) return;
            editor.selectTemplate(value);
            onActiveTemplateChange(value);
          }} value={editor.selectedTemplateId ?? ""}>
            <SelectTrigger aria-label="当前翻译模板" id="query-template">
              <SelectValue placeholder="选择模板" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {editor.templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span>{template.name}</span>
                    {activeTemplateId === template.id ? <Badge variant="success">当前</Badge> : null}
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
