import React from "react";
import Image from "next/image";
import { COMMANDS } from "../lib/constants";

const HINTS = ["/model", "/compact", "/help"] as const;

export function Welcome({ show, onRun }: { show: boolean; onRun: (cmd: string) => void }) {
  if (!show) return null;
  
  return (
    <div className="welcome-area">
      <div className="welcome-inner">
        {/* Branding */}
        <div className="pss-brand">
          <Image src="/logo.svg" width={40} height={40} alt="FreeCode" priority />
          <h1 className="pss-title">FREECODE</h1>
          <p className="pss-sub">Your personal agentic coding assistant.</p>
        </div>

        {/* Hint chips (clickable) */}
        <div className="pss-hints">
          {HINTS.map(name => (
            <button key={name} className="pss-chip clickable" onClick={() => onRun(name)}>
              <span className="pss-chip-cmd">{name}</span>
              {COMMANDS.find(c => c.name === name)?.description}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
