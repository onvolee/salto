import {
  AiBrain01Icon,
  Configuration01Icon,
  CursorMagicSelection02Icon,
  TranslateIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "salto-src/components/ui/sidebar";
import { Avatar, AvatarFallback } from "salto-src/components/ui/avatar";

import { SETTINGS_SECTIONS, type SettingsSectionId } from "../types";

const SECTION_ICONS = {
  general: Configuration01Icon,
  selection: CursorMagicSelection02Icon,
  sources: TranslateIcon,
  "ai-provider": AiBrain01Icon,
};

type SettingsSidebarProps = {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
};

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const selectSection = (section: SettingsSectionId) => {
    onSectionChange(section);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar
      collapsible="icon"
      data-od-id="settings-sidebar"
    >
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<div data-od-id="salto-brand" />}
              size="lg"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md bg-background text-sidebar-foreground">
                  S
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <strong className="truncate text-sm font-semibold">Salto</strong>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  阅读辅助
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>设置</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-label="设置分组">
              {SETTINGS_SECTIONS.map((section) => {
                const icon = SECTION_ICONS[section.id];

                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      aria-current={
                        activeSection === section.id ? "page" : undefined
                      }
                      isActive={activeSection === section.id}
                      onClick={() => selectSection(section.id)}
                      tooltip={section.label}
                      type="button"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={icon}
                        strokeWidth={2}
                      />
                      <span>{section.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <Avatar className="size-8">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                U
              </AvatarFallback>
            </Avatar>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
