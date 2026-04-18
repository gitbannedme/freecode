import React, { useState } from "react";
import Image from "next/image";
import { FolderIcon } from "./Icons";
import { loadRecentDirs, saveRecentDir } from "../lib/utils";
import { COMMANDS } from "../lib/constants";

const HINTS = ["/model", "/compact", "/help"] as const;

export function ProjectSelectScreen({ onSelect, onBrowse, recents }: {
  onSelect: (dir: string) => void;
  onBrowse: () => void;
  recents: string[];
}) {
  const [val, setVal] = useState("");
  const localRecents = loadRecentDirs();
  const allRecents = Array.from(new Set([...recents, ...localRecents])).slice(0, 6);

  const submit = (dir: string) => {
    const d = dir.trim();
    if (!d) return;
    saveRecentDir(d);
    onSelect(d);
  };

  return (
    <div className="pss">
      <div className="pss-inner">

        {/* ── Branding ── */}
        <div className="pss-brand">
          <Image src="/logo.svg" width={40} height={40} alt="FreeCode" priority />
          <h1 className="pss-title">FREECODE</h1>
          <p className="pss-sub">Your personal agentic coding assistant.</p>
        </div>

        {/* ── Hint chips ── */}
        <div className="pss-hints">
          {HINTS.map(name => (
            <span key={name} className="pss-chip">
              <span className="pss-chip-cmd">{name}</span>
              {COMMANDS.find(c => c.name === name)?.description}
            </span>
          ))}
        </div>

        {/* ── Workspace input ── */}
        <div className="pss-section">
          <label className="pss-label">OPEN WORKSPACE</label>
          <div className="pss-input-row">
            <input
              className="pss-input"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(val); }}
              placeholder="Enter path or browse…"
              autoFocus
            />
            <button className="pss-browse" onClick={onBrowse} title="Browse">
              <FolderIcon />
            </button>
          </div>
        </div>

        {/* ── Recent projects ── */}
        {allRecents.length > 0 && (
          <div className="pss-section">
            <label className="pss-label">RECENT</label>
            <div className="pss-recents">
              {allRecents.map(d => {
                const name = d.split(/[\\/]/).filter(Boolean).pop() || d;
                return (
                  <button key={d} className="pss-recent" onClick={() => submit(d)}>
                    <FolderIcon />
                    <div className="pss-recent-info">
                      <span className="pss-recent-name">{name}</span>
                      <span className="pss-recent-path" title={d}>{d}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
