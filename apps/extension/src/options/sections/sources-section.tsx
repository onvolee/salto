import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Badge } from "salto-src/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "salto-src/components/ui/field";
import { Separator } from "salto-src/components/ui/separator";
import { TRANSLATION_PROVIDERS } from "../data";

type Provider = (typeof TRANSLATION_PROVIDERS)[number];

function ProviderField({
  configured,
  provider,
}: {
  configured: boolean;
  provider: Provider;
}) {
  const isAiProvider = provider.id === "ai-translation";
  return (
    <Field
      className="min-h-16 items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
      orientation="responsive"
    >
      <FieldContent className="min-w-0">
        <FieldTitle>{provider.name}</FieldTitle>
        <FieldDescription>{provider.detail}</FieldDescription>
      </FieldContent>
      <Badge className="shrink-0" variant={isAiProvider && configured ? "default" : "secondary"}>
        {isAiProvider ? (configured ? "已配置" : "未配置") : "后续阶段"}
      </Badge>
    </Field>
  );
}

export function SourcesSection({ aiConfigured }: { aiConfigured: boolean }) {
  return (
    <section
      aria-label="翻译源设置"
      className="flex flex-col gap-5 py-6"
      data-od-id="sources-section"
    >
      <FieldGroup className="gap-0">
        {TRANSLATION_PROVIDERS.map((provider, index) => (
          <div className="contents" key={provider.id}>
            {index > 0 ? <Separator /> : null}
            <ProviderField configured={aiConfigured} provider={provider} />
          </div>
        ))}
      </FieldGroup>
      <Alert role="note">
        <HugeiconsIcon
          aria-hidden="true"
          icon={InformationCircleIcon}
          strokeWidth={2}
        />
        <AlertTitle>密钥隔离</AlertTitle>
        <AlertDescription>
          翻译源只作为查询模板字段的来源。API Key
          由后台请求路径读取，内容脚本不会接触密钥。
        </AlertDescription>
      </Alert>
    </section>
  );
}
