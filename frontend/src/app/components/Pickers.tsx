import React, { useState } from "react";
import { Popover } from "./Popover";
import { FolderIcon } from "./Icons";
import { MODELS } from "../lib/constants";
import { loadRecentDirs, saveRecentDir } from "../lib/utils";

export function ModelPicker({ current, onSelect, onClose }: { current: string; onSelect: (id: string) => void; onClose: () => void }) {
  const providers = Array.from(new Set(MODELS.map(m => m.provider)));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <Popover onClose={onClose} className="popover-model">
        <div className="popover-header">Model</div>
        <div className="popover-list">
          {providers.map(p => (
            <div key={p} className="popover-group">
              <div className="popover-group-header" onClick={() => setCollapsed(prev => ({ ...prev, [p]: !prev[p] }))}>
                <span className={`popover-arrow${collapsed[p] ? "" : " open"}`}>▶</span>
                {p}
              </div>
              {!collapsed[p] && MODELS.filter(m => m.provider === p).map(m => (
                <div
                  key={m.id}
                  className={`popover-row${m.id === current ? " active" : ""}`}
                  onClick={() => { onSelect(m.id); onClose(); }}
                >
                  <div className="popover-info">
                     <div className="popover-label">
                       {m.label}
                       {(m.id.includes("31b") || m.id.includes("3.1")) && <span className="tag-new">New</span>}
                       {m.id.includes("high") && <span className="tag-warning">⚠️</span>}
                     </div>
                     <div className="popover-sub">{m.id}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
    </Popover>
  );
}

export function DirPicker({ onSelect, onBrowse, onClose, recents }: { onSelect: (dir: string) => void; onBrowse: () => void; onClose?: () => void; recents: string[] }) {
  const [val, setVal] = useState("");
  const localRecents = loadRecentDirs();
  const allRecents = Array.from(new Set([...recents, ...localRecents])).slice(0, 5);

  const submit = (dir: string) => {
    const d = dir.trim();
    if (!d) return;
    saveRecentDir(d);
    onSelect(d);
  };

  const handleBrowse = async () => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({
          directory: true,
          multiple: false,
          title: "Select Project Folder"
        });
        if (picked) submit(picked as string);
        return;
      } catch (e) {
        console.error("Tauri dialog failed:", e);
      }
    }

    if ((window as any).pywebview?.api?.pick_folder) {
      const picked = await (window as any).pywebview.api.pick_folder();
      if (picked) submit(picked);
    } else {
      onBrowse();
    }
  };

  return (
    <Popover onClose={onClose} className="popover-dir">
      <div className="popover-header">Project</div>
      <div className="dir-popover-body">
        <div className="dir-input-wrapper">
          <input
            className="dir-input"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(val); }}
            placeholder="C:\path\to\project"
            autoFocus
          />
          <button className="dir-browse-icon" onClick={handleBrowse} title="Browse...">
            <FolderIcon />
          </button>
        </div>
        {allRecents.length > 0 && (
          <div className="dir-recents-section">
            <div className="dir-recents-label">Recent</div>
            {allRecents.map(d => (
              <div key={d} className="dir-recent-row" onClick={() => submit(d)}>
                <FolderIcon />
                <span className="dir-recent-text" title={d}>{d}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}
