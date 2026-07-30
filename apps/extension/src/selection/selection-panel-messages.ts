import type { QueryFieldResult } from "@salto/core";

type UnavailableFieldResult = Extract<QueryFieldResult, { readonly status: "unavailable" }>;
type FailedFieldResult = Extract<QueryFieldResult, { readonly status: "failed" }>;

const SELECTION_PANEL_CATALOGS = {
  "zh-CN": {
    activeTemplateRecovered: (templateName: string) => `当前模板不可用，已使用 ${templateName}。`,
    missingFieldResult: "缺少字段结果",
    saveFailed: "无法保存划词",
    templateLoadFailed: "无法加载当前模板",
    templateUnavailable: "模板不可用",
    translationRequestFailed: "翻译请求失败",
    translationUnavailable: "翻译不可用",
    unavailableFields: {
      "not-configured": "未配置数据源",
      "not-found": "未找到相关内容",
      unsupported: "当前数据源不支持此字段",
      missing: "暂无内容",
    },
    failedFields: {
      fallback: "字段加载失败",
      codes: {
        "dictionary-parser-failure": "字典结果暂时无法解析",
        "dictionary-timeout": "字典查询超时",
        "dictionary-network": "无法连接字典服务",
        "dictionary-permission-denied": "未授予字典访问权限",
        "dictionary-not-found": "未找到字典词条",
        "llm-authentication": "AI 服务认证失败",
        "llm-model-not-found": "未找到已配置的 AI 模型",
        "llm-rate-limit": "AI 服务请求过于频繁",
        "llm-timeout": "AI 服务请求超时",
        "llm-network": "无法连接 AI 服务",
        "missing-field-result": "数据源未返回此字段",
        "invalid-field-result": "数据源返回了无效字段",
        "invalid-provider-response": "数据源返回了无效结果",
      } satisfies Record<string, string>,
    },
  },
} as const;

export type SelectionPanelLocale = keyof typeof SELECTION_PANEL_CATALOGS;

const DEFAULT_LOCALE: SelectionPanelLocale = "zh-CN";

export function selectionPanelMessages(
  locale: SelectionPanelLocale = DEFAULT_LOCALE,
) {
  return SELECTION_PANEL_CATALOGS[locale];
}

export function unavailableFieldMessage(
  result: UnavailableFieldResult,
  locale: SelectionPanelLocale = DEFAULT_LOCALE,
): string {
  return SELECTION_PANEL_CATALOGS[locale].unavailableFields[result.reason];
}

export function failedFieldMessage(
  result: FailedFieldResult,
  locale: SelectionPanelLocale = DEFAULT_LOCALE,
): string {
  const messages = SELECTION_PANEL_CATALOGS[locale].failedFields;
  return messages.codes[result.error.code as keyof typeof messages.codes] ?? messages.fallback;
}
