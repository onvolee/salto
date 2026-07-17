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
  value: SaltoSettings["language"];
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
          description="用于界面和翻译结果的本地化。"
          id="language"
          title="界面语言"
        >
          <Select
            items={LANGUAGE_OPTIONS}
            onValueChange={(value) => {
              if (value) updateSetting("language", value);
            }}
            value={settings.language}
          >
            <SelectTrigger
              aria-labelledby="language-label"
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
          description="仅发送不包含页面内容和密钥的匿名运行信息。"
          htmlFor="anonymous-diagnostics"
          id="anonymous-diagnostics"
          title="匿名诊断"
        >
          <div className="flex min-h-7 items-center justify-end">
            <Switch
              checked={settings.anonymousDiagnostics}
              id="anonymous-diagnostics"
              onCheckedChange={(checked) =>
                updateSetting("anonymousDiagnostics", checked)
              }
            />
          </div>
        </SettingsField>
      </FieldGroup>
    </section>
  );
}
