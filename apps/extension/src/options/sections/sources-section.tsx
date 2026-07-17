import { useState } from "react";
import { CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Button } from "salto-src/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "salto-src/components/ui/field";
import { Separator } from "salto-src/components/ui/separator";
import { Switch } from "salto-src/components/ui/switch";

import { TRANSLATION_PROVIDERS } from "../data";

type Provider = (typeof TRANSLATION_PROVIDERS)[number];

function ProviderField({ provider }: { provider: Provider }) {
  const [enabled, setEnabled] = useState(provider.enabled);
  const [tested, setTested] = useState(false);
  const labelId = `${provider.id}-label`;

  return (
    <Field
      className="min-h-16 items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
      orientation="responsive"
    >
      <FieldContent className="min-w-0">
        <FieldTitle id={labelId}>{provider.name}</FieldTitle>
        <FieldDescription>{provider.detail}</FieldDescription>
      </FieldContent>
      <div className="flex w-full items-center justify-end gap-2 sm:max-w-72">
        <Button
          onClick={() => setTested(true)}
          type="button"
          variant="ghost"
        >
          {tested ? (
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={CheckmarkCircle02Icon}
              strokeWidth={2}
            />
          ) : null}
          {tested ? "连接正常" : provider.testLabel}
        </Button>
        <Switch
          aria-labelledby={labelId}
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    </Field>
  );
}

export function SourcesSection() {
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
            <ProviderField provider={provider} />
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
