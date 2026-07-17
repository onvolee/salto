import {
  Add01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "salto-src/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "salto-src/components/ui/select";
import { Switch } from "salto-src/components/ui/switch";
import type { SaltoSettings } from "salto-src/theme/theme-settings";

import { TooltipIconButton } from "../components/tooltip-icon-button";
import type { TranslationField, UpdateSetting } from "../types";

const TEMPLATE_OPTIONS: Array<{
  label: string;
  value: SaltoSettings["translationTemplate"];
}> = [
  { label: "精简释义", value: "compact" },
  { label: "上下文阅读", value: "context" },
];

type SelectionSectionProps = {
  addField: () => void;
  fields: TranslationField[];
  moveField: (from: number, to: number) => void;
  removeField: (id: string) => void;
  renameField: (id: string) => void;
  settings: SaltoSettings;
  toggleField: (id: string) => void;
  updateSetting: UpdateSetting;
};

export function SelectionSection({
  addField,
  fields,
  moveField,
  removeField,
  renameField,
  settings,
  toggleField,
  updateSetting,
}: SelectionSectionProps) {
  return (
    <section
      aria-label="划词翻译设置"
      className="flex flex-col gap-3 py-6"
      data-od-id="selection-section"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={TEMPLATE_OPTIONS}
          onValueChange={(value) => {
            if (value) updateSetting("translationTemplate", value);
          }}
          value={settings.translationTemplate}
        >
          <SelectTrigger aria-label="当前翻译模板" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TEMPLATE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="mr-auto text-xs text-muted-foreground">
          {fields.length} 个字段 · 本地编辑
        </span>
        <Button onClick={addField} type="button" variant="outline">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={Add01Icon}
            strokeWidth={2}
          />
          添加字段
        </Button>
      </div>

      <ItemGroup aria-label="翻译模板字段">
        {fields.map((field, index) => (
          <Item
            draggable
            key={field.id}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) =>
              event.dataTransfer.setData("text/plain", String(index))
            }
            onDrop={(event) => {
              const from = Number(event.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) moveField(from, index);
            }}
            role="listitem"
            variant="outline"
          >
            <ItemMedia className="cursor-grab" variant="icon">
              <HugeiconsIcon
                aria-hidden="true"
                icon={DragDropVerticalIcon}
                strokeWidth={2}
              />
            </ItemMedia>
            <ItemContent className="min-w-40">
              <ItemTitle>
                {field.label}
                <Badge variant="secondary">{field.type}</Badge>
              </ItemTitle>
              <ItemDescription>{field.description}</ItemDescription>
              <p className="text-xs text-muted-foreground">
                来源：{field.source} · {field.enabled ? "已启用" : "已停用"}
              </p>
            </ItemContent>
            <ItemActions className="ml-auto flex-wrap justify-end">
              <Switch
                aria-label={`${field.enabled ? "停用" : "启用"}${field.label}`}
                checked={field.enabled}
                onCheckedChange={() => toggleField(field.id)}
              />
              <TooltipIconButton
                icon={Edit02Icon}
                label={`编辑${field.label}`}
                onClick={() => renameField(field.id)}
              />
              <TooltipIconButton
                icon={Delete02Icon}
                label={`删除${field.label}`}
                onClick={() => removeField(field.id)}
                variant="destructive"
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
