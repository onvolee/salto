import { useEffect, useState, type CSSProperties } from "react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "salto-src/components/ui/alert";
import { Button } from "salto-src/components/ui/button";
import { Separator } from "salto-src/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "salto-src/components/ui/sidebar";
import { TooltipProvider } from "salto-src/components/ui/tooltip";

import { SettingsActions } from "./components/settings-actions";
import { SettingsHeader, type StatusSummary } from "./components/settings-header";
import { SettingsLoading } from "./components/settings-loading";
import { SettingsSidebar } from "./components/settings-sidebar";
import { useOptionsSettings } from "./hooks/use-options-settings";
import { useSettingsRouter } from "./hooks/use-settings-router";
import { useQueryTemplates } from "./hooks/use-query-templates";
import { useTemplateFieldDefinitions } from "./hooks/use-template-field-definitions";
import { AiProviderSection } from "./sections/ai-provider-section";
import { GeneralSection } from "./sections/general-section";
import { SelectionSection } from "./sections/selection-section";
import { SourcesSection } from "./sections/sources-section";
import type { YoudaoTestPreview } from "./dictionary-client";
import { VocabularySection } from "./sections/vocabulary-section";
import { SETTINGS_SECTIONS } from "./types";

export function OptionsApp() {
  const {
    activeSection,
    navigateToSection,
    navigateToSelectionView,
    selectionView,
  } = useSettingsRouter();
  const [youdaoPreview, setYoudaoPreview] = useState<YoudaoTestPreview | null>(null);
  const [dictionaryTestStatus, setDictionaryTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [dictionaryTestMessage, setDictionaryTestMessage] = useState<string | undefined>();
  const [vocabularyFailedCount, setVocabularyFailedCount] = useState(0);
  const {
    connectionStatus,
    llm,
    llmError,
    loadState,
    promptAnalysis,
    save,
    saveStatus,
    settings,
    testConnection,
    updateLlm,
    updateSetting,
  } = useOptionsSettings();
  const queryTemplates = useQueryTemplates({
    onActiveTemplateChange(templateId) {
      updateSetting("activeQueryTemplateId", templateId);
    },
    onTemplateDeleted(deletedTemplateId, fallbackTemplateId) {
      if (settings.activeQueryTemplateId === deletedTemplateId) {
        updateSetting("activeQueryTemplateId", fallbackTemplateId);
      }
    },
  });
  const templateFieldDefinitions = useTemplateFieldDefinitions();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

  if (loadState === "loading") {
    return (
      <div className="salto-theme-scope" data-theme={settings.themeMode}>
        <SettingsLoading />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <main
        className="salto-theme-scope grid min-h-screen place-items-center p-5"
        data-theme={settings.themeMode}
      >
        <Alert className="max-w-md" role="alert" variant="destructive">
          <AlertTitle>无法加载设置</AlertTitle>
          <AlertDescription>
            扩展本地存储暂时不可用，请重新加载后再试。
          </AlertDescription>
          <Button
            className="mt-2 w-fit"
            onClick={() => window.location.reload()}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={RefreshIcon}
              strokeWidth={2}
            />
            重新加载
          </Button>
        </Alert>
      </main>
    );
  }

  const section = SETTINGS_SECTIONS.find(({ id }) => id === activeSection)!;

  const activeTemplateName = queryTemplates.templates.find(
    (t) => t.id === settings.activeQueryTemplateId,
  )?.name ?? "默认";

  function getStatusSummary(): StatusSummary {
    switch (activeSection) {
      case "general":
        return { type: "save", status: saveStatus };
      case "selection":
        return { type: "template", name: activeTemplateName };
      case "sources":
        return {
          type: "dictionary",
          status: dictionaryTestStatus,
          message: dictionaryTestMessage,
        };
      case "vocabulary":
        return { type: "vocabulary", failedCount: vocabularyFailedCount };
      case "ai-provider":
        return {
          type: "ai",
          configured: llm.hasApiKey || llm.apiKey.trim().length > 0,
          connectionStatus: connectionStatus.status,
          message: connectionStatus.message || undefined,
        };
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        className="salto-theme-scope min-h-screen bg-background"
        data-od-id="settings-app"
        data-theme={settings.themeMode}
        style={
          {
            "--sidebar-width": "13rem",
            "--sidebar-width-mobile": "18rem",
          } as CSSProperties
        }
      >
        <SettingsSidebar
          activeSection={activeSection}
          onNavigate={navigateToSection}
        />
        <SidebarInset
          className="min-w-0"
          data-od-id="settings-content"
        >
          <header className="flex h-12 shrink-0 items-center px-5 sm:px-8 lg:px-10">
            <SidebarTrigger aria-label="切换设置菜单" />
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              设置菜单
            </span>
          </header>
          <Separator />
          <div className="px-5 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-3xl pt-6">
              <SettingsHeader
                description={section.description}
                status={getStatusSummary()}
                title={section.label}
              />
              <Separator className="mt-5" />

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                {activeSection === "general" ? (
                  <GeneralSection
                    settings={settings}
                    updateSetting={updateSetting}
                  />
                ) : null}
                {activeSection === "selection" ? (
                  <SelectionSection
                    activeTemplateId={settings.activeQueryTemplateId}
                    definitions={templateFieldDefinitions}
                    editor={queryTemplates}
                    onActiveTemplateChange={(templateId) => {
                      updateSetting("activeQueryTemplateId", templateId);
                    }}
                    onViewChange={navigateToSelectionView}
                    view={selectionView}
                  />
                ) : null}
                {activeSection === "sources" ? (
                  <SourcesSection
                    onPreviewChange={setYoudaoPreview}
                    onTestStatusChange={(status, message) => {
                      setDictionaryTestStatus(status);
                      setDictionaryTestMessage(message);
                    }}
                    preview={youdaoPreview}
                  />
                ) : null}
                {activeSection === "vocabulary" ? (
                  <VocabularySection
                    onFailedCountChange={setVocabularyFailedCount}
                  />
                ) : null}
                {activeSection === "ai-provider" ? (
                  <AiProviderSection
                    connectionStatus={connectionStatus}
                    llm={llm}
                    llmError={llmError}
                    promptAnalysis={promptAnalysis}
                    testConnection={testConnection}
                    updateLlm={updateLlm}
                  />
                ) : null}

                <Separator />
                <SettingsActions saveStatus={saveStatus} />
              </form>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
