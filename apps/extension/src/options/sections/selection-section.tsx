import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Bookmark01Icon,
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  FloppyDiskIcon,
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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  PROMPT_CONTEXT_VARIABLES,
  type DictionaryQueryField,
  type PromptContextVariable,
  type QuerySchemaFieldType,
  type TemplateFieldDefinition,
  type TemplateFieldDefinitionInput,
} from "@salto/core";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "salto-src/components/ui/alert-dialog";
import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "salto-src/components/ui/card";
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
} from "salto-src/components/ui/field";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "salto-src/components/ui/empty";
import { Input } from "salto-src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "salto-src/components/ui/select";
import { Switch } from "salto-src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "salto-src/components/ui/tabs";
import { Textarea } from "salto-src/components/ui/textarea";
import { parseCssDeclarations } from "salto-src/query-template/css-declarations";

import type { useQueryTemplates } from "../hooks/use-query-templates";
import type { useTemplateFieldDefinitions } from "../hooks/use-template-field-definitions";
import type { SelectionView } from "../types";
import type { TemplateFieldDraft } from "../template-editor";

type TemplateEditor = ReturnType<typeof useQueryTemplates>;
type DefinitionEditor = ReturnType<typeof useTemplateFieldDefinitions>;

const DICTIONARY_FIELDS: readonly {
  value: DictionaryQueryField;
  label: string;
  type: QuerySchemaFieldType;
}[] = [
  { value: "phonetic", label: "音标", type: "text" },
  { value: "partOfSpeech", label: "词性", type: "text" },
  { value: "meaning", label: "释义", type: "text" },
  { value: "synonyms", label: "同义词", type: "list" },
  { value: "wordForms", label: "词形", type: "list" },
];

const DEFINITION_SOURCE_LABELS = {
  llm: "llm",
  dictionary: "词典",
} as const;

const DEFINITION_TYPE_LABELS = {
  text: "文本",
  list: "列表",
} as const satisfies Record<QuerySchemaFieldType, string>;

type DefinitionFormState = {
  readonly label: string;
  readonly description: string;
  readonly source: "llm" | "dictionary";
  readonly type: QuerySchemaFieldType;
  readonly instruction: string;
  readonly dictionaryField: DictionaryQueryField;
};

const EMPTY_DEFINITION: DefinitionFormState = {
  label: "",
  description: "",
  source: "llm",
  type: "text",
  instruction: "",
  dictionaryField: "meaning",
};

function formStateFromDefinition(
  definition?: TemplateFieldDefinition,
): DefinitionFormState {
  if (!definition) return EMPTY_DEFINITION;
  return {
    label: definition.label,
    description: definition.description ?? "",
    source: definition.source,
    type: definition.type,
    instruction: definition.source === "llm" ? definition.instruction : "",
    dictionaryField: definition.source === "dictionary"
      ? definition.dictionaryField
      : "meaning",
  };
}

function definitionInputFromState(
  state: DefinitionFormState,
): TemplateFieldDefinitionInput {
  const base = {
    label: state.label.trim(),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
  };
  if (state.source === "llm") {
    return {
      ...base,
      source: "llm",
      type: state.type,
      instruction: state.instruction.trim(),
    };
  }
  const dictionary = DICTIONARY_FIELDS.find(({ value }) =>
    value === state.dictionaryField)!;
  return {
    ...base,
    source: "dictionary",
    dictionaryField: dictionary.value,
    type: dictionary.type,
  } as TemplateFieldDefinitionInput;
}

function DefinitionDialog({
  definition,
  disabled,
  onSave,
}: {
  readonly definition?: TemplateFieldDefinition;
  readonly disabled: boolean;
  readonly onSave: (input: TemplateFieldDefinitionInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(() => formStateFromDefinition(definition));
  const [submitted, setSubmitted] = useState(false);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const pendingInstructionCursorRef = useRef<number | null>(null);
  const labelError = submitted && !state.label.trim() ? "字段名称不能为空" : undefined;
  const instructionError = submitted
    && state.source === "llm"
    && !state.instruction.trim()
    ? "Instruction 不能为空"
    : undefined;

  const update = <K extends keyof DefinitionFormState>(
    key: K,
    value: DefinitionFormState[K],
  ) => setState((current) => ({ ...current, [key]: value }));

  useLayoutEffect(() => {
    const cursor = pendingInstructionCursorRef.current;
    if (cursor === null) return;
    pendingInstructionCursorRef.current = null;
    instructionRef.current?.focus();
    instructionRef.current?.setSelectionRange(cursor, cursor);
  }, [state.instruction]);

  const insertInstructionVariable = (variable: PromptContextVariable) => {
    const token = `{{${variable}}}`;
    const textarea = instructionRef.current;
    const selectionStart = textarea?.selectionStart ?? state.instruction.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    pendingInstructionCursorRef.current = selectionStart + token.length;
    update(
      "instruction",
      state.instruction.slice(0, selectionStart)
        + token
        + state.instruction.slice(selectionEnd),
    );
  };

  const submit = async () => {
    setSubmitted(true);
    if (labelError || instructionError || !state.label.trim()
      || (state.source === "llm" && !state.instruction.trim())) return;
    const saved = await onSave(definitionInputFromState(state));
    if (saved !== null) setOpen(false);
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setState(formStateFromDefinition(definition));
          setSubmitted(false);
        }
        setOpen(nextOpen);
      }}
      open={open}
    >
      <DialogTrigger
        render={definition ? (
          <Button aria-label={`编辑字段定义${definition.label}`} disabled={disabled} size="icon-sm" type="button" variant="ghost">
            <HugeiconsIcon data-icon="inline-start" icon={PencilEdit02Icon} strokeWidth={2} />
          </Button>
        ) : (
          <Button disabled={disabled} type="button">
            <HugeiconsIcon data-icon="inline-start" icon={Add01Icon} strokeWidth={2} />
            新建字段定义
          </Button>
        )}
      />
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{definition ? "编辑字段" : "新建字段"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(labelError)}>
                <FieldLabel htmlFor="definition-label">字段名称</FieldLabel>
                <Input
                  aria-invalid={Boolean(labelError)}
                  id="definition-label"
                  onChange={(event) => update("label", event.target.value)}
                  value={state.label}
                />
                <FieldError>{labelError}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="definition-description">描述（可选）</FieldLabel>
                <Input
                  id="definition-description"
                  onChange={(event) => update("description", event.target.value)}
                  value={state.description}
                />
              </Field>
            </div>
            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="definition-source">来源</FieldLabel>
                <Select
                  items={DEFINITION_SOURCE_LABELS}
                  onValueChange={(value) => update("source", value as DefinitionFormState["source"])}
                  value={state.source}
                >
                  <SelectTrigger className="w-full" id="definition-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem value="llm">{DEFINITION_SOURCE_LABELS.llm}</SelectItem>
                    <SelectItem value="dictionary">{DEFINITION_SOURCE_LABELS.dictionary}</SelectItem>
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
              {state.source === "llm" ? (
                <Field>
                  <FieldLabel htmlFor="definition-type">结果类型</FieldLabel>
                  <Select
                    items={DEFINITION_TYPE_LABELS}
                    onValueChange={(value) => update("type", value as QuerySchemaFieldType)}
                    value={state.type}
                  >
                    <SelectTrigger className="w-full" id="definition-type"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="text">{DEFINITION_TYPE_LABELS.text}</SelectItem>
                      <SelectItem value="list">{DEFINITION_TYPE_LABELS.list}</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="definition-dictionary-field">词典字段</FieldLabel>
                  <Select
                    items={DICTIONARY_FIELDS}
                    onValueChange={(value) => update("dictionaryField", value as DictionaryQueryField)}
                    value={state.dictionaryField}
                  >
                    <SelectTrigger className="w-full" id="definition-dictionary-field"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      {DICTIONARY_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectGroup></SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            {state.source === "llm" ? (
              <Field data-invalid={Boolean(instructionError)}>
                <FieldLabel htmlFor="definition-instruction">Instruction</FieldLabel>
                <Textarea
                  aria-invalid={Boolean(instructionError)}
                  id="definition-instruction"
                  onChange={(event) => update("instruction", event.target.value)}
                  ref={instructionRef}
                  rows={6}
                  value={state.instruction}
                />
                <FieldDescription>内置变量</FieldDescription>
                <div
                  aria-label="Instruction 内置变量"
                  className="flex flex-wrap gap-1.5"
                  role="group"
                >
                  {PROMPT_CONTEXT_VARIABLES.map((variable) => (
                    <Badge
                      aria-label={`插入 {{${variable}}}`}
                      className="font-mono cursor-pointer"
                      key={variable}
                      onClick={() => insertInstructionVariable(variable)}
                      variant="outline"
                    >
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
                <FieldError>{instructionError}</FieldError>
              </Field>
            ) : null}
          </FieldGroup>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>取消</DialogClose>
          <Button disabled={disabled} onClick={() => void submit()} type="button">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDefinitionDialog({
  definition,
  disabled,
  onDelete,
}: {
  readonly definition: TemplateFieldDefinition;
  readonly disabled: boolean;
  readonly onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={
        <Button aria-label={`删除字段定义${definition.label}`} disabled={disabled} size="icon-sm" type="button" variant="destructive" />
      }>
        <HugeiconsIcon data-icon="inline-start" icon={Delete02Icon} strokeWidth={2} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除“{definition.label}”？</AlertDialogTitle>
          <AlertDialogDescription>既有模板中的字段快照会保持不变，此操作无法撤销。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onDelete().then(() => setOpen(false))}
            variant="destructive"
          >确认删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DefinitionLibrary({ editor }: { readonly editor: DefinitionEditor }) {
  const busy = editor.status === "saving";
  return (
    <section aria-label="模板字段库" className="flex flex-col gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Template fields</h3>
          <p className="text-xs text-muted-foreground">管理可复用内容；模板保存的是添加当时的快照。</p>
        </div>
        <DefinitionDialog disabled={busy} onSave={editor.createDefinition} />
      </div>
      {editor.message ? <p className="text-xs text-destructive" role="alert">{editor.message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {editor.definitions.map((definition) => (
          <Card key={definition.id} size="sm">
            <CardHeader>
              <CardTitle>{definition.label}</CardTitle>
              <CardDescription>{definition.description || "无描述"}</CardDescription>
              <CardAction className="flex gap-1">
                <DefinitionDialog
                  definition={definition}
                  disabled={busy}
                  onSave={(input) => editor.updateDefinition(definition.id, input)}
                />
                <DeleteDefinitionDialog
                  definition={definition}
                  disabled={busy}
                  onDelete={() => editor.deleteDefinition(definition.id)}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">{definition.source === "llm" ? "LLM" : "词典"}</Badge>
              <Badge variant="outline">{definition.type === "list" ? "列表" : "文本"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TemplatePreview({
  fields,
  templateName,
}: {
  readonly fields: readonly TemplateFieldDraft[];
  readonly templateName: string;
}) {
  return (
    <div aria-label="当前模板预览" className="overflow-hidden rounded-md border bg-background">
      <div className="relative flex min-h-11 items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
        <span aria-hidden="true" className="absolute left-1/2 h-1 w-8 -translate-x-1/2 bg-border" />
        <p className="max-w-[45%] truncate text-xs font-medium">{templateName}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button aria-label="重新生成模拟翻译" disabled size="icon-sm" type="button" variant="ghost">
            <HugeiconsIcon data-icon="inline-start" icon={Refresh01Icon} strokeWidth={2} />
          </Button>
          <Button aria-label="保存模拟选词" disabled size="icon-sm" type="button" variant="ghost">
            <HugeiconsIcon data-icon="inline-start" icon={Bookmark01Icon} strokeWidth={2} />
          </Button>
          <Button aria-label="关闭模拟面板" disabled size="icon-sm" type="button" variant="ghost">
            <HugeiconsIcon data-icon="inline-start" icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {fields.filter(({ enabled }) => enabled).map((field) => (
          <div key={field.id}>
            <div className="text-xs font-medium" style={parseCssDeclarations(field.keyCss)}>
              {field.content.label}
            </div>
            <div className="mt-1 text-sm" style={parseCssDeclarations(field.valueCss)}>
              {field.content.type === "list" ? (
                <ul className="list-disc pl-5"><li>示例结果一</li><li>示例结果二</li></ul>
              ) : "这是该字段的模拟翻译结果。"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceDialog({
  field,
  fields,
  disabled,
  templateName,
  onUpdate,
}: {
  readonly field: TemplateFieldDraft;
  readonly fields: readonly TemplateFieldDraft[];
  readonly disabled: boolean;
  readonly templateName: string;
  readonly onUpdate: TemplateEditor["updateField"];
}) {
  return (
    <Dialog>
      <DialogTrigger render={
        <Button aria-label={`编辑${field.content.label}外观`} disabled={disabled} size="icon-sm" type="button" variant="ghost" />
      }>
        <HugeiconsIcon data-icon="inline-start" icon={PencilEdit02Icon} strokeWidth={2} />
      </DialogTrigger>
      <DialogContent className="max-h-[min(48rem,calc(100dvh-2rem))] sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{field.content.label} 外观</DialogTitle>
          <DialogDescription>样式保存在当前模板快照中，保存模板后才会持久化。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor={`${field.id}-key-css`}>Key CSS</FieldLabel>
                <Textarea
                  className="min-h-40 font-mono"
                  id={`${field.id}-key-css`}
                  onChange={(event) => onUpdate(field.id, { keyCss: event.target.value })}
                  placeholder="font-weight: 600; color: #111827;"
                  rows={9}
                  value={field.keyCss}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${field.id}-value-css`}>Value CSS</FieldLabel>
                <Textarea
                  className="min-h-40 font-mono"
                  id={`${field.id}-value-css`}
                  onChange={(event) => onUpdate(field.id, { valueCss: event.target.value })}
                  placeholder="line-height: 1.7;"
                  rows={9}
                  value={field.valueCss}
                />
              </Field>
              <Button
                onClick={() => onUpdate(field.id, { keyCss: "", valueCss: "" })}
                type="button"
                variant="outline"
              >
                <HugeiconsIcon data-icon="inline-start" icon={Refresh01Icon} strokeWidth={2} />
                重置当前字段样式
              </Button>
            </FieldGroup>
            <div className="min-w-0 lg:sticky lg:top-0">
              <TemplatePreview fields={fields} templateName={templateName} />
            </div>
          </div>
        </div>
        <DialogFooter><DialogClose render={<Button type="button" />}>完成</DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableField({
  field,
  index,
  fields,
  disabled,
  templateName,
  onMove,
  onRemove,
  onToggle,
  onUpdate,
}: {
  readonly field: TemplateFieldDraft;
  readonly index: number;
  readonly fields: readonly TemplateFieldDraft[];
  readonly disabled: boolean;
  readonly templateName: string;
  readonly onMove: TemplateEditor["moveField"];
  readonly onRemove: TemplateEditor["removeField"];
  readonly onToggle: TemplateEditor["toggleField"];
  readonly onUpdate: TemplateEditor["updateField"];
}) {
  const sortable = useSortable({ id: field.id, disabled });
  const transform = sortable.transform
    ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
    : undefined;
  return (
    <Card
      ref={sortable.setNodeRef}
      size="sm"
      style={{ transform, transition: sortable.transition } as CSSProperties}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <button
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label={`拖动${field.content.label}排序`}
            className="cursor-grab text-muted-foreground disabled:cursor-not-allowed"
            disabled={disabled}
            type="button"
          ><HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2} /></button>
          {field.content.label}
        </CardTitle>
        <CardDescription>{field.content.description || (field.content.source === "llm" ? "LLM 字段快照" : "词典字段快照")}</CardDescription>
        <CardAction className="flex items-center gap-1">
          <AppearanceDialog
            disabled={disabled}
            field={field}
            fields={fields}
            templateName={templateName}
            onUpdate={onUpdate}
          />
          <Button
            aria-label={`上移${field.content.label}`}
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          ><HugeiconsIcon data-icon="inline-start" icon={ArrowUp01Icon} strokeWidth={2} /></Button>
          <Button
            aria-label={`下移${field.content.label}`}
            disabled={disabled || index === fields.length - 1}
            onClick={() => onMove(index, index + 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          ><HugeiconsIcon data-icon="inline-start" icon={ArrowDown01Icon} strokeWidth={2} /></Button>
          <Button
            aria-label={`移除${field.content.label}`}
            disabled={disabled}
            onClick={() => onRemove(field.id)}
            size="icon-sm"
            type="button"
            variant="destructive"
          ><HugeiconsIcon data-icon="inline-start" icon={Delete02Icon} strokeWidth={2} /></Button>
        </CardAction>
      </CardHeader>
      <CardFooter className="justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{field.content.source === "llm" ? "LLM" : "词典"}</Badge>
          <Badge variant="outline">{field.content.type === "list" ? "列表" : "文本"}</Badge>
        </div>
        <Switch
          aria-label={`${field.enabled ? "停用" : "启用"}${field.content.label}`}
          checked={field.enabled}
          disabled={disabled}
          onCheckedChange={() => onToggle(field.id)}
        />
      </CardFooter>
    </Card>
  );
}

function DeleteTemplateDialog({ editor }: { readonly editor: TemplateEditor }) {
  const [open, setOpen] = useState(false);
  const template = editor.templates.find(({ id }) => id === editor.selectedTemplateId);
  if (!template || template.id === "system-default") return null;
  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
        <HugeiconsIcon data-icon="inline-start" icon={Delete02Icon} strokeWidth={2} />删除模板
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除“{template.name}”？</AlertDialogTitle>
          <AlertDialogDescription>模板删除后无法恢复。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void editor.deleteTemplate(template.id).then(() => setOpen(false))}
            variant="destructive"
          >确认删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TemplateComposer({
  activeTemplateId,
  definitions,
  editor,
  onActiveTemplateChange,
}: {
  readonly activeTemplateId: string;
  readonly definitions: readonly TemplateFieldDefinition[];
  readonly editor: TemplateEditor;
  readonly onActiveTemplateChange: (templateId: string) => void;
}) {
  const [definitionId, setDefinitionId] = useState<string | null>(definitions[0]?.id ?? null);
  useEffect(() => {
    if (!definitionId && definitions[0]) setDefinitionId(definitions[0].id);
  }, [definitionId, definitions]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const draft = editor.draft;
  const readOnly = editor.isSystemTemplate;
  const busy = editor.status === "saving";

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!draft || !over || active.id === over.id) return;
    const from = draft.fields.findIndex(({ id }) => id === active.id);
    const to = draft.fields.findIndex(({ id }) => id === over.id);
    editor.moveField(from, to);
  };

  return (
    <section aria-label="划词翻译模板" className="flex flex-col gap-5 py-5">
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-56 flex-1">
          <FieldLabel htmlFor="query-template">当前模板</FieldLabel>
          <Select
            items={editor.templates.map(({ id, name }) => ({ label: name, value: id }))}
            onValueChange={(value) => {
              if (!value) return;
              editor.selectTemplate(value);
              onActiveTemplateChange(value);
            }}
            value={editor.selectedTemplateId ?? activeTemplateId}
          >
            <SelectTrigger aria-label="当前翻译模板" className="w-full" id="query-template"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {editor.templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
              ))}
            </SelectGroup></SelectContent>
          </Select>
        </Field>
        <Button onClick={editor.startNewTemplate} type="button" variant="outline">
          <HugeiconsIcon data-icon="inline-start" icon={Add01Icon} strokeWidth={2} />新建模板
        </Button>
        {editor.selectedTemplateId ? (
          <Button onClick={() => void editor.copyTemplate(editor.selectedTemplateId!)} type="button" variant="outline">
            <HugeiconsIcon data-icon="inline-start" icon={Copy01Icon} strokeWidth={2} />复制
          </Button>
        ) : null}
      </div>

      {draft ? (
        <>
          <Field data-disabled={readOnly} data-invalid={Boolean(editor.errors.name)}>
            <FieldLabel htmlFor="query-template-name">模板名称</FieldLabel>
            <Input
              aria-invalid={Boolean(editor.errors.name)}
              disabled={readOnly}
              id="query-template-name"
              onChange={(event) => editor.updateDraft((current) => ({ ...current, name: event.target.value }))}
              value={draft.name}
            />
            <FieldError>{editor.errors.name}</FieldError>
          </Field>

          <div className="flex flex-wrap items-end gap-2">
            <Field className="min-w-56 flex-1" data-disabled={readOnly}>
              <FieldLabel htmlFor="template-field-definition">添加字段快照</FieldLabel>
              <Select
                items={definitions.map(({ id, label }) => ({ label, value: id }))}
                onValueChange={setDefinitionId}
                value={definitionId}
              >
                <SelectTrigger className="w-full" disabled={readOnly} id="template-field-definition"><SelectValue placeholder="选择字段定义" /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {definitions.map((definition) => (
                    <SelectItem key={definition.id} value={definition.id}>{definition.label}</SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <Button
              disabled={readOnly || !definitionId}
              onClick={() => {
                const definition = definitions.find(({ id }) => id === definitionId);
                if (definition) editor.addField(definition);
              }}
              type="button"
            >
              <HugeiconsIcon data-icon="inline-start" icon={Add01Icon} strokeWidth={2} />添加字段
            </Button>
          </div>

          {editor.errors.fields ? <p className="text-xs text-destructive" role="alert">{editor.errors.fields}</p> : null}
          {draft.fields.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyDescription>从字段库选择一个字段定义开始编排。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
              <SortableContext items={draft.fields.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {draft.fields.map((field, index) => (
                    <SortableField
                      disabled={readOnly}
                      field={field}
                      fields={draft.fields}
                      index={index}
                      key={field.id}
                      templateName={draft.name}
                      onMove={editor.moveField}
                      onRemove={editor.removeField}
                      onToggle={editor.toggleField}
                      onUpdate={editor.updateField}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {editor.message ? <p className="text-xs text-muted-foreground" role="status">{editor.message}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {!readOnly ? <Button onClick={editor.cancelDraft} type="button" variant="outline">取消更改</Button> : null}
            {!readOnly ? <DeleteTemplateDialog editor={editor} /> : null}
            <Button disabled={readOnly || busy} onClick={() => void editor.saveDraft()} type="button">
              <HugeiconsIcon data-icon="inline-start" icon={FloppyDiskIcon} strokeWidth={2} />保存模板
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export function SelectionSection({
  activeTemplateId,
  definitions,
  editor,
  onActiveTemplateChange,
  onViewChange,
  view,
}: {
  readonly activeTemplateId: string;
  readonly definitions: DefinitionEditor;
  readonly editor: TemplateEditor;
  readonly onActiveTemplateChange: (templateId: string) => void;
  readonly onViewChange: (view: SelectionView) => void;
  readonly view: SelectionView;
}) {
  return (
    <Tabs onValueChange={(value) => onViewChange(value as SelectionView)} value={view} className="pt-2">
      <TabsList aria-label="划词翻译设置">
        <TabsTrigger value="templates" className="px-6">翻译模板</TabsTrigger>
        <TabsTrigger value="fields" className="px-6">模板字段</TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <TemplateComposer
          activeTemplateId={activeTemplateId}
          definitions={definitions.definitions}
          editor={editor}
          onActiveTemplateChange={onActiveTemplateChange}
        />
      </TabsContent>
      <TabsContent value="fields"><DefinitionLibrary editor={definitions} /></TabsContent>
    </Tabs>
  );
}
