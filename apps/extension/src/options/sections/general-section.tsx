import type { SaltoSettings, ThemeMode } from "salto-src/theme/theme-settings";

import { FieldGroup } from "salto-src/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "salto-src/components/ui/select";
import { Separator } from "salto-src/components/ui/separator";
import { Switch } from "salto-src/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "salto-src/components/ui/toggle-group";

import { SettingsField } from "../components/settings-field";
import type { UpdateSetting } from "../types";

const THEME_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: "跟随系统", value: "system" },
  { label: "深色", value: "dark" },
  { label: "浅色", value: "light" },
];

const LANGUAGE_OPTIONS: Array<{
  label: string;
  value: SaltoSettings["targetLanguage"];
}> = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
];

type GeneralSectionProps = {
  settings: SaltoSettings;
  updateSetting: UpdateSetting;
};

export function GeneralSection({
  settings,
  updateSetting,
}: GeneralSectionProps) {
  return (
    <section
      aria-label="通用设置"
      className="py-6"
      data-od-id="general-section"
    >
      <FieldGroup className="gap-0">
        <SettingsField
          description="默认跟随系统，也可以固定一种主题。"
          id="theme-mode"
          title="主题模式"
        >
          <ToggleGroup
            aria-labelledby="theme-mode-label"
            className="grid w-full grid-cols-3"
            onValueChange={(values) => {
              const themeMode = values[0] as ThemeMode | undefined;
              if (themeMode) updateSetting("themeMode", themeMode);
            }}
            spacing={0}
            value={[settings.themeMode]}
            variant="outline"
          >
            {THEME_OPTIONS.map((option) => (
              <ToggleGroupItem
                className="w-full"
                key={option.value}
                value={option.value}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingsField>
        <Separator />
        <SettingsField
          description="用于划词翻译和 AI 输出；设置界面固定使用中文。"
          id="target-language"
          title="目标翻译语言"
        >
          <Select
            items={LANGUAGE_OPTIONS}
            onValueChange={(value) => {
              if (value) updateSetting("targetLanguage", value);
            }}
            value={settings.targetLanguage}
          >
            <SelectTrigger
              aria-labelledby="target-language-label"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </SettingsField>
        <Separator />
        <SettingsField
          description="在网页中标记已保存的词汇；关闭后现有标记会被移除。"
          htmlFor="highlight-saved-vocabulary"
          id="highlight-saved-vocabulary"
          title="高亮已保存词汇"
        >
          <div className="flex min-h-7 items-center justify-end">
            <Switch
              checked={settings.highlightEnabled}
              id="highlight-saved-vocabulary"
              onCheckedChange={(checked) => {
                updateSetting("highlightEnabled", checked);
              }}
            />
          </div>
        </SettingsField>
        <Separator />
        <SettingsField
          description="开启后高亮网页中所有相同的单词；关闭后仅标记保存时的原始位置。"
          htmlFor="highlight-same-words"
          id="highlight-same-words"
          title="高亮相同单词"
        >
          <div className="flex min-h-7 items-center justify-end">
            <Switch
              checked={settings.highlightSameWords}
              disabled={!settings.highlightEnabled}
              id="highlight-same-words"
              onCheckedChange={(checked) => {
                updateSetting("highlightSameWords", checked);
              }}
            />
          </div>
        </SettingsField>
      </FieldGroup>
    </section>
  );
}
