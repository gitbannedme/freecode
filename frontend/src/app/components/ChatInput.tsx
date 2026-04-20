import React, { useState, useRef, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import { MODELS, COMMANDS, BACKEND_URL } from "../lib/constants";

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
    addPin,
    workingDir,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [attachOpen, setAttachOpen] = useState(false);
  const [fetchedFiles, setFetchedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // ── Command palette ────────────────────────────────────────
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

  // ── File mention (@type:query) ─────────────────────────────
  // Parses the last @ token. Returns null if no active mention.
  // type: undefined = picking type, "file"|"folder"|"project" = fetching results
  const atMatch = (() => {
    const idx = input.lastIndexOf("@");
    if (idx === -1) return null;
    const after = input.slice(idx + 1);
    if (after.includes(" ")) return null;
    const colonIdx = after.indexOf(":");
    if (colonIdx === -1) return { start: idx, type: null as null, query: after.toLowerCase() };
    const type = after.slice(0, colonIdx) as "file" | "folder" | "project";
    const query = after.slice(colonIdx + 1).toLowerCase();
    if (!["file", "folder", "project"].includes(type)) return null;
    return { start: idx, type, query };
  })();

  // Fetch files/folders from backend when type is known
  useEffect(() => {
    if (!atMatch || !atMatch.type || atMatch.type === "project") {
      setFetchedFiles([]);
      return;
    }
    const ctrl = new AbortController();
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = ctrl;
    const base = BACKEND_URL.replace(/^ws/, "http");
    const params = new URLSearchParams({ query: atMatch.query, kind: atMatch.type });
    if (workingDir) params.set("dir", workingDir);
    fetch(`${base}/api/files?${params}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setFetchedFiles(d.files ?? []))
      .catch(() => {});
  }, [atMatch?.type, atMatch?.query, workingDir]);

  // Type-picker rows (shown when just @ or @partial with no colon)
  const MENTION_TYPES = [
    { name: "file", label: "@file:", desc: "attach a file" },
    { name: "folder", label: "@folder:", desc: "attach a folder" },
    { name: "project", label: "@project:", desc: "switch / pin project" },
  ] as const;

  const mentionTypeSuggestions = (() => {
    if (!atMatch || atMatch.type !== null) return [];
    return MENTION_TYPES.filter(t => t.name.startsWith(atMatch.query));
  })();

  const fileSuggestions = (() => {
    if (!atMatch || atMatch.type === null) return [];
    if (atMatch.type === "project") {
      // serverRecents handled separately via useChat — re-expose via context if needed
      return [];
    }
    return fetchedFiles.slice(0, 8);
  })();

  const mentionOpen = mentionTypeSuggestions.length > 0 || fileSuggestions.length > 0;

  const acceptMentionType = (typeName: string) => {
    if (!atMatch) return;
    setInput(input.slice(0, atMatch.start) + `@${typeName}:`);
    setMentionIdx(0);
  };

  const acceptMention = (file: string) => {
    if (!atMatch) return;
    addPin(file);
    setInput(input.slice(0, atMatch.start));
    setMentionIdx(0);
  };

  // ── Send ───────────────────────────────────────────────────
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
    if (mentionOpen) {
      const total = mentionTypeSuggestions.length || fileSuggestions.length;
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => (i - 1 + total) % total); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i + 1) % total); return; }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (mentionTypeSuggestions.length) acceptMentionType(mentionTypeSuggestions[mentionIdx]!.name);
        else acceptMention(fileSuggestions[mentionIdx]!);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setInput(input.slice(0, (atMatch?.start ?? input.length))); return; }
    }
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

  // ── Attach ─────────────────────────────────────────────────
  const handleAttach = async (accept: string) => {
    setAttachOpen(false);
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const isImage = accept === "image/*";
        const picked = await open({
          multiple: true,
          filters: isImage
            ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }]
            : [],
        });
        if (picked) {
          const paths = Array.isArray(picked) ? picked : [picked];
          paths.forEach(p => addPin(p as string));
        }
        return;
      } catch (e) {
        console.error("Tauri dialog failed:", e);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const path = (file as any).path || file.name;
      addPin(path);
    }
    e.target.value = "";
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
                  onClick={() => { runCommand(cmd.name); setInput(""); }}
                >
                  <span className="cmd-name">{cmd.name}</span>
                  <span className="cmd-desc">{cmd.description}</span>
                </div>
              ))}
            </div>
          )}
          {mentionOpen && (
            <div className="cmd-palette-floating">
              {mentionTypeSuggestions.length > 0
                ? mentionTypeSuggestions.map((t, i) => (
                    <div
                      key={t.name}
                      className={`cmd-row${i === mentionIdx ? " cmd-row-active" : ""}`}
                      onMouseEnter={() => setMentionIdx(i)}
                      onClick={() => acceptMentionType(t.name)}
                    >
                      <span className="cmd-name">{t.label}</span>
                      <span className="cmd-desc">{t.desc}</span>
                    </div>
                  ))
                : fileSuggestions.map((file, i) => (
                    <div
                      key={file}
                      className={`cmd-row${i === mentionIdx ? " cmd-row-active" : ""}`}
                      onMouseEnter={() => setMentionIdx(i)}
                      onClick={() => acceptMention(file)}
                    >
                      <span className="cmd-name mention-file">{file.split(/[\\/]/).pop()}</span>
                      <span className="cmd-desc">{file}</span>
                    </div>
                  ))
              }
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
            <div className="attach-wrapper">
              <button
                className="attach-btn"
                onClick={() => setAttachOpen(o => !o)}
                title="Attach file or image"
              >
                +
              </button>
              {attachOpen && (
                <>
                  <div className="attach-backdrop" onClick={() => setAttachOpen(false)} />
                  <div className="attach-menu">
                    <div className="attach-item" onClick={() => handleAttach("*/*")}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      Attach File
                    </div>
                    <div className="attach-item" onClick={() => handleAttach("image/*")}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                      Add Image
                    </div>
                  </div>
                </>
              )}
            </div>
            <span className="input-prompt divider">│</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setPaletteIdx(0);
                setMentionIdx(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={messages.length === 0 ? "What's the plan?" : ""}
              autoFocus
            />
            {!working && input === "" && messages.length > 0 && (
              <span className="input-hint ghost">/ for commands · @ to mention · esc to clear</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={onFileInputChange}
          />
        </div>
      )}
    </div>
  );
}
