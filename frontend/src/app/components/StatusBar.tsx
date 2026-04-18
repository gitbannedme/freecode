import React, { useState } from "react";
import { GearIcon } from "./Icons";
import { EffortIcon } from "./ChatBlocks";
import { useChatContext } from "../context/ChatContext";

export function StatusBar({
  setSidebarOpen,
}: {
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    connected,
    workingDir,
    model,
    contextPct,
    compactThreshold,
    setCompactThreshold,
    autoCompact,
    setAutoCompact,
    runCommand,
    effort,
    setModelPickerOpen,
    setShowSettings,
  } = useChatContext();

  const [isEditingThreshold, setIsEditingThreshold] = useState(false);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-val clickable sidetoggle" onClick={() => setSidebarOpen(s => !s)} title="Toggle sessions sidebar">
          ☰
        </span>
        <div className="status-item">
          <span className={`status-dot ${connected ? "online" : "offline"}`}>●</span>
        </div>
        {workingDir && (
          <>
            <span className="sep">·</span>
            <div className="status-item clickable" onClick={() => setModelPickerOpen(true)}>
              <span className="status-label">model</span>
              <span className="status-val">{model}</span>
            </div>
            <span className="sep">·</span>
            <div className="status-item clickable">
              <span className="status-label">ctx</span>
              <span className="status-val" style={{ color: (contextPct ?? 0) >= compactThreshold ? "var(--status-warning)" : "inherit" }}>
                {contextPct != null ? `${contextPct.toFixed(0)}%` : "0%"}
              </span>
              <div
                className="ctx-auto-group"
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY < 0 ? 1 : -1;
                  setCompactThreshold(t => Math.max(10, Math.min(95, t + delta)));
                }}
              >
                <label className="ctx-toggle">
                  <input
                    type="checkbox"
                    checked={autoCompact}
                    onChange={(e) => setAutoCompact(e.target.checked)}
                  />
                  <span>{autoCompact ? "auto" : "manual"}</span>
                </label>
                {autoCompact &&
                  (isEditingThreshold ? (
                    <input
                      autoFocus
                      className="ctx-threshold-input"
                      type="number"
                      value={compactThreshold}
                      onChange={(e) => setCompactThreshold(() => parseInt(e.target.value) || 0)}
                      onBlur={() => setIsEditingThreshold(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setIsEditingThreshold(false);
                      }}
                    />
                  ) : (
                    <span className="ctx-threshold-val" onClick={() => setIsEditingThreshold(true)}>
                      ({compactThreshold}%)
                    </span>
                  ))}
              </div>
            </div>
            {(contextPct ?? 0) >= compactThreshold && (
               <span style={{ fontSize: 9, cursor: "pointer", color: "var(--accent-blue)", marginLeft: 4 }} onClick={() => runCommand("/compact")}>[compact]</span>
            )}
          </>
        )}
      </div>
      <div className="status-right">
        {workingDir && (
          <>
            <div className="status-item clickable" onClick={() => runCommand("/effort")}>
              <span className="status-label">effort</span>
              <EffortIcon effort={effort} />
            </div>
            <span className="sep">·</span>
          </>
        )}
        <div className="status-item clickable" onClick={() => setShowSettings(true)} title="Open settings">
          <GearIcon />
        </div>
      </div>
    </div>
  );
}
