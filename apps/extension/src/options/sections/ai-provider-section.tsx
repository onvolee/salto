import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import {
  FieldGroup,
} from "salto-src/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "salto-src/components/ui/input-group";
import { Button } from "salto-src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "salto-src/components/ui/select";
import { Separator } from "salto-src/components/ui/separator";
import { Spinner } from "salto-src/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "salto-src/components/ui/tooltip";
import type { SaltoSettings } from "salto-src/theme/theme-settings";

import { SettingsField } from "../components/settings-field";
import { useModelDiscovery } from "../hooks/use-model-discovery";
import type { UpdateSetting } from "../types";

const PROVIDER_OPTIONS: Array<{
  label: string;
  value: SaltoSettings["provider"];
}> = [
  { label: "OpenAI-compatible", value: "openai-compatible" },
  { label: "Browser AI（实验性）", value: "browser-ai" },
];

type AiProviderSectionProps = {
  settings: SaltoSettings;
  updateSetting: UpdateSetting;
};

export function AiProviderSection({
  settings,
  updateSetting,
}: AiProviderSectionProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const { fetchModels, isLoading, message } = useModelDiscovery(
    settings.apiBaseUrl,
    settings.apiKey,
  );

  return (
    <section
      aria-label="AI 服务设置"
      className="py-6"
      data-od-id="ai-provider-section"
    >
      <FieldGroup className="gap-0">
        <SettingsField
          description="当前支持一个活动配置。"
          id="provider"
          title="服务商"
        >
          <Select
            items={PROVIDER_OPTIONS}
            onValueChange={(value) => {
              if (value) updateSetting("provider", value);
            }}
            value={settings.provider}
          >
            <SelectTrigger
              aria-labelledby="provider-label"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROVIDER_OPTIONS.map((option) => (
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
          description="后台服务发起请求，内容脚本不会读取密钥。"
          htmlFor="api-base-url"
          id="api-base-url"
          title="API 地址"
        >
          <InputGroup>
            <InputGroupInput
              id="api-base-url"
              className="w-60"
              onChange={(event) =>
                updateSetting("apiBaseUrl", event.target.value)
              }
              spellCheck={false}
              type="url"
              value={settings.apiBaseUrl}
            />
          </InputGroup>
        </SettingsField>
        <Separator />
        <SettingsField
          description="仅保存在扩展本地存储中。"
          htmlFor="api-key"
          id="api-key"
          title="API Key"
        >
          <InputGroup>
            <InputGroupInput
              autoComplete="off"
              id="api-key"
              onChange={(event) => updateSetting("apiKey", event.target.value)}
              placeholder="输入 API Key"
              className="w-53"
              spellCheck={false}
              type={apiKeyVisible ? "text" : "password"}
              value={settings.apiKey}
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <InputGroupButton
                      aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                      onClick={() => setApiKeyVisible((visible) => !visible)}
                      size="icon-xs"
                    />
                  }
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={apiKeyVisible ? ViewOffIcon : ViewIcon}
                    strokeWidth={2}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                </TooltipContent>
              </Tooltip>
            </InputGroupAddon>
          </InputGroup>
        </SettingsField>
        <Separator />
        <SettingsField
          description="可手动输入，也可从兼容接口获取模型列表。"
          htmlFor="model-name"
          id="model-name"
          title="模型名称"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput
                  id="model-name"
                  className="w-41"
                  onChange={(event) =>
                    updateSetting("modelName", event.target.value)
                  }
                  spellCheck={false}
                  value={settings.modelName}
                />
              </InputGroup>
              <Button
                disabled={isLoading}
                onClick={() => void fetchModels()}
                variant="outline"
              >
                {isLoading ? (
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                ) : null}
                获取模型
              </Button>
            </div>
            {message ? (
              <p aria-live="polite" className="text-xs text-muted-foreground" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </SettingsField>
      </FieldGroup>
    </section>
  );
}
