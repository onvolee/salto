import type { SaltoSettings } from "salto-src/theme/theme-settings";

export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "通用",
    description: "调整界面外观、语言和隐私偏好。",
  },
  {
    id: "selection",
    label: "划词翻译",
    description: "配置划词结果的模板和字段顺序。",
  },
  {
    id: "sources",
    label: "翻译源",
    description: "管理词典和翻译服务的启用状态。",
  },
  {
    id: "ai-provider",
    label: "AI 服务",
    description: "配置兼容服务地址、密钥和模型。",
  },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export type SaveStatus =
  | "synced"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

export type TranslationField = {
  id: string;
  label: string;
  type: string;
  source: string;
  description: string;
  enabled: boolean;
};

export type UpdateSetting = <K extends keyof SaltoSettings>(
  key: K,
  value: SaltoSettings[K],
) => void;
