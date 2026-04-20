import { useState, useEffect } from "react";
import { FiChevronLeft, FiEye, FiEyeOff, FiCopy } from "react-icons/fi";
import { User, Server } from "lucide-react";
import { useChatContext } from "../context/ChatContext";
import { getApiKey, saveApiKey } from "../lib/config";
import McpSettings from "./McpSettings";

type Tab = "General" | "MCP Servers";

const TABS: { id: Tab; icon: React.ReactNode }[] = [
  { id: "General", icon: <User size={15} /> },
  { id: "MCP Servers", icon: <Server size={15} /> },
];

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState("");
  const { autoOpenProject, setAutoOpenProject } = useChatContext();

  useEffect(() => {
    setApiKey(getApiKey() || "");
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onClose}>
          <FiChevronLeft size={16} />
          Back to workspace
        </button>
        <span className="settings-sep" />
        <span className="settings-title">Settings — {activeTab}</span>
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.id}
              </button>
            ))}
          </nav>
          <div className="settings-sidebar-footer">
            <span className="settings-version">freecode v0.3.0</span>
          </div>
        </div>

        <div className="settings-content">
          {activeTab === "General" && (
            <div className="settings-pane">

              <div className="settings-section">
                <div className="settings-section-title">API Key</div>
                <div className="settings-card">
                  <div className="settings-row settings-row--stacked">
                    <div className="settings-row-info">
                      <h4>API Key</h4>
                      <p>Stored locally in this browser.</p>
                    </div>
                    <div className="settings-api-input-row">
                      <input
                        className="settings-api-input"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          saveApiKey(e.target.value);
                          showToast("Saved");
                        }}
                        placeholder="sk-ant-..."
                      />
                      {toast && <span className="settings-toast">{toast}</span>}
                      <button
                        className="settings-icon-btn"
                        onClick={() => setShowKey(!showKey)}
                        title={showKey ? "Hide" : "Show"}
                      >
                        {showKey ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                      </button>
                      <button
                        className="settings-icon-btn"
                        onClick={() => { navigator.clipboard.writeText(apiKey); showToast("Copied"); }}
                        title="Copy"
                      >
                        <FiCopy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Project</div>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4>Remember last project</h4>
                      <p>Automatically reopen the last used project on launch.</p>
                    </div>
                    <button
                      className={`toggle-switch ${autoOpenProject ? "active" : ""}`}
                      onClick={() => setAutoOpenProject(!autoOpenProject)}
                      aria-pressed={autoOpenProject}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === "MCP Servers" && (
            <div className="settings-pane">
              <McpSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
