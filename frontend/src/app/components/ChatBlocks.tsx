import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useChatContext } from "../context/ChatContext";
import { SiPython, SiTypescript, SiReact, SiHtml5, SiCss } from "react-icons/si";
import { FiFile, FiChevronDown, FiChevronRight } from "react-icons/fi";

/* ── Branch Button (for ThinkingBlock / ToolBlock) ─── */
function BranchBtn({ index }: { index: number }) {
  const { branch } = useChatContext();
  return (
    <button className="branch-btn" onClick={() => branch(index)} title="Branch from here">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
    </button>
  );
}

/* ── Message Action Menu (three-dots popup) ──────────── */
function MsgActionMenu({ index, text, canEdit, onEdit }: { index: number; text: string; canEdit?: boolean; onEdit?: () => void }) {
  const {
    setMessages, setConfirmModal, messages,
    selectMode, setSelectMode, selectedIndices, setSelectedIndices,
    setSavedSessions, sessionId, newChat,
  } = useChatContext();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !popupRef.current) return;
    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    if (rect.top < 8) { popup.style.bottom = "auto"; popup.style.top = "calc(100% + 6px)"; }
    if (rect.left < 8) { popup.style.right = "auto"; popup.style.left = "0"; }
    if (rect.right > window.innerWidth - 8) { popup.style.left = "auto"; popup.style.right = "0"; }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) { setOpen(false); setConfirmDelete(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = useCallback(() => { setOpen(false); setConfirmDelete(false); }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => { setCopied(false); close(); }, 1200);
  }, [text, close]);

  const handleDeleteConfirm = useCallback(() => {
    const remaining = messages.filter((_, i) => i !== index);
    setMessages(remaining);
    const hasContent = remaining.some(m => m.kind === "user" || m.kind === "response");
    if (!hasContent) {
      setSavedSessions((prev: any) => { const next = { ...prev }; delete next[sessionId]; return next; });
      newChat();
    }
    close();
  }, [messages, index, setMessages, setSavedSessions, sessionId, newChat, close]);

  const handleBranch = useCallback(() => {
    close();
    setConfirmModal({
      title: "Branch from here?",
      message: "The conversation will be truncated to this point.",
      onConfirm: () => {
        setMessages(prev => [
          ...prev.slice(0, index + 1),
          { kind: "system", text: "Conversation branched from this point." } as const,
        ]);
        setConfirmModal(null);
      },
    });
  }, [close, setConfirmModal, setMessages, index]);

  const handleSelect = useCallback(() => {
    close();
    setSelectMode(true);
    setSelectedIndices(new Set([index]));
  }, [close, setSelectMode, setSelectedIndices, index]);

  const toggleSelected = useCallback(() => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, [setSelectedIndices, index]);

  if (selectMode) {
    const checked = selectedIndices.has(index);
    return (
      <button className={`msg-select-btn${checked ? " checked" : ""}`} onClick={toggleSelected} title={checked ? "Deselect" : "Select"}>
        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      </button>
    );
  }

  return (
    <div className="msg-menu-wrap" ref={wrapRef}>
      <button className="msg-menu-trigger" onClick={() => { setOpen(o => !o); setConfirmDelete(false); }} title="Message actions">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
      </button>
      {open && (
        <div className="msg-menu-popup" ref={popupRef}>
          {!confirmDelete ? (
            <>
              {canEdit && onEdit && (
                <button className="msg-menu-item" onClick={() => { close(); onEdit(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Edit
                </button>
              )}
              <button className="msg-menu-item" onClick={handleCopy}>
                {copied
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                }
                {copied ? "Copied!" : "Copy"}
              </button>
              <button className="msg-menu-item msg-menu-item-delete" onClick={() => setConfirmDelete(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                Delete
              </button>
              <div className="msg-menu-divider" />
              <button className="msg-menu-item" onClick={handleBranch}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
                Branch from here
              </button>
              <button className="msg-menu-item" onClick={handleSelect}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="9 11 12 14 22 4" /></svg>
                Select
              </button>
            </>
          ) : (
            <div className="msg-menu-del-confirm">
              <span className="msg-menu-del-label">Delete this message?</span>
              <div className="msg-menu-del-btns">
                <button className="msg-menu-del-yes" onClick={handleDeleteConfirm}>Delete</button>
                <button className="msg-menu-del-no" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Icons & Helpers ────────────────────────────────── */
const FILE_ICONS: Record<string, React.ReactNode> = {
  py: <SiPython color="#3776AB" />,
  ts: <SiTypescript color="#3178C6" />,
  tsx: <SiReact color="#61DAFB" />,
  html: <SiHtml5 color="#E34F26" />,
  css: <SiCss color="#1572B6" />,
  default: <FiFile color="inherit" />
};

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return <div className="file-icon-wrapper">{FILE_ICONS[ext] || FILE_ICONS.default}</div>;
}

const EFFORT_FILL: Record<string, number> = { MINIMAL: 1, LOW: 2, MEDIUM: 3, HIGH: 4 };
export function EffortIcon({ effort }: { effort: string }) {
  const fill = EFFORT_FILL[effort] ?? 3;
  return (
    <div className="effort-bars" data-effort={effort}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="effort-bar" data-active={i <= fill} />
      ))}
    </div>
  );
}

/* ── Copy Button ─────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button className="code-copy-btn" onClick={handleCopy} title="Copy">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

/* ── Thinking Block ──────────────────────────────────── */
export function ThinkingBlock({ chunks, done, index }: { chunks: string[]; done: boolean; index: number }) {
  const [open, setOpen] = useState(false);
  const text = chunks.join("");
  const tokenCount = Math.round(text.length / 4);
  return (
    <div className={`thinking-block${done ? " done" : ""}`}>
      <BranchBtn index={index} />
      <div className="thinking-header" onClick={() => setOpen(o => !o)}>
        <svg className={`block-chevron${open ? " open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="block-label">{done ? "Thought" : "Thinking..."}</span>
        {!open && tokenCount > 0 && <span className="block-meta">{tokenCount} tokens</span>}
      </div>
      {open && <div className="thinking-content">{text}</div>}
    </div>
  );
}

/* ── Helpers for tool display ───────────────────────── */
function humanToolName(name: string): string {
  if (!name) return "Tool";
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function toolSummary(name: string, args: Record<string, unknown>): string {
  if (!name) return "";
  const lower = name.toLowerCase();
  if (lower.includes("read") || lower.includes("view")) {
    const p = (args.path || args.file || args.AbsolutePath || "") as string;
    return p ? p.replace(/\\/g, "/").split("/").slice(-2).join("/") : "";
  }
  if (lower.includes("write") || lower.includes("create") || lower.includes("edit") || lower.includes("replace")) {
    const p = (args.path || args.file || args.TargetFile || "") as string;
    return p ? p.replace(/\\/g, "/").split("/").slice(-2).join("/") : "";
  }
  if (lower.includes("search") || lower.includes("grep") || lower.includes("find")) {
    const q = (args.query || args.Query || args.pattern || args.Pattern || "") as string;
    return q ? `"${q}"` : "";
  }
  if (lower.includes("command") || lower.includes("bash") || lower.includes("shell") || lower.includes("exec")) {
    const cmd = (args.command || args.CommandLine || args.cmd || "") as string;
    return cmd ? (cmd.length > 60 ? cmd.slice(0, 57) + "…" : cmd) : "";
  }
  if (lower === "list_dir" || lower.includes("ls")) {
    const p = (args.path || args.DirectoryPath || args.directory || "") as string;
    return p ? p.replace(/\\/g, "/").split("/").slice(-2).join("/") : "";
  }
  // Fallback: show first string arg value
  const first = Object.values(args).find(v => typeof v === "string") as string | undefined;
  return first ? (first.length > 50 ? first.slice(0, 47) + "…" : first) : "";
}

function ToolIcon({ hasResult, isError }: { hasResult: boolean; isError: boolean }) {
  if (!hasResult) {
    return (
      <svg className="tool-status-icon spinning" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  if (isError) {
    return (
      <svg className="tool-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  return (
    <svg className="tool-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Tool Block ──────────────────────────────────────── */
export function ToolBlock({
  name,
  args,
  result,
  resultError,
  index,
  content,
}: {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  resultError?: boolean;
  index: number;
  content?: string;
}) {
  const { setActiveArtifact } = useChatContext();
  const [open, setOpen] = useState(false);
  const summary = toolSummary(name, args);
  const hasResult = result !== undefined;
  const isFileEdit = name === "filesystem" && (args.operation === "write" || args.operation === "edit");

  if (isFileEdit && hasResult && !resultError) {
    const path = (args.path as string) || "file";
    return (
      <div className="file-change-card msg-assistant">
        <BranchBtn index={index} />
        <div className="file-change-main">
          <FileIcon path={path} />
          <span className="file-change-label">Edited</span>
          <span className="file-change-name">{path.split(/[\\/]/).pop()}</span>
          <div className="file-change-stats">
            {args.operation === "write" ? (
              <span className="stat-add">+{Math.round((content?.length || 0) / 40)}</span>
            ) : (
              <>
                <span className="stat-add">+11</span>
                <span className="stat-del">-2</span>
              </>
            )}
          </div>
        </div>
        {content && (
          <button 
            className="file-diff-btn" 
            onClick={() => {
              const lang = path.split(".").pop() || "text";
              setActiveArtifact({ title: path, content, language: lang });
            }}
            title="Open Diff"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`tool-block${hasResult ? (resultError ? " error" : " success") : " pending"}`}>
      <BranchBtn index={index} />
      <div className={`tool-header${open ? " open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }} onClick={() => setOpen(o => !o)}>
          <svg className={`block-chevron${open ? " open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          <span className="tool-name">{humanToolName(name)}</span>
          {!open && summary && <span className="tool-summary">{summary}</span>}
        </div>
        
        {content && (
          <button 
            className="code-copy-btn" 
            style={{ marginRight: "12px" }}
            onClick={(e) => {
              e.stopPropagation();
              const path = (args.path as string) || "file";
              const lang = path.split(".").pop() || "text";
              setActiveArtifact({ title: path, content, language: lang });
            }}
            title="Open in Artifact View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </button>
        )}

        <span className="tool-status-right">
          <ToolIcon hasResult={hasResult} isError={!!resultError} />
        </span>
      </div>
      {open && (
        <div className="tool-body">
          <div className="tool-args-section">
            {Object.entries(args).map(([k, v]) => (
              <div key={k} className="tool-arg-row">
                <span className="tool-arg-key">{k}</span>
                <span className="tool-arg-val">{typeof v === "string" ? v : JSON.stringify(v)}</span>
              </div>
            ))}
            {Object.keys(args).length === 0 && <span className="tool-arg-empty">No arguments</span>}
          </div>
          {hasResult && (
            <div className={`tool-result-section${resultError ? " error" : ""}`}>
              <div className="tool-result-header">
                <span>{resultError ? "Error" : "Output"}</span>
                <CopyButton text={result} />
              </div>
              <pre className="tool-result-content">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Response Block (Markdown) ───────────────────────── */
export function ResponseBlock({ chunks, index }: { chunks: string[]; index: number }) {
  const { setActiveArtifact } = useChatContext();
  const text = chunks.join("");
  return (
    <>
    <div className="msg-response">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <div className="code-block-wrapper">
                  <div className="code-block-header">
                    <span className="code-block-lang">{match[1]}</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button 
                        className="code-copy-btn" 
                        onClick={() => setActiveArtifact({ title: "", content: codeStr, language: match[1] })}
                        title="Open as Artifact"
                      >
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                      </button>
                      <CopyButton text={codeStr} />
                    </div>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 8px 8px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      background: "#0d1117",
                    }}
                  >
                    {codeStr}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          table({ children }) {
            return (
              <div className="table-wrapper">
                <table>{children}</table>
              </div>
            );
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
    <MsgActionMenu index={index} text={text} />
    </>
  );
}

/* ── User Message ────────────────────────────────────── */
export function UserMsg({ text, index }: { text: string; index: number }) {
  const { setMessages } = useChatContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      const len = draft.length;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleEditStart = useCallback(() => {
    setDraft(text);
    setEditing(true);
  }, [text]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) {
      setMessages(prev => prev.map((m, i) => i === index ? { ...m, text: trimmed } as typeof m : m));
    }
    setEditing(false);
  }, [draft, text, index, setMessages]);

  const handleCancel = useCallback(() => {
    setDraft(text);
    setEditing(false);
  }, [text]);

  return (
    <div className="msg msg-user">
      <div className="thread-dot user" />
      <div className="msg-body">
        {editing ? (
          <div className="msg-edit-wrap">
            <textarea
              ref={textareaRef}
              className="msg-edit-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
                if (e.key === "Escape") handleCancel();
              }}
              rows={Math.max(1, draft.split("\n").length)}
            />
            <div className="msg-edit-actions">
              <button className="msg-edit-save" onClick={handleSave}>Save</button>
              <button className="msg-edit-cancel" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="msg-user-bubble">
              <span>{text}</span>
            </div>
            <MsgActionMenu index={index} text={text} canEdit onEdit={handleEditStart} />
          </>
        )}
      </div>
    </div>
  );
}
