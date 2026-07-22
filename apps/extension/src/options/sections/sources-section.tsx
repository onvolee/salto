import {
  InformationCircleIcon,
  Loading03Icon,
  TestTubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, type ReactNode } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Badge } from "salto-src/components/ui/badge";
import { Button } from "salto-src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "salto-src/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "salto-src/components/ui/field";
import { Input } from "salto-src/components/ui/input";
import { Label } from "salto-src/components/ui/label";
import {
  browserDictionaryPermissionClient,
  browserOptionsDictionaryClient,
  OptionsDictionaryError,
  YOUDAO_PERMISSION_ORIGIN,
  type DictionaryPermissionClient,
  type OptionsDictionaryClient,
  type YoudaoTestPreview,
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
    if (error.code === "network") {
      return "无法连接有道词典，请检查网络后重新测试。";
    }
    if (error.code === "not-found") {
      return "未找到该测试词的有道结果，请修改后重新测试。";
    }
    if (error.code === "parser-failure") {
      return "有道词典结果无法解析，请稍后重新测试。";
    }
  }
  return "有道词典暂时不可用，请重新测试。";
}

const PREVIEW_SECTION_TITLES = {
  basic: "基础释义",
  "word-forms": "词形变化",
  "web-or-specialized": "网络或专业释义",
  "english-or-bilingual": "英英或双语释义",
  phrases: "词组短语",
  synonyms: "近义词辨析",
  examples: "例句",
} as const;

function renderPreviewEntries(section: YoudaoTestPreview["sections"][number]): ReactNode {
  if (section.kind === "word-forms") {
    return section.entries.map(({ label, value }, index) => (
      <li className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3" key={`${label}-${index}`}>
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </li>
    ));
  }
  if (section.kind === "phrases") {
    return section.entries.map(({ phrase, meaning }, index) => (
      <li className="flex flex-col gap-0.5" key={`${phrase}-${meaning ?? ""}-${index}`}>
        <span className="font-medium">{phrase}</span>
        {meaning ? <span>{meaning}</span> : null}
      </li>
    ));
  }
  if (section.kind === "examples") {
    return section.entries.map(({ english, chinese, source }, index) => (
      <li className="flex flex-col gap-0.5" key={`${english}-${source ?? ""}-${index}`}>
        <span>{english}</span>
        {chinese ? <span>{chinese}</span> : null}
        {source ? <span className="text-xs text-muted-foreground">{source}</span> : null}
      </li>
    ));
  }
  return section.entries.map((entry, index) => <li key={`${section.kind}-${index}`}>{entry}</li>);
}

export function SourcesSection({
  dictionaryClient = browserOptionsDictionaryClient,
  permissionClient = browserDictionaryPermissionClient,
  preview: externalPreview,
  onPreviewChange,
}: {
  dictionaryClient?: OptionsDictionaryClient;
  permissionClient?: DictionaryPermissionClient;
  preview?: YoudaoTestPreview | null;
  onPreviewChange?: (preview: YoudaoTestPreview) => void;
}) {
  const [status, setStatus] = useState<TestStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [term, setTerm] = useState("example");
  const [localPreview, setLocalPreview] = useState<YoudaoTestPreview | null>(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const hasAttempted = status !== "idle";
  const preview = externalPreview === undefined ? localPreview : externalPreview;

  const testConnection = async () => {
    setStatus("testing");
    setStatusMessage("");
    try {
      if (!await permissionClient.request(YOUDAO_PERMISSION_ORIGIN)) {
        setStatus("error");
        setStatusMessage("未授予有道词典访问权限，可重新测试。");
        return;
      }
      const nextPreview = await dictionaryClient.testConnection(term.trim());
      if (onPreviewChange) {
        onPreviewChange(nextPreview);
      } else {
        setLocalPreview(nextPreview);
      }
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
            <div className="mt-3 flex max-w-sm items-center gap-2">
              <Label className="shrink-0 text-xs" htmlFor="youdao-test-term">
                测试词
              </Label>
              <Input
                autoComplete="off"
                id="youdao-test-term"
                name="youdao-test-term"
                onChange={(event) => setTerm(event.target.value)}
                required
                spellCheck={false}
                value={term}
              />
            </div>
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
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {preview ? (
              <Button onClick={() => setPreviewOpen(true)} type="button" variant="outline">
                查看结果
              </Button>
            ) : null}
            <Button
              disabled={status === "testing" || !term.trim()}
              onClick={() => void testConnection()}
              type="button"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className={status === "testing" ? "animate-spin motion-reduce:animate-none" : undefined}
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
          </div>
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
      {preview ? (
        <Dialog onOpenChange={setPreviewOpen} open={isPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview.term}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-testid="youdao-preview-scroll">
              <div className="flex flex-col gap-5 pb-2">
                {preview.sections.map((section) => (
                  <section key={section.kind}>
                    <h2 className="text-sm font-medium">
                      {PREVIEW_SECTION_TITLES[section.kind]}
                    </h2>
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6">
                      {renderPreviewEntries(section)}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
