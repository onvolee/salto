import { useEffect, useState } from "react";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  subscribeToSettings,
  type ThemeMode,
} from "./theme-settings";

export function useThemeMode(): ThemeMode {
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_SETTINGS.themeMode);

  useEffect(() => {
    let isMounted = true;

    const hydrateTheme = async () => {
      try {
        const settings = await loadSettings();
        if (isMounted) {
          setThemeMode(settings.themeMode);
        }
      } catch {
        // Keep the system default when extension storage is unavailable.
      }
    };

    void hydrateTheme();

    const unsubscribe = subscribeToSettings((settings) => {
      if (isMounted) {
        setThemeMode(settings.themeMode);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return themeMode;
}
