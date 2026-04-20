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
  EFFORT_LEVELS,
  MODEL_FILE_WHITELIST,
} from "../lib/constants";
import { generateSessionId, getOrCreateSessionId, saveRecentDir } from "../lib/utils";

export function useChat() {
  const [workingDir, setWorkingDir] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const sessionDir = sessionStorage.getItem("freecode:active_project");
    if (sessionDir) return sessionDir;
    const shouldAutoOpen = localStorage.getItem(AUTO_OPEN_PROJECT_KEY) !== "false";
    if (!shouldAutoOpen) return null;
    return localStorage.getItem("freecode:working_dir") || null;
  });
  const [messages, setMessages] = useState<MsgKind[]>([]);
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() =>
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
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // UI Overlays State
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
      setIsLoadingSession(false);
      setMessages(prev => {
        const hasConversation = prev.some(m => m.kind === "user" || m.kind === "response");
        if (!hasConversation && msg.messages && msg.messages.length > 0) {
          return msg.messages.flatMap((m: any) => {
            if (m.role === "user") return [{ kind: "user", text: m.content }];
            if (m.role === "model") {
              if (m.tool_call?.name) return [{ kind: "tool_call", name: m.tool_call.name, args: m.tool_call.args ?? {} }];
              if (m.content?.startsWith("[tool_call:")) return [];
              return [{ kind: "response", chunks: [m.content] }];
            }
            if (m.role === "tool") {
              if (m.tool_result?.name) return [{ kind: "tool_result", name: m.tool_result.name, args: {}, result: m.tool_result.result ?? "", error: false }];
              return [];
            }
            if (m.role === "system") return [{ kind: "system", text: m.content }];
            return [];
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
        case "cancel_response": {
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].kind === "response") { next.splice(i, 1); break; }
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
                error: msg.error,
                content: msg.content
              };
              found = true;
              break;
            }
          }
          if (!found) {
            next.push({ kind: "tool_result", name: msg.tool_name, args: {}, result: msg.result ?? "", error: msg.error, content: msg.content });
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
        case
