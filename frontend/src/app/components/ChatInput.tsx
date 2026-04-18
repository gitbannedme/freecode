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
          <span className="input-offline-msg">Disconnected — check backend</span>
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
