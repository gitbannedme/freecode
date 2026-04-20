"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Welcome } from "./components/Welcome";
import { ProjectSelectScreen } from "./components/ProjectSelectScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { WorkingIndicator } from "./components/WorkingIndicator";
import { MessageRenderer } from "./components/MessageRenderer";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { ChatInput } from "./components/ChatInput";
import { OverlayManager } from "./components/OverlayManager";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { ChatProvider, useChatContext } from "./context/ChatContext";

function SelectionToolbar() {
  const { messages, selectedIndices, setSelectedIndices, setMessages, setSelectMode, setSavedSessions, sessionId, newChat } = useChatContext();
  const count = selectedIndices.size;

  const handleCopySelected = () => {
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    const text = sorted
      .map(i => messages[i])
      .filter(m => m.kind === "user" || m.kind === "response")
      .map(m => (m as any).text ?? (m as any).chunks?.join("") ?? "")
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setSelectMode(false);
    setSelectedIndices(new Set());
  };

  const handleDeleteSelected = () => {
    const remaining = messages.filter((_, i) => !selectedIndices.has(i));
    setMessages(remaining);
    const hasContent = remaining.some(m => m.kind === "user" || m.kind === "response");
    if (!hasContent) {
      setSavedSessions((prev: any) => { const next = { ...prev }; delete next[sessionId]; return next; });
      newChat();
    }
    setSelectMode(false);
    setSelectedIndices(new Set());
  };

  const handleCancel = () => {
    setSelectMode(false);
    setSelectedIndices(new Set());
  };

  return (
    <div className="selection-toolbar">
      <span className="selection-count">{count} selected</span>
      <div className="selection-actions">
        <button className="selection-btn" onClick={handleCopySelected} disabled={count === 0}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          Copy selected
        </button>
        <button className="selection-btn selection-btn-delete" onClick={handleDeleteSelected} disabled={count === 0}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
          Delete selected
        </button>
        <button className="selection-btn selection-btn-cancel" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
}

function HomeContent() {
  const {
    messages,
    working,
    workingDir,
    runCommand,
    handleDirSelect,
    handleBrowse,
    serverRecents,
    showReloadBanner,
    setShowReloadBanner,
    showOnboarding,
    activeArtifact,
    setActiveArtifact,
    showSettings,
    setShowSettings,
    isLoadingSession,
    selectMode,
  } = useChatContext();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (!messagesAreaRef.current) return;
    const el = messagesAreaRef.current;
    if (force || el.scrollHeight - el.scrollTop <= el.clientHeight + 100) { el.scrollTop = el.scrollHeight; }
  }, []);

  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContextMenu);
    return () => document.removeEventListener("contextmenu", preventContextMenu);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="app">
      <OverlayManager />

      <div className="main-row">
        <Sidebar open={sidebarOpen} />

        <div className="chat-col" onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}>
          {showSettings && (
            <SettingsScreen onClose={() => setShowSettings(false)} />
          )}

          {!showSettings && !workingDir && !showOnboarding && (
            <ProjectSelectScreen
              onSelect={handleDirSelect}
              onBrowse={handleBrowse}
              onSettings={() => setShowSettings(true)}
              recents={serverRecents}
            />
          )}

          {!showSettings && showReloadBanner && (
            <div className="reload-banner">
              <span>Configuration changed. A reload is required.</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => window.location.reload()}>Reload</button>
                <button onClick={() => setShowReloadBanner(false)}>Dismiss</button>
              </div>
            </div>
          )}

          {!showSettings && workingDir && selectMode && <SelectionToolbar />}

          {!showSettings && workingDir && <div className={`messages-area${selectMode ? " select-mode" : ""}`} ref={messagesAreaRef}>
            {isLoadingSession
              ? <div className="session-loading"><div className="session-loading-spinner" /></div>
              : <Welcome show={messages.length === 0} onRun={runCommand} />
            }
            {messages.map((msg, i) => <MessageRenderer key={i} msg={msg} i={i} runCommand={runCommand} />)}
            {working && <div className="msg msg-assistant"><WorkingIndicator /></div>}
          </div>}

          {!showSettings && workingDir && (
            <ChatInput
              inputRef={inputRef}
              scrollToBottom={scrollToBottom}
            />
          )}
        </div>

        {activeArtifact && (
          <ArtifactPanel
            title={activeArtifact.title}
            content={activeArtifact.content}
            language={activeArtifact.language}
            onClose={() => setActiveArtifact(null)}
          />
        )}
      </div>

      <StatusBar setSidebarOpen={setSidebarOpen} />
    </div>
  );
}

export default function Home() {
  return (
    <ChatProvider>
      <HomeContent />
    </ChatProvider>
  );
}
