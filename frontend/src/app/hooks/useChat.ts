import { useState, useEffect, useRef, useCallback } from "react";
import { MsgKind, SavedSession } from "../types/chat";
import { 
  BACKEND_URL, 
  DEFAULT_MODEL, 
  SESSION_ID_KEY, 
  DEFAULT_THRESHOLD, 
  COMPACT_THRESHOLD_KEY, 
  AUTO_COMPACT_KEY,
  AUTO_OPEN_PROJECT_KEY,
  COMMANDS,
  EFFORT_LEVELS
} from "../lib/constants";
import { generateSessionId, getOrCreateSessionId, saveRecentDir } from "../lib/utils";

export function useChat() {
  const [workingDir, setWorkingDir] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    
    // 1. Session override (if we picked a project in this tab)
    const sessionDir = sessionStorage.getItem("freecode:active_project");
    if (sessionDir) return sessionDir;

    // 2. Default startup behavior
    const shouldAutoOpen = localStorage.getItem(AUTO_OPEN_PROJECT_KEY) !== "false";
    if (!shouldAutoOpen) return null;
    return localStorage.getItem("freecode:working_dir") || null;
  });
  const [messages, setMessages] = useState<MsgKind[]>([]);
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
  const [serverRecents, setServerRecents] = useState<string[]>([]);
  const [contextPct, setContextPct] = useState<number | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});
  const [compactThreshold, setCompactThreshold] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THRESHOLD;
    return Number(localStorage.getItem(COMPACT_THRESHOLD_KEY) ?? DEFAULT_THRESHOLD);
  });
  const [autoCompact, setAutoCompact] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_COMPACT_KEY) !== "false";
  });
  const [autoOpenProject, setAutoOpenProject] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AUTO_OPEN_PROJECT_KEY) !== "false";
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showReloadBanner, setShowReloadBanner] = useState(false);

  // UI Overlays State
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Artifact & Branching State
  const [activeArtifact, setActiveArtifact] = useState<{ title: string; content: string; language: string } | null>(null);
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
  const [branchingIndex, setBranchingIndex] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const backendHasKey = useRef<boolean>(false);
  const autoCompactFiredAbove = useRef<boolean>(false);
  const pendingToolRef = useRef<Map<string, number>>(new Map());

  const handleServerMessage = useCallback((raw: string) => {
    const msg = JSON.parse(raw);

    if (msg.type === "hello") {
      if (msg.recent_dirs) setServerRecents(msg.recent_dirs);
      return;
    }

    if (msg.type === "session") {
      setMessages(prev => {
        const hasConversation = prev.some(m => m.kind === "user" || m.kind === "response");
        if (!hasConversation && msg.messages && msg.messages.length > 0) {
          return msg.messages.map((m: any) => {
            if (m.role === "user") return { kind: "user", text: m.content };
            if (m.role === "model") return { kind: "response", chunks: [m.content] };
            if (m.role === "tool") return { kind: "tool_result", name: "Result", args: {}, result: m.content };
            if (m.role === "system") return { kind: "system", text: m.content };
            return { kind: "system", text: m.content };
          });
        }
        return prev;
      });
      return;
    }

    if (msg.type === "sessions_list") {
      const backendSessions = (msg.sessions ?? []) as Array<{ id: string; name: string; updated_at: string; working_dir: string }>;
      const next: Record<string, SavedSession> = {};
      for (const s of backendSessions) {
        next[s.id] = {
          id: s.id,
          name: s.name,
          updatedAt: new Date(s.updated_at ?? 0).getTime(),
          workingDir: s.working_dir,
        };
      }
      setSavedSessions(next);
      return;
    }

    if (msg.type === "config_changed") {
      setShowReloadBanner(true);
      return;
    }

    setMessages(prev => {
      const next = [...prev];
      switch (msg.type) {
        case "clear":
          return [];
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
          let found = false;
          for (let i = next.length - 1; i >= 0; i--) {
            const block = next[i];
            if (block.kind === "tool_call" && block.name === msg.tool_name) {
              next[i] = {
                kind: "tool_result",
                name: block.name,
                args: block.args,
                result: msg.result ?? "",
                error: msg.error
              };
              found = true;
              break;
            }
          }
          if (!found) {
            next.push({ kind: "tool_result", name: msg.tool_name, args: {}, result: msg.result ?? "", error: msg.error });
          }
          break;
        }
        case "response": {
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
  }, []);

  useEffect(() => {
    localStorage.setItem(COMPACT_THRESHOLD_KEY, String(compactThreshold));
  }, [compactThreshold]);

  useEffect(() => {
    localStorage.setItem(AUTO_COMPACT_KEY, String(autoCompact));
  }, [autoCompact]);

  useEffect(() => {
    localStorage.setItem(AUTO_OPEN_PROJECT_KEY, String(autoOpenProject));
  }, [autoOpenProject]);

  useEffect(() => {
    localStorage.setItem("freecode:model", model);
  }, [model]);

  useEffect(() => {
    if (contextPct == null) return;
    if (contextPct < compactThreshold) {
      autoCompactFiredAbove.current = false;
      return;
    }
    if (autoCompact && !autoCompactFiredAbove.current && messages.length > 5 && wsRef.current?.readyState === WebSocket.OPEN) {
      autoCompactFiredAbove.current = true;
      wsRef.current.send(JSON.stringify({ type: "user_input", text: "Please summarize our conversation so far to compact the context.", effort, session_id: sessionId }));
    }
  }, [contextPct, autoCompact, compactThreshold, effort, sessionId, messages.length]);

  useEffect(() => {
    const BACKEND_HTTP = BACKEND_URL.replace(/^ws/, "http");
    let cancelled = false;
    async function tryFetch(attemptsLeft: number, delay: number) {
      if (cancelled) return;
      try {
        const r = await fetch(`${BACKEND_HTTP}/api/config`);
        if (!r.ok) throw new Error("not ok");
        const cfg: { api_key?: string } = await r.json();
        if (cancelled) return;
        if (cfg.api_key) {
          import("../lib/config").then(({ saveApiKey: saveKey }) => saveKey(cfg.api_key!));
          setShowOnboarding(false);
        }
      } catch {
        if (attemptsLeft > 0 && !cancelled) {
          setTimeout(() => tryFetch(attemptsLeft - 1, Math.min(delay * 1.5, 5000)), delay);
        }
      }
    }
    tryFetch(8, 600);
    return () => { cancelled = true; };
  }, []);

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
        const savedDir = localStorage.getItem("freecode:working_dir");
        const sesId = localStorage.getItem(SESSION_ID_KEY) || sessionId;
        const initMsg: Record<string, string> = {
          type: "user_input",
          text: "__init__",
          session_id: sesId,
          model: localStorage.getItem("freecode:model") || DEFAULT_MODEL
        };
        if (savedDir) initMsg.working_dir = savedDir;
        if (!backendHasKey.current) {
          const apiKey = localStorage.getItem("freecode:api_key");
          if (apiKey) initMsg.api_key = apiKey;
        }
        ws.send(JSON.stringify(initMsg));
        if (savedDir) {
          ws.send(JSON.stringify({ type: "list_sessions", working_dir: savedDir, session_id: sesId }));
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) {
          setConnected(false);
          setWorking(false);
          wsRef.current = null;
        }
        if (!dead) retryTimeout = setTimeout(connect, retryDelay = Math.min(retryDelay * 2, 10000));
      };
      ws.onerror = () => {};
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

  const runCommand = useCallback((rawInput: string) => {
    const name = rawInput.split(" ")[0];
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
        break;
      }
      case "/compact":
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type: "user_input", text: "/compact \u2014 please summarize our conversation so far", effort, session_id: sessionId }));
        break;
    }
  }, [effort, workingDir, sessionId, model]);

  const branch = useCallback((index: number) => {
    setMessages(prev => {
      const history = prev.slice(0, index + 1);
      const lastUserIdx = history.map(m => m.kind).lastIndexOf("user");
      if (lastUserIdx !== -1) {
        // We find the last user message in the truncated history
        // and prepare to re-send it or edit it.
        // For now, we just truncate and let the user re-type or we can auto-fill the input.
      }
      return history;
    });
  }, []);

  const addPin = useCallback((file: string) => {
    setPinnedFiles(prev => prev.includes(file) ? prev : [...prev, file]);
  }, []);

  const removePin = useCallback((file: string) => {
    setPinnedFiles(prev => prev.filter(f => f !== file));
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError("Connection lost. Reconnecting...");
      return;
    }
    setConnectionError(null);
    setWorking(true);
    setMessages(prev => [...prev, { kind: "user", text }]);
    
    // Include pins in the message if any
    const finalMsg: any = { type: "user_input", text, effort, working_dir: workingDir ?? ".", model, session_id: sessionId };
    if (pinnedFiles.length > 0) {
      finalMsg.context_files = pinnedFiles;
    }
    
    wsRef.current.send(JSON.stringify(finalMsg));
  }, [model, workingDir, effort, sessionId, pinnedFiles]);

  const handleDirSelect = (dir: string) => {
    if (dir === workingDir) return;
    const newSessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, newSessionId);
    localStorage.setItem("freecode:working_dir", dir);
    sessionStorage.setItem("freecode:active_project", dir);
    saveRecentDir(dir);
    window.location.reload();
  };

  const handleBrowse = async () => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({ directory: true, multiple: false });
        if (picked) handleDirSelect(picked as string);
        return;
      } catch (e) { console.error(e); }
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "pick_dir", session_id: sessionId }));
    }
  };

  return {
    messages, setMessages,
    connected,
    working, setWorking,
    sessionId,
    model, setModel,
    effort, setEffort,
    workingDir, setWorkingDir,
    serverRecents,
    contextPct, setContextPct,
    savedSessions, setSavedSessions,
    compactThreshold, setCompactThreshold,
    autoCompact, setAutoCompact,
    autoOpenProject, setAutoOpenProject,
    connectionError, setConnectionError,
    showReloadBanner, setShowReloadBanner,
    runCommand,
    sendMessage,
    handleDirSelect,
    handleBrowse,
    wsRef,
    backendHasKey,
    modelPickerOpen, setModelPickerOpen,
    dirPickerOpen, setDirPickerOpen,
    showSettings, setShowSettings,
    confirmModal, setConfirmModal,
    showOnboarding, setShowOnboarding,
    activeArtifact, setActiveArtifact,
    pinnedFiles, setPinnedFiles,
    addPin, removePin,
    branch
  };
}
