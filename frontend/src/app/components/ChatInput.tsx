import React, { useState } from "react";
import { useChatContext } from "../context/ChatContext";
import { MODELS, COMMANDS } from "../lib/constants";

interface ChatInputProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  scrollToBottom: (force?: boolean) => void;
}

export function ChatInput({
  inputRef,
  scrollToBottom
}: ChatInputProps) {
  const {
    connected,
    working,
    messages,
    connectionError,
    runCommand,
    sendMessage,
    pinnedFiles,
    removePin,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);

  const paletteMatches = (() => {
    if (!input.startsWith("/")) return [];
    if (input.startsWith("/model ")) {
      const search = input.slice(7).toLowerCase();
      return MODELS
        .filter(m => m.id.toLowerCase().includes(search) || m.label.toLowerCase().includes(search))
        .map(m => ({ name: `/model ${m.id}`, description: m.label }));
    }
    return COMMANDS.filter(c => c.name.startsWith(input.toLowerCase()));
  })();
  const paletteOpen = paletteMatches.length > 0;

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (paletteOpen) {
      runCommand(paletteMatches[paletteIdx]?.name ?? text);
      setInput("");
      return;
    }
    if (text.startsWith("/")) {
      runCommand(text);
      setInput("");
      return;
    }
    if (working) return;
    sendMessage(text);
    setInput("");
    setTimeout(() => scrollToBottom(true), 20);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (paletteOpen) {
      if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIdx(i => (i - 1 + paletteMatches.length) % paletteMatches.length); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIdx(i => (i + 1) % paletteMatches.length); return; }
      if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
      if (e.key === "Tab") { e.preventDefault(); setInput(paletteMatches[paletteIdx]?.name ?? input); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-outer">
      {connectionError && <div className="connection-error-banner">✗ {connectionError}</div>}
      {!connected ? (
        <div className="input-area input-area-offline">
          <span className="status-dot offline">●</span>
          <span className="input-offline-msg">Disconnected — attempting to reconnect</span>
        </div>
      ) : (
        <div className="input-container">
          {paletteOpen && (
            <div className="cmd-palette-floating">
              {paletteMatches.map((cmd, i) => (
                <div
                  key={cmd.name}
                  className={`cmd-row${i === paletteIdx ? " cmd-row-active" : ""}`}
                  onMouseEnter={() => setPaletteIdx(i)}
                  onClick={() => {
                    runCommand(cmd.name);
                    setInput("");
                  }}
                >
                  <span className="cmd-name">{cmd.name}</span>
                  <span className="cmd-desc">{cmd.description}</span>
                </div>
              ))}
            </div>
          )}
          {pinnedFiles.length > 0 && (
            <div className="pin-bar">
              {pinnedFiles.map(file => (
                <div key={file} className="pin-chip">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H14.76a2 2 0 0 1 1.79 1.1L18 14" /><path d="M10 10V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v4" /><path d="M3 14h18" /><path d="M19 14v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" /></svg>
                  <span>{file.split(/[\\/]/).pop()}</span>
                  <div className="pin-remove" onClick={() => removePin(file)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="input-box">
            <span className="input-prompt divider">│</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setPaletteIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? "What's the plan?" : ""}
              autoFocus
            />
            {working && <span className="input-hint">running ▂▄▆</span>}
            {!working && input === "" && messages.length > 0 && (
              <span className="input-hint ghost">/ for commands · esc to clear</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
