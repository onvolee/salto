import { useEffect, useState } from "react";

import { SETTINGS_SECTIONS, type SettingsSectionId } from "../types";

const DEFAULT_SECTION_ID: SettingsSectionId = "general";

function sectionIdFromHash(hash: string): SettingsSectionId {
  const normalizedHash = hash.trim().toLowerCase();
  for (const section of SETTINGS_SECTIONS) {
    if (normalizedHash.startsWith(section.hash)) {
      return section.id;
    }
  }
  return DEFAULT_SECTION_ID;
}

export function useSettingsRouter() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(() =>
    sectionIdFromHash(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(sectionIdFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateToSection = (sectionId: SettingsSectionId) => {
    const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
    if (section && window.location.hash !== section.hash) {
      window.location.hash = section.hash;
    }
  };

  return {
    activeSection,
    navigateToSection,
  };
}
