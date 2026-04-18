"use client";
 
import { useState, useEffect } from "react";
import styles from "./SettingsPanel.module.css";
import { EyeIcon, EyeOffIcon, CopyIcon, SaveIcon, XIcon } from "./Icons";
import { Popover } from "./Popover";
import McpSettings from "./McpSettings";
import { Button } from "./Button";
import { getApiKey, saveApiKey, sendConfigToBackend } from "../lib/config";
 
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
 
export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getApiKey() || "");
      setError("");
      setSuccess("");
    }
  }, [isOpen]);
 
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setSuccess("API Key copied!");
    setTimeout(() => setSuccess(""), 2000);
  };
 
  const handleSave = async () => {
    setError("");
    setSuccess("");
 
    if (!apiKey.trim()) {
      setError("API Key is required");
      return;
    }
 
    const success = await sendConfigToBackend(apiKey);
    if (success) {
      saveApiKey(apiKey);
      setSuccess("Settings saved!");
      setTimeout(onClose, 1000);
    } else {
      setError("Failed to save settings");
    }
  };
 
  if (!isOpen) return null;

  return (
    <Popover onClose={onClose} className="popover-settings">
        <div className="popover-header">
          <span>Settings</span>
          <div style={{ display: "flex", gap: "4px" }}>
            <button className={styles.iconBtn} onClick={handleSave} title="Save Settings">
                <SaveIcon />
            </button>
            <button className={styles.iconBtn} onClick={onClose} title="Close">
                <XIcon />
            </button>
          </div>
        </div>
 
        <div className={styles.content}>
          <div className={styles.section}>
            <div className={styles.labelRow}>
                <label className={styles.label}>API Key</label>
            </div>
            <div className={styles.inputWrapper}>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={styles.inputWithIcons}
                  placeholder="Enter your API key..."
                />
                <div className={styles.inputIconsWrapper}>
                    <button onClick={() => setShowKey(!showKey)} className={styles.iconBtn} title={showKey ? "Hide" : "Show"}>
                        {showKey ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                    <button onClick={handleCopyKey} className={styles.iconBtn} title="Copy API Key">
                        <CopyIcon />
                    </button>
                </div>
            </div>
          </div>
 
          <div className={styles.section}>
            <McpSettings />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}
        </div>
    </Popover>
  );
}

