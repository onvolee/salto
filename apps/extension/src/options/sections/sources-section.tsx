import {
  InformationCircleIcon,
  Loading03Icon,
  TestTubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "salto-src/components/ui/field";
import {
  browserDictionaryPermissionClient,
  browserOptionsDictionaryClient,
  OptionsDictionaryError,
  YOUDAO_PERMISSION_ORIGIN,
  type DictionaryPermissionClient,
  type OptionsDictionaryClient,
} from "../dictionary-client";

type TestStatus = "idle" | "testing" | "success" | "error";

function dictionaryFailureMessage(error: unknown): string {
  if (error instanceof OptionsDictionaryError) {
    if (error.code === "permission-denied") {
      return "有道词典访问权限不可用，请重新测试。";
    }
    if (error.code === "timeout") {
      return "有道词典连接超时，请重新测试。";
    }
  }
  return "有道词典暂时不可用，请重新测试。";
}

export function SourcesSection({
  dictionaryClient = browserOptionsDictionaryClient,
  permissionClient = browserDictionaryPermissionClient,
}: {
  dictionaryClient?: OptionsDictionaryClient;
  permissionClient?: DictionaryPermissionClient;
}) {
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const hasAttempted = status !== "idle";

  const testConnection = async () => {
    setStatus("testing");
    setStatusMessage("");
    try {
      if (!await permissionClient.request(YOUDAO_PERMISSION_ORIGIN)) {
        setStatus("error");
        setStatusMessage("未授予有道词典访问权限，可重新测试。");
        return;
      }
      await dictionaryClient.testConnection();
      setStatus("success");
      setStatusMessage("有道词典连接成功。");
    } catch (error) {
      setStatus("error");
      setStatusMessage(dictionaryFailureMessage(error));
    }
  };

  return (
    <section
      aria-label="翻译源设置"
      className="flex flex-col gap-5 py-6"
      data-od-id="sources-section"
    >
      <FieldGroup className="gap-0">
        <Field
          className="min-h-16 items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
          orientation="responsive"
        >
          <FieldContent className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FieldTitle>有道词典</FieldTitle>
              <Badge className="shrink-0" variant="secondary">
                当前词典
              </Badge>
            </div>
            <FieldDescription>
              用于获取音标、词性、释义、同义词和词形。
            </FieldDescription>
            {statusMessage ? (
              <p
                aria-live="polite"
                className={status === "success"
                  ? "mt-2 text-xs/relaxed text-success"
                  : "mt-2 text-xs/relaxed text-destructive"}
              >
                {statusMessage}
              </p>
            ) : null}
          </FieldContent>
          <Button
            className="shrink-0"
            disabled={status === "testing"}
            onClick={() => void testConnection()}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className={status === "testing" ? "animate-spin" : undefined}
              data-icon="inline-start"
              icon={status === "testing" ? Loading03Icon : TestTubeIcon}
              strokeWidth={2}
            />
            {status === "testing"
              ? "正在测试..."
              : hasAttempted
                ? "重新测试"
                : "启用并测试"}
          </Button>
        </Field>
      </FieldGroup>
      <Alert role="note">
        <HugeiconsIcon
          aria-hidden="true"
          icon={InformationCircleIcon}
          strokeWidth={2}
        />
        <AlertTitle>访问范围</AlertTitle>
        <AlertDescription>
          有道网页请求只在扩展后台执行；设置页不会接收词典页面内容。
        </AlertDescription>
      </Alert>
    </section>
  );
}
