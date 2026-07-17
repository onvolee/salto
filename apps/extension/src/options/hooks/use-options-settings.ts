import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SaltoSettings,
} from "salto-src/theme/theme-settings";

import type { SaveStatus } from "../types";

export function useOptionsSettings() {
  const [settings, setSettings] = useState<SaltoSettings>(DEFAULT_SETTINGS);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("synced");
  const revisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void loadSettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = <K extends keyof SaltoSettings>(
    key: K,
    value: SaltoSettings[K],
  ) => {
    revisionRef.current += 1;
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveStatus("dirty");
  };

  const resetSettings = () => {
    revisionRef.current += 1;
    setSettings({ ...DEFAULT_SETTINGS });
    setSaveStatus("dirty");
  };

  const save = async () => {
    const savedRevision = revisionRef.current;
    setSaveStatus("saving");

    try {
      await saveSettings(settings);
      setSaveStatus(
        revisionRef.current === savedRevision ? "saved" : "dirty",
      );
    } catch {
      setSaveStatus("error");
    }
  };

  return {
    loadState,
    resetSettings,
    save,
    saveStatus,
    settings,
    updateSetting,
  };
}
