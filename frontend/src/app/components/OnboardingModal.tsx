"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./OnboardingModal.module.css";
import { EyeIcon, EyeOffIcon } from "./Icons";
import { Button } from "./Button";

async function openExternal(url: string) {
  const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-shell");
    void open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (apiKey: string) => void;
  initialApiKey?: string;
}

export default function OnboardingModal({
  isOpen,
  onComplete,
  initialApiKey = "",
}: OnboardingModalProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleComplete = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      onComplete(apiKey);
    } catch (e: any) {
      setError(e.message || "Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <Image src="/logo.svg" width={40} height={40} alt="FreeCode" priority />
          </div>
          <div>
            <div className={styles.brandName}>FreeCode</div>
            <div className={styles.brandTagline}>Your agentic coding assistant</div>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Key input */}
        <div className={styles.field}>
          <div className={styles.fieldHeader}>
            <label className={styles.fieldLabel}>Gemini API Key</label>
            <button
              type="button"
              className={styles.getKeyBtn}
              onClick={() => openExternal("https://aistudio.google.com/apikey")}
            >
              Get free key →
            </button>
          </div>

          <div className={`${styles.inputWrap} ${error ? styles.inputWrapError : ""}`}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleComplete()}
              placeholder="AIza..."
              className={styles.input}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className={styles.eyeBtn}
              type="button"
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <p className={styles.hint}>
            Free tier · stored locally in your app data folder · never sent anywhere except Google
          </p>
        </div>

        <Button
          onClick={handleComplete}
          fullWidth
          disabled={loading}
        >
          {loading ? "Saving…" : "Start coding"}
        </Button>
      </div>
    </div>
  );
}
