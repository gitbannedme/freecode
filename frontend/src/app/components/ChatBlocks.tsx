import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useChatContext } from "../context/ChatContext";

/* ── Branch Button ──────────────────────────────────── */
function BranchBtn({ index }: { index: number }) {
  const { branch } = useChatContext();
  return (
    <button className="branch-btn" onClick={() => branch(index)} title="Branch from here">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
    </button>
  );
}

/* ── Effort Icon ─────────────────────────────────────── */
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
        <div className={`thinking-pulse${done ? " done" : ""}`} />
        <span className="block-label">{done ? "Thought" : "Thinking"}</span>
        {!open && tokenCount > 0 && <span className="block-meta">{tokenCount} tokens</span>}
      </div>
      {open && <div className="thinking-content">{text}</div>}
    </div>
  );
}

/* ── Helpers for tool display ───────────────────────── */
function humanToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function toolSummary(name: string, args: Record<string, unknown>): string {
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
}: {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  resultError?: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(name, args);
  const hasResult = result !== undefined;

  return (
    <div className={`tool-block${hasResult ? (resultError ? " error" : " success") : " pending"}`}>
      <BranchBtn index={index} />
      <div className={`tool-header${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <svg className={`block-chevron${open ? " open" : ""}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="tool-name">{humanToolName(name)}</span>
        {!open && summary && <span className="tool-summary">{summary}</span>}
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
    <div className="msg-response">
      <BranchBtn index={index} />
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
  );
}

/* ── User Message ────────────────────────────────────── */
export function UserMsg({ text, index }: { text: string; index: number }) {
  return (
    <div className="msg msg-user">
      <BranchBtn index={index} />
      <div className="msg-user-bubble">
        <span>{text}</span>
      </div>
    </div>
  );
}
