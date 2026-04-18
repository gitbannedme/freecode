"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import OnboardingModal from "./components/OnboardingModal";
import SettingsPanel from "./components/SettingsPanel";
import { getApiKey, saveApiKey, getConfigFromBackend } from "./lib/config";

import { FolderIcon, GearIcon, EditIcon, SearchIcon, PlusIcon, TrashIcon } from "./components/Icons";
import { Popover } from "./components/Popover";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "ws://127.0.0.1:47820";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_MODEL || "gemma-4-26b-a4b-it";

declare global {
  interface Window {
    pywebview?: { api: { pick_folder(): Promise<string | null> } };
  }
}

const MODELS: { label: string; id: string; provider: string }[] = [
  { label: "Gemma 4 31B",             id: "gemma-4-31b-it", provider: "Gemma" },
  { label: "Gemma 4 26B",             id: "gemma-4-26b-a4b-it", provider: "Gemma" },
  { label: "Gemma 3 27B",             id: "gemma-3-27b-it", provider: "Gemma" },
  { label: "Gemma 3 12B",             id: "gemma-3-12b-it", provider: "Gemma" },
  { label: "Gemma 3 4B",              id: "gemma-3-4b-it", provider: "Gemma" },
  { label: "Gemma 3 1B",              id: "gemma-3-1b-it", provider: "Gemma" },
  { label: "Gemma 3n E4B",            id: "gemma-3n-e4b-it", provider: "Gemma" },
  { label: "Gemma 3n E2B",            id: "gemma-3n-e2b-it", provider: "Gemma" },
  { label: "Gemini 3 Flash",          id: "gemini-3-flash-preview", provider: "Gemini" },
  { label: "Gemini 3.1 Flash Lite",   id: "gemini-3.1-flash-lite-preview", provider: "Gemini" },
];

const RECENT_DIRS_KEY = "freecode:recent_dirs";
const COMPACT_THRESHOLD_KEY = "freecode:compact_threshold";
const AUTO_COMPACT_KEY = "freecode:auto_compact";
const SESSION_ID_KEY = "freecode:session_id";
const DEFAULT_THRESHOLD = 80;

function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return generateSessionId();
  }
}

function loadRecentDirs(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_DIRS_KEY) || "[]"); } catch { return []; }
}
function saveRecentDir(dir: string) {
  const dirs = [dir, ...loadRecentDirs().filter(d => d !== dir)].slice(0, 8);
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs));
}

function shortenPath(path: string | null): string {
  if (!path) return "~";
  // Windows: C:\Users\Name\Projects\foo -> ~\Projects\foo
  const parts = path.split(/[\\\/]/);
  const usersIdx = parts.findIndex(p => p.toLowerCase() === "users");
  if (usersIdx !== -1 && parts.length > usersIdx + 1) {
    // We assume parts[usersIdx+1] is the username
    return "~\\" + parts.slice(usersIdx + 2).join("\\");
  }
  // Fallback for non-User paths or simple names
  return path.length > 30 ? "..." + path.slice(-27) : path;
}

// Effort levels styling handled in globals.css via data-effort attribute.


const EFFORT_FILL: Record<string, number> = { MINIMAL: 1, LOW: 2, MEDIUM: 3, HIGH: 4 };

function EffortIcon({ effort }: { effort: string }) {
  const fill = EFFORT_FILL[effort] ?? 3;
  return (
    <div className="effort-bars" data-effort={effort}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="effort-bar" data-active={i <= fill} />
      ))}
    </div>
  );
}

// ── Commands ─────────────────────────────────────────────────────────────────

// ── Commands ─────────────────────────────────────────────────────────────────

type Command = { name: string; description: string; action?: string };

const EFFORT_LEVELS = ["MINIMAL", "LOW", "MEDIUM", "HIGH"] as const;

const COMMANDS: Command[] = [
  { name: "/help",    description: "Show available commands and tips" },
  { name: "/clear",   description: "Clear the conversation history" },
  { name: "/compact", description: "Summarize and compact context to save tokens" },
  { name: "/effort",  description: "Cycle thinking effort: MINIMAL → LOW → MEDIUM → HIGH → MAX" },
  { name: "/model",   description: "Show current model name" },
  { name: "/cwd",     description: "Show current working directory" },
  { name: "/tools",   description: "List available tools (filesystem, shell…)" },
];

// ── Types ────────────────────────────────────────────────────────────────────

type MsgKind =
  | { kind: "user"; text: string }
  | { kind: "thinking"; chunks: string[]; done: boolean }
  | { kind: "tool_call"; name: string; args: Record<string, unknown> }
  | { kind: "tool_result"; name: string; args: Record<string, unknown>; result: string; error?: boolean }
  | { kind: "response"; chunks: string[] }
  | { kind: "system"; text: string }
  | { kind: "help"; commands: Command[] }
  | { kind: "error"; text: string };

// ── Sub-components ───────────────────────────────────────────────────────────

function ThinkingBlock({ chunks, done }: { chunks: string[]; done: boolean }) {
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

function ToolBlock({
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

function ResponseBlock({ chunks }: { chunks: string[] }) {
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

function UserMsg({ text }: { text: string }) {
  return (
    <div className="msg msg-user">
      <div className="msg-user-text">
        <span className="prompt-arrow">&gt;</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

const SPINNER_VERBS = [
  'Accomplishing','Actioning','Actualizing','Architecting','Baking','Beaming',
  "Beboppin'",'Befuddling','Billowing','Blanching','Bloviating','Boogieing',
  'Boondoggling','Booping','Bootstrapping','Brewing','Bunning','Burrowing',
  'Calculating','Canoodling','Caramelizing','Cascading','Catapulting','Cerebrating',
  'Channeling','Choreographing','Churning','Coalescing','Cogitating','Combobulating',
  'Composing','Computing','Concocting','Considering','Contemplating','Cooking',
  'Crafting','Creating','Crunching','Crystallizing','Cultivating','Deciphering',
  'Deliberating','Determining','Dilly-dallying','Discombobulating','Doing',
  'Doodling','Drizzling','Ebbing','Effecting','Elucidating','Embellishing',
  'Enchanting','Envisioning','Evaporating','Fermenting','Fiddle-faddling',
  'Finagling','Flowing','Flummoxing','Fluttering','Forging','Forming','Frolicking',
  'Generating','Gesticulating','Germinating','Grooving','Harmonizing','Hashing',
  'Hatching','Herding','Hullaballooing','Hyperspacing','Ideating','Imagining',
  'Improvising','Incubating','Inferring','Infusing','Ionizing','Jitterbugging',
  'Kneading','Leavening','Levitating','Lollygagging','Manifesting','Marinating',
  'Meandering','Metamorphosing','Misting','Moonwalking','Moseying','Mulling',
  'Mustering','Musing','Nebulizing','Nesting','Noodling','Nucleating','Orbiting',
  'Orchestrating','Osmosing','Perambulating','Percolating','Perusing',
  'Philosophising','Photosynthesizing','Pollinating','Pondering','Pontificating',
  'Pouncing','Precipitating','Processing','Proofing','Propagating','Puttering',
  'Puzzling','Quantumizing','Razzle-dazzling','Recombobulating','Reticulating',
  'Roosting','Ruminating','Scampering','Schlepping','Scurrying','Seasoning',
  'Shenaniganing','Shimmying','Simmering','Skedaddling','Sketching','Slithering',
  'Smooshing','Spelunking','Spinning','Sprouting','Stewing','Sublimating',
  'Swirling','Swooping','Symbioting','Synthesizing','Tempering','Thinking',
  'Thundering','Tinkering','Tomfoolering','Transfiguring','Transmuting','Twisting',
  'Undulating','Unfurling','Unravelling','Vibing','Waddling','Wandering','Warping',
  'Whirlpooling','Whirring','Whisking','Wibbling','Working','Wrangling','Zesting','Zigzagging',
];

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function WorkingIndicator() {
  const [f, setF] = useState(0);
  const [verb, setVerb] = useState(() => SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]);
  useEffect(() => {
    const t = setInterval(() => setF(i => (i + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setVerb(SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="working-indicator">
      <span>{SPINNER_FRAMES[f]}</span>
      <span>{verb}…</span>
    </div>
  );
}

// ── Welcome screen ───────────────────────────────────────────────────────────

function Welcome({ show, onRun }: { show: boolean; onRun: (cmd: string) => void }) {
  if (!show) return null;
  return (
    <div className="welcome-splash">
      <div className="splash-bird">
        <Image src="/logo.svg" width={64} height={64} alt="FreeCode Logo" priority />
      </div>
      <h1 className="splash-title">FREECODE</h1>
      <p className="splash-subtitle">Your personal agentic coding assistant.</p>
      
      <div className="splash-hints">
        <div className="hint-row clickable" onClick={() => onRun("/model")}>
          <span className="hint-key">/model</span> Choose your intelligence
        </div>
        <div className="hint-row clickable" onClick={() => onRun("/compact")}>
          <span className="hint-key">/compact</span> Summarize and shrink context
        </div>
        <div className="hint-row clickable" onClick={() => onRun("/help")}>
          <span className="hint-key">/help</span> Review all commands
        </div>
      </div>
    </div>
  );
}

// ── Model Picker ─────────────────────────────────────────────────────────────

function ModelPicker({ current, onSelect, onClose }: { current: string; onSelect: (id: string) => void; onClose: () => void }) {
  const providers = Array.from(new Set(MODELS.map(m => m.provider)));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <Popover onClose={onClose} className="popover-model">
        <div className="popover-header">Model</div>
        <div className="popover-list">
          {providers.map(p => (
            <div key={p} className="popover-group">
              <div className="popover-group-header" onClick={() => setCollapsed(prev => ({ ...prev, [p]: !prev[p] }))}>
                <span className={`popover-arrow${collapsed[p] ? "" : " open"}`}>▶</span>
                {p}
              </div>
              {!collapsed[p] && MODELS.filter(m => m.provider === p).map(m => (
                <div
                  key={m.id}
                  className={`popover-row${m.id === current ? " active" : ""}`}
                  onClick={() => { onSelect(m.id); onClose(); }}
                >
                  <div className="popover-info">
                     <div className="popover-label">
                       {m.label}
                       {(m.id.includes("31b") || m.id.includes("3.1")) && <span className="tag-new">New</span>}
                       {m.id.includes("high") && <span className="tag-warning">⚠️</span>}
                     </div>
                     <div className="popover-sub">{m.id}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
    </Popover>
  );
}

// ── Directory Picker ─────────────────────────────────────────────────────────


function DirPicker({ onSelect, onBrowse, onClose, recents }: { onSelect: (dir: string) => void; onBrowse: () => void; onClose?: () => void; recents: string[] }) {
  const [val, setVal] = useState("");
  const localRecents = loadRecentDirs();
  const allRecents = Array.from(new Set([...recents, ...localRecents])).slice(0, 5);

  const submit = (dir: string) => {
    const d = dir.trim();
    if (!d) return;
    saveRecentDir(d);
    onSelect(d);
  };

  const handleBrowse = async () => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({
          directory: true,
          multiple: false,
          title: "Select Project Folder"
        });
        if (picked) submit(picked as string);
        return;
      } catch (e) {
        console.error("Tauri dialog failed:", e);
      }
    }

    if (window.pywebview?.api?.pick_folder) {
      const picked = await window.pywebview.api.pick_folder();
      if (picked) submit(picked);
    } else {
      onBrowse();
    }
  };

  return (
    <Popover onClose={onClose} className="popover-dir">
      <div className="popover-header">Project</div>
      <div className="dir-popover-body">
        <div className="dir-input-wrapper">
          <input
            className="dir-input"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(val); }}
            placeholder="C:\path\to\project"
            autoFocus
          />
          <button className="dir-browse-icon" onClick={handleBrowse} title="Browse...">
            <FolderIcon />
          </button>
        </div>
        {allRecents.length > 0 && (
          <div className="dir-recents-section">
            <div className="dir-recents-label">Recent</div>
            {allRecents.map(d => (
              <div key={d} className="dir-recent-row" onClick={() => submit(d)}>
                <FolderIcon />
                <span className="dir-recent-text" title={d}>{d}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="dir-overlay" onClick={onCancel}>
      <div className="dir-box" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
        <div className="dir-title">{title}</div>
        <p style={{ color: "var(--dim2)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
        <div className="dir-actions" style={{ justifyContent: "flex-end", gap: 12 }}>
          <button className="dir-btn" style={{ background: "#da3633" }} onClick={onConfirm}>Delete</button>
          <button className="dir-btn dir-btn-tertiary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [workingDir, setWorkingDir] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("freecode:working_dir") || null;
  });
  const [messages, setMessages] = useState<MsgKind[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const id = getOrCreateSessionId();
      const sessions = JSON.parse(localStorage.getItem("freecode:sessions") || "{}");
      return sessions[id]?.messages || [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [sessionId] = useState<string>(() =>
    typeof window !== "undefined" ? getOrCreateSessionId() : generateSessionId()
  );
  const [model, setModel] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    return localStorage.getItem("freecode:model") || DEFAULT_MODEL;
  });
  const [effort, setEffort] = useState<typeof EFFORT_LEVELS[number]>("MEDIUM");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [serverRecents, setServerRecents] = useState<string[]>([]);
  const [contextPct, setContextPct] = useState<number | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, { id: string, name: string, updatedAt: number, messages: MsgKind[], workingDir?: string }>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("freecode:sessions") || "{}");
    } catch {
      return {};
    }
  });
  const [compactThreshold, setCompactThreshold] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THRESHOLD;
    return Number(localStorage.getItem(COMPACT_THRESHOLD_KEY) ?? DEFAULT_THRESHOLD);
  });
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [autoCompact, setAutoCompact] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_COMPACT_KEY) !== "false";
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return !getApiKey();
  });
  const [showSettings, setShowSettings] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backendHasKey = useRef<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    // Initial config sync from backend to avoid repeated onboarding and restore project
    getConfigFromBackend().then(cfg => {
      if (cfg?.api_key) {
        backendHasKey.current = true;
        saveApiKey(cfg.api_key);
        setShowOnboarding(false);


        // Restore last project if no local state
        const localDir = localStorage.getItem("freecode:working_dir");
        if (cfg.working_dir && !localDir) {
          setWorkingDir(cfg.working_dir);
          localStorage.setItem("freecode:working_dir", cfg.working_dir);
        }
      }
    });
  }, []);

  // Track pending tool calls so we can attach results
  const pendingToolRef = useRef<Map<string, number>>(new Map());

  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesAreaRef.current) return;
    const el = messagesAreaRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
    if (force || isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);



  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContextMenu);
    return () => document.removeEventListener("contextmenu", preventContextMenu);
  }, []);

  const handleOnboardingComplete = useCallback(async (apiKey: string) => {
    saveApiKey(apiKey);
    backendHasKey.current = false;
    setShowOnboarding(false);

    // Reconnect WebSocket so backend picks up the new API key via __init__
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const handleServerMessage = useCallback((raw: string) => {
    const msg = JSON.parse(raw);

    // Non-chat protocol messages — handle without touching setMessages
    if (msg.type === "hello") {
      if (msg.recent_dirs) setServerRecents(msg.recent_dirs);
      return;
    }

    if (msg.type === "session") {
      setMessages(prev => {
        // Only restore if we don't have a real conversation going
        const hasConversation = prev.some(m => m.kind === "user" || m.kind === "response");
        if (!hasConversation && msg.messages && msg.messages.length > 0) {
          return msg.messages.map((m: any) => {
            if (m.role === "user") return { kind: "user", text: m.content };
            if (m.role === "model") return { kind: "response", chunks: [m.content] };
            if (m.role === "tool") return { kind: "tool_result", name: "Result", args: {}, result: m.content };
            if (m.role === "system") return { kind: "system", text: m.content };
            return { kind: "system", text: m.content }; // fallback
          });
        }
        return prev;
      });
      return;
    }
    if (msg.type === "sessions_list") {
      const backendSessions = (msg.sessions ?? []) as Array<{ id: string; name: string; updated_at: string; working_dir: string; model: string }>;
      setSavedSessions(prev => {
        const next = { ...prev };
        for (const s of backendSessions) {
          // Merge backend sessions in — don't overwrite current session's live messages
          if (!next[s.id] || next[s.id].messages.length === 0) {
            next[s.id] = {
              id: s.id,
              name: s.name,
              updatedAt: new Date(s.updated_at ?? 0).getTime(),
              messages: next[s.id]?.messages ?? [],
              workingDir: s.working_dir,
            };
          }
        }
        return next;
      });
      return;
    }

    setMessages(prev => {
      const next = [...prev];

      switch (msg.type) {
        case "thinking": {
          const last = next[next.length - 1];
          if (last?.kind === "thinking" && !last.done) {
            last.chunks.push(msg.chunk ?? "");
          } else {
            next.push({ kind: "thinking", chunks: [msg.chunk ?? ""], done: false });
          }
          break;
        }

        case "tool_call": {
          const idx = next.length;
          pendingToolRef.current.set(msg.tool_name, idx);
          next.push({ kind: "tool_call", name: msg.tool_name, args: msg.tool_args ?? {} });
          break;
        }

        case "tool_result": {
          const toolIdx = pendingToolRef.current.get(msg.tool_name);
          if (toolIdx !== undefined) {
            const block = next[toolIdx];
            if (block?.kind === "tool_call") {
              next[toolIdx] = {
                kind: "tool_result",
                name: block.name,
                args: block.args,
                result: msg.result ?? "",
              };
            }
            pendingToolRef.current.delete(msg.tool_name);
          } else {
            next.push({ kind: "tool_result", name: msg.tool_name, args: {}, result: msg.result ?? "" });
          }
          break;
        }

        case "response": {
          // Mark any open thinking as done
          for (let i = next.length - 1; i >= 0; i--) {
            const block = next[i];
            if (block.kind === "thinking") {
              block.done = true;
              break;
            }
          }
          const last = next[next.length - 1];
          if (last?.kind === "response") {
            last.chunks.push(msg.chunk ?? "");
          } else {
            next.push({ kind: "response", chunks: [msg.chunk ?? ""] });
          }
          break;
        }

        case "system": {
          const text = msg.message ?? "";
          // Skip init announcements — they're noise, not conversation
          if (!text.startsWith("Working directory: ") && text !== "pong") {
            next.push({ kind: "system", text });
          }
          if (text.startsWith("Working directory: ")) {
            const dir = text.replace("Working directory: ", "").trim();
            setWorkingDir(dir);
          }
          break;
        }

        case "done":
          setWorking(false);
          for (let i = next.length - 1; i >= 0; i--) {
            const block = next[i];
            if (block.kind === "thinking") {
              block.done = true;
              break;
            }
          }
          if (msg.context_pct != null) {
            setContextPct(msg.context_pct);
          }
          break;

        case "error":
          next.push({ kind: "error", text: msg.error ?? "Unknown error" });
          setWorking(false);
          break;
      }

      return next;
    });

    setTimeout(() => scrollToBottom(), 20);

    // Persist to localStorage and update session list (without cascading render)
    setMessages(msgs => {
      const firstUserMsg = msgs.find((m): m is Extract<MsgKind, { kind: "user" }> => m.kind === "user");
      const name = firstUserMsg?.text.slice(0, 30) || "New Session";
      const sessions = JSON.parse(localStorage.getItem("freecode:sessions") || "{}");
      sessions[sessionId] = {
        id: sessionId,
        name: name.length === 30 ? name + "..." : name,
        updatedAt: Date.now(),
        messages: msgs,
        workingDir: workingDir ?? undefined,
      };
      localStorage.setItem("freecode:sessions", JSON.stringify(sessions));
      setSavedSessions(sessions);
      return msgs;
    });
  }, [scrollToBottom, sessionId, workingDir]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(COMPACT_THRESHOLD_KEY, String(compactThreshold));
  }, [compactThreshold]);
  useEffect(() => {
    localStorage.setItem(AUTO_COMPACT_KEY, String(autoCompact));
  }, [autoCompact]);
  useEffect(() => {
    localStorage.setItem("freecode:model", model);
  }, [model]);

  // Auto-compact when threshold exceeded
  useEffect(() => {
    if (autoCompact && contextPct != null && contextPct >= compactThreshold && messages.length > 5) {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "user_input", text: "Please summarize our conversation so far to compact the context.", effort, session_id: sessionId }));
      }
    }
  }, [contextPct, autoCompact, compactThreshold, effort, sessionId]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let dead = false;

    function connect() {
      const ws = new WebSocket(BACKEND_URL);

      ws.onopen = () => {
        setConnected(true);
        setConnectionError(null);
        retryDelay = 1000;
        // Re-announce session + working dir to backend after connect/reconnect
        const savedDir = localStorage.getItem("freecode:working_dir");
        const savedSes = (() => { try { return JSON.parse(localStorage.getItem("freecode:sessions") || "{}"); } catch { return {}; } })();
        const sesId = localStorage.getItem(SESSION_ID_KEY) || sessionId;
        const sesDir = savedSes[sesId]?.workingDir || savedDir;
        if (sesDir) {
          const initMsg: Record<string, string> = {
            type: "user_input",
            text: "__init__",
            session_id: sesId,
            working_dir: sesDir,
            model: localStorage.getItem("freecode:model") || DEFAULT_MODEL
          };
          if (!backendHasKey.current) {
            const apiKey = localStorage.getItem("freecode:api_key");
            if (apiKey) initMsg.api_key = apiKey;
          }
          ws.send(JSON.stringify(initMsg));
          // Request sessions list for this working dir
          ws.send(JSON.stringify({ type: "list_sessions", working_dir: sesDir, session_id: sesId }));
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          setConnected(false);
          wsRef.current = null;
        }
        if (!dead) retryTimeout = setTimeout(connect, retryDelay = Math.min(retryDelay * 2, 10000));
      };
      ws.onerror = () => { /* onclose fires after, handles retry */ };
      ws.onmessage = e => handleServerMessage(e.data);

      wsRef.current = ws;
    }

    connect();
    return () => {
      dead = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, [handleServerMessage, sessionId]);

  // Re-connect logic handled by wsRef and effects below


  const runCommand = useCallback((rawInput: string) => {
    const name = rawInput.split(" ")[0];
    setInput("");
    switch (name) {
      case "/clear":
        setMessages([]);
        setContextPct(0);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "user_input", text: "/clear", effort, session_id: sessionId }));
        }
        break;

      case "/model": {
        const parts = rawInput.split(" ");
        if (parts.length > 1) {
          const newModel = parts[1];
          setModel(newModel);
          setMessages(p => [...p, { kind: "system", text: `Model switched to ${newModel}` }]);
        } else {
          setMessages(p => [...p, { kind: "system", text: `Current model: ${model} (type /model [name] to switch)` }]);
        }
        break;
      }
      case "/cwd":
        setMessages(p => [...p, { kind: "system", text: `Working dir: ${workingDir ?? "."}` }]);
        break;
      case "/tools":
        setMessages(p => [...p, { kind: "system", text: "Available tools: filesystem (ls, read, write, edit, find), shell (run)" }]);
        break;
      case "/help":
        setMessages(p => [...p, { kind: "help", commands: COMMANDS }]);
        break;
      case "/effort": {
        const next = EFFORT_LEVELS[(EFFORT_LEVELS.indexOf(effort) + 1) % EFFORT_LEVELS.length];
        setEffort(next);
        // Silent — reflected in status bar only, no chat spam
        break;
      }
      case "/compact":
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type: "user_input", text: "/compact — please summarize our conversation so far", effort, session_id: sessionId }));
        break;
    }
  }, [effort, setEffort, workingDir, sessionId, model]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    // If palette is open and user presses Enter, select highlighted command
    if (paletteOpen) {
      runCommand(paletteMatches[paletteIdx]?.name ?? text);
      return;
    }

    // Handle slash commands
    if (text.startsWith("/")) {
      runCommand(text);
      return;
    }

    if (working) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError("Connection lost. Reconnecting...");
      return;
    }
    setConnectionError(null);
    
    setInput("");
    setWorking(true);
    setMessages(prev => {
      const next: MsgKind[] = [...prev, { kind: "user", text }];
      // Sync sessions
      const firstUserMsg = next.find((m): m is Extract<MsgKind, { kind: "user" }> => m.kind === "user");
      const name = firstUserMsg?.text.slice(0, 30) || "New Session";
      const sessions = JSON.parse(localStorage.getItem("freecode:sessions") || "{}");
      sessions[sessionId] = {
        id: sessionId,
        name: name.length === 30 ? name + "..." : name,
        updatedAt: Date.now(),
        messages: next,
        workingDir: workingDir ?? undefined,
      };
      localStorage.setItem("freecode:sessions", JSON.stringify(sessions));
      setSavedSessions(sessions);
      return next;
    });
    setTimeout(() => scrollToBottom(true), 20);
    wsRef.current.send(JSON.stringify({ type: "user_input", text, effort, working_dir: workingDir ?? ".", model, session_id: sessionId }));
  }, [input, paletteOpen, paletteMatches, paletteIdx, runCommand, scrollToBottom, model, workingDir, effort, sessionId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (paletteOpen) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPaletteIdx(i => (i - 1 + paletteMatches.length) % paletteMatches.length);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPaletteIdx(i => (i + 1) % paletteMatches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setInput(paletteMatches[paletteIdx]?.name ?? input);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [paletteOpen, paletteMatches, paletteIdx, input, handleSend]);

  const renderMessage = (msg: MsgKind, i: number) => {
    switch (msg.kind) {
      case "user":
        return <UserMsg key={i} text={msg.text} />;

      case "thinking":
        return (
          <div key={i} className={`msg msg-assistant${msg.done ? " done" : ""}`}>
            <ThinkingBlock chunks={msg.chunks} done={msg.done} />
          </div>
        );

      case "tool_call":
        return (
          <div key={i} className="msg msg-assistant">
            <ToolBlock name={msg.name} args={msg.args} />
          </div>
        );

      case "tool_result":
        return (
          <div key={i} className="msg msg-assistant">
            <ToolBlock
              name={msg.name}
              args={msg.args}
              result={msg.result}
              resultError={msg.error}
            />
          </div>
        );

      case "response":
        return (
          <div key={i} className="msg msg-assistant">
            <ResponseBlock chunks={msg.chunks} />
          </div>
        );

      case "system":
        return <div key={i} className="msg-system">{msg.text}</div>;

      case "help":
        return (
          <div key={i} className="msg msg-assistant">
            <div className="help-block">
              <div className="help-header">AVAILABLE COMMANDS</div>
              {msg.commands.map(c => (
                <div key={c.name} className="help-row">
                  <span className="help-name" onClick={() => runCommand(c.name)}>{c.name}</span>
                  <span className="help-desc">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "error":
        return <div key={i} className="msg-error">✗ {msg.text}</div>;
    }
  };

  const handleDirSelect = (dir: string) => {
    setWorkingDir(dir);
    localStorage.setItem("freecode:working_dir", dir);
    saveRecentDir(dir);
    // Request sessions for this project directory
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "list_sessions", working_dir: dir, session_id: sessionId }));
    }
  };

  if (!isMounted) {
    return (
      <div className="app">
        <div className="main-row">
          <div className="sidebar-col closed" />
          <div className="chat-col">
            <div className="messages-area">
              <Welcome show={true} onRun={() => {}} />
            </div>
            <div className="input-outer">
              <div className="input-container">
                <div className="input-box">
                  <span className="input-prompt divider">│</span>
                  <input disabled placeholder="Warming up..." />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Onboarding modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        initialApiKey={getApiKey() || ""}
      />

      {/* Settings panel */}
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />


      {/* Model picker overlay */}
      {modelPickerOpen && (
        <ModelPicker
          current={model}
          onSelect={(id) => {
            setModel(id);
            setMessages(p => [...p, { kind: "system", text: `Model switched to ${id}` }]);
          }}
          onClose={() => setModelPickerOpen(false)}
        />
      )}

      {/* Directory picker — shown when no project or user opens it */}
      {(!workingDir || dirPickerOpen) && !showOnboarding && (
        <DirPicker
          onSelect={(dir) => { handleDirSelect(dir); setDirPickerOpen(false); }}
          onBrowse={async () => {
            const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
            if (isTauri) {
              const { open } = await import("@tauri-apps/plugin-dialog");
              const picked = await open({ directory: true, multiple: false });
              if (picked) { handleDirSelect(picked as string); setDirPickerOpen(false); }
              return;
            }
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "pick_dir", session_id: sessionId }));
            }
          }}
          onClose={() => setDirPickerOpen(false)}
          recents={serverRecents}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || ""}
        message={confirmModal?.message || ""}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={() => setConfirmModal(null)}
      />

      {/* Main Layout Area */}
      <div className="main-row">
        {/* Sidebar */}
        <div className={`sidebar-col ${sidebarOpen ? "" : "closed"}`}>
          {/* Project Header */}
          <div className="sidebar-project-select" onClick={() => setDirPickerOpen(true)} title={workingDir || "Switch Project"}>
             <div className="project-select-inner">
               <FolderIcon />
               <div className="project-info">
                 <span className="project-label">WORKSPACE</span>
                 <span className="project-name">{workingDir ? workingDir.split(/[\\\/]/).filter(Boolean).pop() : "No Project"}</span>
               </div>
             </div>
             <span className="project-arrow">↕</span>
          </div>

          <div className="sidebar-content">
            <div className="sidebar-header">
              {isSearching ? (
                <div className="sidebar-search-inline">
                  <input 
                    autoFocus
                    className="sidebar-search" 
                    placeholder="Search..." 
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    onBlur={() => { if (!sessionSearch) setIsSearching(false); }}
                    onKeyDown={e => { if (e.key === "Escape") { setIsSearching(false); setSessionSearch(""); } }}
                  />
                </div>
              ) : (
                <span className="sidebar-title">CHATS</span>
              )}
              
              <div className="sidebar-header-actions">
                <button className="sidebar-header-btn" onClick={() => setIsSearching(!isSearching)} title="Search Chats">
                  <SearchIcon />
                </button>
                <button className="sidebar-header-btn" title="New Chat" onClick={() => {
                  if (working) {
                    setConfirmModal({
                        title: "New Chat",
                        message: "Session is still working. Start new chat anyway?",
                        onConfirm: () => {
                          localStorage.removeItem(SESSION_ID_KEY);
                          window.location.reload();
                        }
                    });
                  } else {
                    localStorage.removeItem(SESSION_ID_KEY);
                    window.location.reload();
                  }
                }}>
                  <PlusIcon />
                </button>
              </div>
            </div>
            <div className="sidebar-list">
              {Object.values(savedSessions)
                .filter(ses => (workingDir === null || ses.workingDir === workingDir) && ses.name.toLowerCase().includes(sessionSearch.toLowerCase()))
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(ses => (
                  <div 
                    key={ses.id} 
                    className={`sidebar-item ${ses.id === sessionId ? "sidebar-item-active" : ""}`}
                    onClick={() => {
                      if (ses.id !== sessionId) {
                        localStorage.setItem(SESSION_ID_KEY, ses.id);
                        window.location.reload();
                      }
                    }}
                  >
                    <div className="sidebar-item-row">
                      <div className="sidebar-item-content">
                        {editingSessionId === ses.id ? (
                          <input
                            autoFocus
                            className="sidebar-rename-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => {
                              if (editName.trim() && editName !== ses.name) {
                                setSavedSessions(prev => {
                                  const next = { ...prev };
                                  next[ses.id] = { ...next[ses.id], name: editName.trim() };
                                  localStorage.setItem("freecode:sessions", JSON.stringify(next));
                                  return next;
                                });
                              }
                              setEditingSessionId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") setEditingSessionId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="sidebar-item-name">{ses.name || "Untitled session"}</div>
                        )}
                      </div>
                      {editingSessionId !== ses.id && (
                        <button
                          className="sidebar-item-action sidebar-item-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(ses.id);
                            setEditName(ses.name || "Untitled session");
                          }}
                        >
                          <EditIcon />
                        </button>
                      )}
                      <button
                        className="sidebar-item-action sidebar-item-del" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            title: "Delete Chat",
                            message: `Are you sure you want to delete "${ses.name || "this session"}"? This action cannot be undone.`,
                            onConfirm: () => {
                              setSavedSessions(prev => {
                                const next = { ...prev };
                                delete next[ses.id];
                                localStorage.setItem("freecode:sessions", JSON.stringify(next));
                                return next;
                              });
                              if (ses.id === sessionId) {
                                localStorage.removeItem(SESSION_ID_KEY);
                                window.location.reload();
                              }
                              setConfirmModal(null);
                            }
                          });
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="sidebar-item-time">{new Date(ses.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
              ))}
              {Object.keys(savedSessions).length === 0 && (
                <div className="sidebar-empty">No saved sessions</div>
              )}
            </div>
          </div>
        </div>

        <div className="chat-col" onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}>
          {/* Messages area */}
          <div className="messages-area" ref={messagesAreaRef}>
            <Welcome show={messages.length === 0} onRun={runCommand} />
            {messages.map(renderMessage)}
            {working && (
              <div className="msg msg-assistant">
                <WorkingIndicator />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Section */}
          <div className="input-outer">
            {connectionError && <div className="connection-error-banner">✗ {connectionError}</div>}
            {!connected ? (
              <div className="input-area input-area-offline">
                <span className="status-dot offline">●</span>
                <span className="input-offline-msg">
                  {typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ 
                    ? "Disconnected — Attempting to reconnect..." 
                    : "Disconnected — run <code>start.bat</code> to reconnect"}
                </span>
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
                        onClick={() => runCommand(cmd.name)}
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
                    onChange={e => {
                      setInput(e.target.value);
                      setPaletteIdx(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={messages.length === 0 ? "What's the plan?" : ""}
                    autoFocus
                    data-last-active-input=""
                  />
                  {working && <span className="input-hint">running ▂▄▆</span>}
                  {!working && input === "" && messages.length > 0 && <span className="input-hint ghost">/ for commands · esc to clear</span>}
                </div>
              </div>
            )}
          </div>

          {/* Removed standalone ctx-bar to prevent layout shift */}
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-left">
          <span className="status-val clickable sidetoggle" onClick={() => setSidebarOpen(s => !s)} title="Toggle sessions sidebar">
            ☰
          </span>
          <div className="status-item">
            <span className={`status-dot ${connected ? "online" : "offline"}`}>●</span>
            <span className="status-label">v2.0</span>
          </div>
          <span className="sep">·</span>
          <div className="status-item clickable" onClick={() => setModelPickerOpen(true)}>
             <span className="status-label">model</span>
             <span className="status-val">{model}</span>
          </div>
          <span className="sep">·</span>
          <div className="status-item clickable" title="Toggle auto-compact">
            <span className="status-label">ctx</span>
            <span className="status-val" style={{ color: (contextPct ?? 0) >= compactThreshold ? "var(--status-warning)" : "inherit" }}>
                {contextPct != null ? `${contextPct.toFixed(0)}%` : "0%"}
            </span>
            <div className="ctx-auto-group" 
                 onWheel={(e) => {
                   e.preventDefault();
                   const delta = e.deltaY < 0 ? 1 : -1;
                   const next = Math.max(10, Math.min(95, compactThreshold + delta));
                   setCompactThreshold(next);
                   localStorage.setItem(COMPACT_THRESHOLD_KEY, next.toString());
                 }}
            >
              <label className="ctx-toggle">
                <input type="checkbox" checked={autoCompact} onChange={e => {
                  setAutoCompact(e.target.checked);
                  localStorage.setItem(AUTO_COMPACT_KEY, e.target.checked.toString());
                }} />
                <span>{autoCompact ? "auto" : "manual"}</span>
              </label>
              
              {autoCompact && (isEditingThreshold ? (
                <input 
                  autoFocus
                  className="ctx-threshold-input"
                  type="number"
                  min="10"
                  max="95"
                  value={compactThreshold}
                  onChange={(e) => {
                    const n = parseInt(e.target.value);
                    if (!isNaN(n)) setCompactThreshold(n);
                  }}
                  onBlur={() => {
                    const n = Math.max(10, Math.min(95, compactThreshold));
                    setCompactThreshold(n);
                    localStorage.setItem(COMPACT_THRESHOLD_KEY, n.toString());
                    setIsEditingThreshold(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setIsEditingThreshold(false);
                  }}
                />
              ) : (
                <span className="ctx-threshold-val" onClick={() => setIsEditingThreshold(true)}>
                  ({compactThreshold}%)
                </span>
              ))}
            </div>
            {(contextPct ?? 0) >= compactThreshold && (
               <span style={{ fontSize: 9, cursor: "pointer", color: "var(--accent-blue)", marginLeft: 4 }} onClick={() => runCommand("/compact")}>[compact]</span>
            )}
          </div>
        </div>
        <div className="status-right">
          <div className="status-item clickable" onClick={() => runCommand("/effort")}>
            <span className="status-label">effort</span>
            <EffortIcon effort={effort} />
          </div>
          <span className="sep">·</span>
          <div className="status-item clickable" onClick={() => setShowSettings(true)} title="Open settings">
            <GearIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
