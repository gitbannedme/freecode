import React, { useState } from "react";
import Image from "next/image";
import { FolderIcon } from "./Icons";
import { loadRecentDirs, saveRecentDir } from "../lib/utils";

import { COMMANDS } from "../lib/constants";

export function ProjectSelectScreen({ onSelect, onBrowse, recents }: {
  onSelect: (dir: string) => void;
  onBrowse: () => void;
  recents: string[];
}) {
  const [val, setVal] = useState("");
  const localRecents = loadRecentDirs();
  const allRecents = Array.from(new Set([...recents, ...localRecents])).slice(0, 6);

  const getDesc = (name: string) => COMMANDS.find(c => c.name === name)?.description || "";

  const submit = (dir: string) => {
    const d = dir.trim();
    if (!d) return;
    saveRecentDir(d);
    onSelect(d);
  };

  return (
    <div className="project-select-screen">
      <div className="project-select-card">
        
        {/* Logo */}
        <div className="splash-bird">
          <Image src="/logo.svg" width={64} height={64} alt="FreeCode Logo" priority />
        </div>
        
        {/* Titles */}
        <h1 className="splash-title">FREECODE</h1>
        <p className="splash-subtitle">Your personal agentic coding assistant.</p>

        {/* Restore Hints from Reference */}
        <div className="splash-hints" style={{ marginTop: 24, marginBottom: 48 }}>
           <div className="hint-row" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--dim)", fontSize: "13px", marginBottom: "8px" }}>
             <span style={{ color: "#6366f1", fontWeight: 600 }}>/model</span> <span>{getDesc("/model")}</span>
           </div>
           <div className="hint-row" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--dim)", fontSize: "13px", marginBottom: "8px" }}>
             <span style={{ color: "#6366f1", fontWeight: 600 }}>/compact</span> <span>{getDesc("/compact")}</span>
           </div>
           <div className="hint-row" style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--dim)", fontSize: "13px" }}>
             <span style={{ color: "#6366f1", fontWeight: 600 }}>/help</span> <span>{getDesc("/help")}</span>
           </div>
        </div>
        
        <div className="splash-action-container" style={{ marginTop: 0 }}>
          <p className="splash-label">Open a project to get started</p>

          {/* Input Box */}
          <div className="splash-input-wrapper" style={{ marginBottom: 40 }}>
            <input
              className="splash-input"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(val); }}
              placeholder="C:\path\to\project"
              autoFocus
            />
            <button className="splash-browse-btn" onClick={onBrowse} title="Browse projects...">
              <FolderIcon />
              <span>Browse</span>
            </button>
          </div>
        </div>

        {/* Recent Projects (Refined List) */}
        {allRecents.length > 0 && (
          <div className="splash-recent-section">
            <div className="dir-recents-label">RECENT</div>
            <div className="splash-recent-list">
              {allRecents.map(d => {
                const parts = d.split(/[\\/]/).filter(Boolean);
                const folderName = parts[parts.length - 1] || d;
                return (
                  <div key={d} className="splash-recent-item" onClick={() => submit(d)}>
                    <div className="splash-recent-icon">
                      <FolderIcon />
                    </div>
                    <div className="splash-recent-info">
                      <div className="splash-recent-name">{folderName}</div>
                      <div className="splash-recent-path" title={d}>{d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
