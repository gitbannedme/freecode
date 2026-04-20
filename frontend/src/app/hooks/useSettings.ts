import { useState, useEffect } from "react";

export const AGENT_SETTINGS_KEYS = {
  STRICT_MODE: "freecode:settings.strictMode",
  REVIEW_POLICY: "freecode:settings.reviewPolicy",
  TERMINAL_AUTO_EXEC: "freecode:settings.terminalAutoExec",
} as const;

export type ReviewPolicy = "Asks for Review" | "Agent Decides" | "Always Proceeds";
export type TerminalAutoExec = "Always Proceed" | "Request Review";

export interface AgentSettings {
  strictMode: boolean;
  reviewPolicy: ReviewPolicy;
  terminalAutoExec: TerminalAutoExec;
}

const DEFAULTS: AgentSettings = {
  strictMode: false,
  reviewPolicy: "Asks for Review",
  terminalAutoExec: "Always Proceed",
};

export function useSettings() {
  const [settings, setSettingsState] = useState<AgentSettings>(DEFAULTS);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const strictMode = localStorage.getItem(AGENT_SETTINGS_KEYS.STRICT_MODE) === "true";
    const reviewPolicy = (localStorage.getItem(AGENT_SETTINGS_KEYS.REVIEW_POLICY) || DEFAULTS.reviewPolicy) as ReviewPolicy;
    const terminalAutoExec = (localStorage.getItem(AGENT_SETTINGS_KEYS.TERMINAL_AUTO_EXEC) || DEFAULTS.terminalAutoExec) as TerminalAutoExec;

    setSettingsState({ strictMode, reviewPolicy, terminalAutoExec });
  }, []);

  const updateSetting = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
    setSettingsState(prev => {
      const next = { ...prev, [key]: value };

      if (key === "strictMode") {
        localStorage.setItem(AGENT_SETTINGS_KEYS.STRICT_MODE, String(value));
      } else if (key === "reviewPolicy") {
        localStorage.setItem(AGENT_SETTINGS_KEYS.REVIEW_POLICY, String(value));
      } else if (key === "terminalAutoExec") {
        localStorage.setItem(AGENT_SETTINGS_KEYS.TERMINAL_AUTO_EXEC, String(value));
      }

      return next;
    });
  };

  return {
    settings,
    updateSetting,
  };
}
