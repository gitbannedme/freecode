import React, { useState } from "react";

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

export function ThinkingBlock({ chunks, done }: { chunks: string[]; done: boolean }) {
  const [open, setOpen] = useState(false);
  const text = chunks.join("");
  return (
    <div className="thinking-block">
      <div className="thinking-header" onClick={() => setOpen(o => !o)}>
        <span className={`thinking-expand${open ? " open" : ""}`}>▶</span>
        <span style={{ color: "var(--dim2)", fontSize: 10 }}>{done ? "●" : "○"}</span>
        <span>{done ? "Thought" : "Thinking"}</span>
        {!open && text && <span style={{ color: "var(--dim3)", fontSize: 10, marginLeft: "auto" }}>{Math.round(text.length / 4)} tokens</span>}
      </div>
      {open && <div className="thinking-content">{text}</div>}
    </div>
  );
}

export function ToolBlock({
  name,
  args,
  result,
  resultError,
}: {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  resultError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  
  return (
    <div className="tool-block">
      <div className={`tool-header${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <span className="tool-icon" style={{ color: "var(--accent-blue)", fontSize: 10 }}>{open ? "▼" : "▶"}</span>
        <span className="tool-name">{name}</span>
        {!open && <span className="tool-args-inline">{argsStr}</span>}
        {result !== undefined && (
          <span style={{ marginLeft: "auto", color: resultError ? "#f85149" : "var(--accent-green)", fontSize: 12 }}>
            {resultError ? "✕" : "✓"}
          </span>
        )}
      </div>
      {open && (
        <div className="tool-body">
          <div style={{ padding: "8px 12px", color: "var(--dim2)", fontSize: 11, background: "rgba(255,255,255,0.01)", borderBottom: "1px solid var(--border)" }}>
             {argsStr || "(no args)"}
          </div>
          {result !== undefined && (
            <div className={`tool-result-block ${resultError ? "tool-result-err" : "tool-result-ok"}`}>
              {result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResponseBlock({ chunks }: { chunks: string[] }) {
  const text = chunks.join("");
  const html = text
    .replace(/\*\*([^\*]+)\*\*/g, "<STRONG>$1</STRONG>")
    .replace(/\*([^\*]+)\*/g, "<EM>$1</EM>")
    .replace(/`([^`]+)`/g, "<CODE>$1</CODE>")
    .replace(/^### (.*?)$/gm, "<H3>$1</H3>")
    .replace(/^## (.*?)$/gm, "<H2>$1</H2>")
    .replace(/^# (.*?)$/gm, "<H1>$1</H1>")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;STRONG&gt;/g, "<strong>")
    .replace(/&lt;\/STRONG&gt;/g, "</strong>")
    .replace(/&lt;EM&gt;/g, "<em>")
    .replace(/&lt;\/EM&gt;/g, "</em>")
    .replace(/&lt;CODE&gt;/g, "<code>")
    .replace(/&lt;\/CODE&gt;/g, "</code>")
    .replace(/&lt;H1&gt;/g, "<h1>")
    .replace(/&lt;\/H1&gt;/g, "</h1>")
    .replace(/&lt;H2&gt;/g, "<h2>")
    .replace(/&lt;\/H2&gt;/g, "</h2>")
    .replace(/&lt;H3&gt;/g, "<h3>")
    .replace(/&lt;\/H3&gt;/g, "</h3>")
    .replace(/\n/g, "<br/>");
  return <div className="msg-response" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function UserMsg({ text }: { text: string }) {
  return (
    <div className="msg msg-user">
      <div className="msg-user-text">
        <span className="prompt-arrow">&gt;</span>
        <span>{text}</span>
      </div>
    </div>
  );
}
