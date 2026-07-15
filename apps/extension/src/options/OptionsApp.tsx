import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";

import { Bookmark01Icon, TranslateIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  subscribeToSettings,
  type SaltoSettings,
  type ThemeMode,
} from "salto-src/theme/theme-settings";

const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: "dark", label: "深色", description: "Linear 默认外观" },
  { value: "system", label: "跟随系统", description: "根据设备设置切换" },
  { value: "light", label: "浅色", description: "适合明亮环境" },
];

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-field">
      <div className="settings-field__copy">
        <span className="settings-field__label">{label}</span>
        <p className="settings-field__description">{description}</p>
      </div>
      <div className="settings-field__control">{children}</div>
    </div>
  );
}

export function OptionsApp() {
  const [settings, setSettings] = useState<SaltoSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("本地保存");

  useEffect(() => {
    let isMounted = true;

    void loadSettings().then((storedSettings) => {
      if (isMounted) {
        setSettings(storedSettings);
        setIsLoaded(true);
      }
    });

    const unsubscribe = subscribeToSettings((storedSettings) => {
      if (isMounted) {
        setSettings(storedSettings);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

  const updateSetting = <Key extends keyof SaltoSettings>(key: Key, value: SaltoSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveMessage("有未保存更改");
  };

  const handleTextChange = (key: "apiBaseUrl" | "apiKey") => (event: ChangeEvent<HTMLInputElement>) => {
    updateSetting(key, event.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveSettings(settings);
    setIsSaving(false);
    setSaveMessage("已保存");
  };

  return (
    <main className="options-page" data-theme={settings.themeMode} data-od-id="options-page">
      <aside className="options-sidebar" data-od-id="settings-sidebar">
        <a className="brand-lockup" href="#top" data-od-id="brand-lockup">
          <span className="brand-lockup__mark" aria-hidden="true">
            <HugeiconsIcon icon={TranslateIcon} size={17} strokeWidth={1.8} />
          </span>
          <span>
            <strong>Salto</strong>
            <small>阅读中的词汇助手</small>
          </span>
        </a>

        <nav aria-label="设置导航" className="settings-nav">
          <a className="settings-nav__link settings-nav__link--active" href="#appearance">
            <span className="settings-nav__dot" aria-hidden="true" />外观
          </a>
          <a className="settings-nav__link" href="#translation">翻译</a>
          <a className="settings-nav__link" href="#provider">AI Provider</a>
          <a className="settings-nav__link" href="#privacy">数据与隐私</a>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>本地优先</span>
          <span className="sidebar-footer__version">v0.1</span>
        </div>
      </aside>

      <div className="options-content" id="top">
        <header className="options-header" data-od-id="settings-header">
          <div>
            <p className="options-overline">通用配置</p>
            <h1>设置</h1>
            <p className="options-lead">调整 Salto 在阅读页面上的外观与连接方式。</p>
          </div>
          <div className={`save-state ${saveMessage === "已保存" ? "save-state--saved" : ""}`} role="status">
            <span className="save-state__dot" aria-hidden="true" />
            {isLoaded ? saveMessage : "读取中"}
          </div>
        </header>

        <div className="settings-sections">
          <section className="settings-section" id="appearance" data-od-id="appearance-settings">
            <div className="settings-section__heading">
              <h2>外观</h2>
              <p>选择适合当前阅读环境的界面明暗。</p>
            </div>
            <div className="settings-panel">
              <Field label="主题模式" description="默认使用 Linear 深色主题，减少夜间阅读干扰。">
                <div className="theme-options" data-od-id="theme-mode" role="radiogroup" aria-label="主题模式">
                  {themeOptions.map((option) => (
                    <label className={`theme-option ${settings.themeMode === option.value ? "theme-option--selected" : ""}`} key={option.value}>
                      <input
                        checked={settings.themeMode === option.value}
                        name="theme-mode"
                        onChange={() => updateSetting("themeMode", option.value)}
                        type="radio"
                        value={option.value}
                      />
                      <span className="theme-option__sample" aria-hidden="true" data-theme-sample={option.value} />
                      <span className="theme-option__text">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className="settings-section" id="translation" data-od-id="translation-settings">
            <div className="settings-section__heading">
              <h2>翻译</h2>
              <p>让翻译结果保持短、快、贴近上下文。</p>
            </div>
            <div className="settings-panel">
              <Field label="界面语言" description="设置 Salto 设置页与浮动面板的显示语言。">
                <select
                  aria-label="界面语言"
                  className="settings-select"
                  data-od-id="language-select"
                  onChange={(event) => updateSetting("language", event.target.value as SaltoSettings["language"])}
                  value={settings.language}
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </Field>
              <Field label="翻译模板" description="控制选中文本在面板中显示的解释密度。">
                <select
                  aria-label="翻译模板"
                  className="settings-select"
                  data-od-id="translation-template-select"
                  onChange={(event) => updateSetting("translationTemplate", event.target.value as SaltoSettings["translationTemplate"])}
                  value={settings.translationTemplate}
                >
                  <option value="compact">紧凑释义</option>
                  <option value="context">释义 + 上下文</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="settings-section" id="provider" data-od-id="provider-settings">
            <div className="settings-section__heading">
              <h2>AI Provider</h2>
              <p>为需要上下文解释的内容选择请求路径。</p>
            </div>
            <div className="settings-panel">
              <Field label="当前 Provider" description="API 密钥仅保存在本机的扩展存储中。">
                <select
                  aria-label="当前 Provider"
                  className="settings-select"
                  data-od-id="provider-select"
                  onChange={(event) => updateSetting("provider", event.target.value as SaltoSettings["provider"])}
                  value={settings.provider}
                >
                  <option value="openai-compatible">OpenAI 兼容接口</option>
                  <option value="browser-ai">浏览器内置 AI（实验性）</option>
                </select>
              </Field>
              {settings.provider === "openai-compatible" && (
                <>
                  <Field label="API Base URL" description="支持 OpenAI Chat Completions 格式的接口地址。">
                    <input
                      aria-label="API Base URL"
                      className="settings-input"
                      data-od-id="api-base-url"
                      onChange={handleTextChange("apiBaseUrl")}
                      placeholder="https://api.openai.com/v1"
                      type="url"
                      value={settings.apiBaseUrl}
                    />
                  </Field>
                  <Field label="API Key" description="留空时不会发起 AI 请求。">
                    <input
                      aria-label="API Key"
                      className="settings-input"
                      data-od-id="api-key"
                      onChange={handleTextChange("apiKey")}
                      placeholder="sk-..."
                      type="password"
                      value={settings.apiKey}
                    />
                  </Field>
                </>
              )}
              {settings.provider === "browser-ai" && (
                <div className="inline-note" role="note">
                  <span className="inline-note__mark" aria-hidden="true">i</span>
                  当前浏览器尚未提供可用的 Prompt API，Salto 会继续使用基础翻译流程。
                </div>
              )}
            </div>
          </section>

          <section className="settings-section" id="privacy" data-od-id="privacy-settings">
            <div className="settings-section__heading">
              <h2>数据与隐私</h2>
              <p>Salto 默认把数据留在本机，不建立账号依赖。</p>
            </div>
            <div className="settings-panel">
              <div className="privacy-row">
                <div className="settings-field__copy">
                  <span className="settings-field__label">匿名诊断信息</span>
                  <p className="settings-field__description">帮助改进稳定性，不包含选中的原文或 API Key。</p>
                </div>
                <label className="switch-control">
                  <input
                    aria-label="匿名诊断信息"
                    data-od-id="anonymous-diagnostics"
                    checked={settings.anonymousDiagnostics}
                    onChange={(event) => updateSetting("anonymousDiagnostics", event.target.checked)}
                    type="checkbox"
                  />
                  <span className="switch-control__track" aria-hidden="true" />
                </label>
              </div>
              <div className="privacy-summary">
                <HugeiconsIcon icon={Bookmark01Icon} size={15} strokeWidth={1.8} />
                <span>保存的词汇与设置均使用浏览器本地存储。</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="options-footer">
          <span>设置会同步到当前浏览器中的 Salto 实例。</span>
          <button className="save-button" data-od-id="save-settings" disabled={isSaving || !isLoaded} onClick={() => void handleSave()} type="button">
            {isSaving ? "保存中..." : "保存更改"}
          </button>
        </footer>
      </div>
    </main>
  );
}
