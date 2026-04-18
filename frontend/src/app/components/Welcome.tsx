import React from "react";
import Image from "next/image";
import { COMMANDS } from "../lib/constants";

export function Welcome({ show, onRun }: { show: boolean; onRun: (cmd: string) => void }) {
  if (!show) return null;
  
  const getDesc = (name: string) => COMMANDS.find(c => c.name === name)?.description || "";

  return (
    <div className="welcome-splash">
      <div className="splash-bird">
        <Image src="/logo.svg" width={64} height={64} alt="FreeCode Logo" priority />
      </div>
      <h1 className="splash-title">FREECODE</h1>
      <p className="splash-subtitle">Your personal agentic coding assistant.</p>

      <div className="splash-hints">
        <div className="hint-row clickable" onClick={() => onRun("/model")}>
          <span className="hint-key">/model</span> {getDesc("/model")}
        </div>
        <div className="hint-row clickable" onClick={() => onRun("/compact")}>
          <span className="hint-key">/compact</span> {getDesc("/compact")}
        </div>
        <div className="hint-row clickable" onClick={() => onRun("/help")}>
          <span className="hint-key">/help</span> {getDesc("/help")}
        </div>
      </div>
    </div>
  );
}
