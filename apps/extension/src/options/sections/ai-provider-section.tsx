import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import type {
  PromptContextVariable,
  PromptTemplateAnalysis,
} from "@salto/core";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import { FieldGroup } from "salto-src/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "salto-src/components/ui/input-group";
import { Separator } from "salto-src/components/ui/separator";
import { Spinner } from "salto-src/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "salto-src/components/ui/tooltip";

import { SettingsField } from "../components/settings-field";
import type {
  ConnectionStatus,
  LlmDraft,
} from "../hooks/use-options-settings";

type LlmDraftKey = keyof Pick<
  LlmDraft,
  "apiKey" | "baseUrl" | "model" | "temperature"
>;

type AiProviderSectionProps = {
  connectionStatus: ConnectionStatus;
  llm: LlmDraft;
  llmError: string | null;
  promptAnalysis: PromptTemplateAnalysis;
  testConnection: () => Promise<void>;
  updateLlm: <K extends LlmDraftKey>(key: K, value: LlmDraft[K]) => void;
};

const PROMPT_CONTEXT_LABELS: Record<PromptContextVariable, string> = {
  selection: "所选文本",
  sentence: "所在句子",
  paragraphs: "附近段落",
  targetLanguage: "目标语言",
  webTitle: "页面标题",
  webUrl: "页面地址",
  webContent: "页面正文（最多 2000 字符）",
};

export function AiProviderSection({
  connectionStatus,
  llm,
  llmError,
  promptAnalysis,
  testConnection,
  updateLlm,
}: AiProviderSectionProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const isTesting = connectionStatus.status === "testing";

  return (
    <section
      aria-label="AI 服务设置"
      className="flex flex-col gap-5 py-6"
      data-od-id="ai-provider-section"
    >
      <FieldGroup className="gap-0">
        <SettingsField
          description="MVP 仅支持一个活动配置。"
          id="provider"
          title="服务商"
        >
          <div className="flex min-h-8 items-center justify-end">
            <Badge variant="secondary">OpenAI-compatible</Badge>
          </div>
        </SettingsField>
        <Separator />
        <SettingsField
          description="保存或测试时仅申请该地址所属 origin 的访问权限。"
          htmlFor="api-base-url"
          id="api-base-url"
          title="API 地址"
        >
          <InputGroup>
            <InputGroupInput
              aria-invalid={Boolean(llmError)}
              autoComplete="url"
              id="api-base-url"
              name="api-base-url"
              onChange={(event) => updateLlm("baseUrl", event.target.value)}
              required
              spellCheck={false}
              type="url"
              value={llm.baseUrl}
            />
          </InputGroup>
        </SettingsField>
        <Separator />
        <SettingsField
          description={llm.hasApiKey
            ? "密钥已配置。留空会保留现有密钥，填写后将替换。"
            : "首次保存需要填写；保存后不会再次回显。"}
          htmlFor="api-key"
          id="api-key"
          title="API Key"
        >
          <InputGroup>
            <InputGroupInput
              aria-invalid={Boolean(llmError && !llm.hasApiKey && !llm.apiKey)}
              autoComplete="new-password"
              id="api-key"
              name="api-key"
              onChange={(event) => updateLlm("apiKey", event.target.value)}
              placeholder={llm.hasApiKey ? "已配置；输入以替换" : "输入 API Key"}
              spellCheck={false}
              type={apiKeyVisible ? "text" : "password"}
              value={llm.apiKey}
            />
            <InputGroupAddon align="inline-end">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <InputGroupButton
                      aria-label={apiKeyVisible ? "隐藏 API Key" : "显示 API Key"}
                      onClick={() => setApiKeyVisible((visible) => !visible)}
                      size="icon-xs"
                      type="button"
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
          description="填写兼容接口实际提供的模型 ID。"
          htmlFor="model-name"
          id="model-name"
          title="模型名称"
        >
          <InputGroup>
            <InputGroupInput
              aria-invalid={Boolean(llmError && !llm.model.trim())}
              autoComplete="off"
              id="model-name"
              name="model-name"
              onChange={(event) => updateLlm("model", event.target.value)}
              required
              spellCheck={false}
              value={llm.model}
            />
          </InputGroup>
        </SettingsField>
        <Separator />
        <SettingsField
          description="可选，范围 0 到 2；留空使用模型默认值。"
          htmlFor="temperature"
          id="temperature"
          title="Temperature"
        >
          <InputGroup>
            <InputGroupInput
              aria-invalid={Boolean(llmError && llm.temperature)}
              id="temperature"
              inputMode="decimal"
              max="2"
              min="0"
              name="temperature"
              onChange={(event) => updateLlm("temperature", event.target.value)}
              placeholder="默认"
              step="0.1"
              type="number"
              value={llm.temperature}
            />
          </InputGroup>
        </SettingsField>
      </FieldGroup>

      {llmError ? (
        <Alert role="alert" variant="destructive">
          <AlertTitle>配置未保存</AlertTitle>
          <AlertDescription>{llmError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {connectionStatus.message ? (
          <p
            aria-live="polite"
            className={connectionStatus.status === "error"
              ? "flex items-center gap-1.5 text-xs text-destructive"
              : "flex items-center gap-1.5 text-xs text-muted-foreground"}
            role={connectionStatus.status === "error" ? "alert" : "status"}
          >
            {connectionStatus.status === "success" || connectionStatus.status === "error" ? (
              <HugeiconsIcon
                aria-hidden="true"
                icon={connectionStatus.status === "error"
                  ? CancelCircleIcon
                  : CheckmarkCircle02Icon}
                strokeWidth={2}
              />
            ) : null}
            {connectionStatus.message}
          </p>
        ) : null}
        <Button
          disabled={isTesting}
          onClick={() => void testConnection()}
          type="button"
          variant="outline"
        >
          {isTesting ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
          {isTesting ? "测试中" : "保存并测试连接"}
        </Button>
      </div>

      <Alert role="note">
        <HugeiconsIcon
          aria-hidden="true"
          icon={InformationCircleIcon}
          strokeWidth={2}
        />
        <AlertTitle>页面上下文传输</AlertTitle>
        <AlertDescription>
          {promptAnalysis.referencedVariables.length > 0
            ? `当前活动模板会发送：${promptAnalysis.referencedVariables
              .map((variable) => PROMPT_CONTEXT_LABELS[variable])
              .join("、")}。`
            : "当前活动模板不引用页面上下文。"}
          单纯选择文本不会发送请求。
        </AlertDescription>
      </Alert>

      {promptAnalysis.warnings.length > 0 ? (
        <Alert role="status">
          <AlertTitle>模板变量警告</AlertTitle>
          <AlertDescription>
            {promptAnalysis.warnings.map((warning) => (
              <span className="block" key={warning.fieldId}>
                {warning.fieldLabel}：{warning.unknownVariables
                  .map((variable) => `{{${variable}}}`)
                  .join("、")}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
