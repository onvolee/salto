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
import { SettingsHeader } from "./components/settings-header";
import { SettingsLoading } from "./components/settings-loading";
import { SettingsSidebar } from "./components/settings-sidebar";
import { useOptionsSettings } from "./hooks/use-options-settings";
import { useQueryTemplates } from "./hooks/use-query-templates";
import { AiProviderSection } from "./sections/ai-provider-section";
import { GeneralSection } from "./sections/general-section";
import { SelectionSection } from "./sections/selection-section";
import { SourcesSection } from "./sections/sources-section";
import { VocabularySection } from "./sections/vocabulary-section";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./types";

export function OptionsApp() {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general");
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
          onSectionChange={setActiveSection}
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
                saveStatus={saveStatus}
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
                    editor={queryTemplates}
                    onActiveTemplateChange={(templateId) => {
                      updateSetting("activeQueryTemplateId", templateId);
                    }}
                  />
                ) : null}
                {activeSection === "sources" ? (
                  <SourcesSection />
                ) : null}
                {activeSection === "vocabulary" ? <VocabularySection /> : null}
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
