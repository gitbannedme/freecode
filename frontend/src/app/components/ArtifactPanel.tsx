import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useChatContext } from "../context/ChatContext";

interface ArtifactPanelProps {
  title: string;
  content: string;
  language: string;
  onClose: () => void;
}

export function ArtifactPanel({ title, content, language, onClose }: ArtifactPanelProps) {
  const { addPin, pinnedFiles } = useChatContext();
  const isPinned = pinnedFiles.includes(title);

  return (
    <div className="artifact-panel">
      <div className="artifact-header">
        <div className="artifact-title-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          <span className="artifact-title">{title || "Untitled Artifact"}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className={`artifact-pin-btn${isPinned ? " active" : ""}`} 
            onClick={() => addPin(title)}
            title={isPinned ? "Pinned to context" : "Pin to context"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H14.76a2 2 0 0 1 1.79 1.1L18 14" /><path d="M10 10V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v4" /><path d="M3 14h18" /><path d="M19 14v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" /></svg>
          </button>
          <button className="artifact-close" onClick={onClose} title="Close Artifact">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
      <div className="artifact-body">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "20px",
            fontSize: "13px",
            lineHeight: "1.6",
            background: "transparent",
            height: "100%",
            overflow: "auto"
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
      <div className="artifact-footer">
         <span className="artifact-meta">{language.toUpperCase()} • {content.split("\n").length} lines</span>
      </div>
    </div>
  );
}
