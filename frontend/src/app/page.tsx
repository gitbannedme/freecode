"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Welcome } from "./components/Welcome";
import { ProjectSelectScreen } from "./components/ProjectSelectScreen";
import { WorkingIndicator } from "./components/WorkingIndicator";
import { MessageRenderer } from "./components/MessageRenderer";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { ChatInput } from "./components/ChatInput";
import { OverlayManager } from "./components/OverlayManager";
import { ChatProvider, useChatContext } from "./context/ChatContext";

function HomeContent() {
  const {
    messages,
    connected,
    working,
    workingDir,
    runCommand,
    handleDirSelect,
    handleBrowse,
    serverRecents,
    showReloadBanner,
    setShowReloadBanner,
    showOnboarding
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
          {!workingDir && !showOnboarding && (
            <ProjectSelectScreen onSelect={handleDirSelect} onBrowse={handleBrowse} recents={serverRecents} />
          )}
          
          {showReloadBanner && (
            <div className="reload-banner">
              <span>Configuration changed. A reload is required.</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => window.location.reload()}>Reload</button>
                <button onClick={() => setShowReloadBanner(false)}>Dismiss</button>
              </div>
            </div>
          )}

          {workingDir && <div className="messages-area" ref={messagesAreaRef}>
            <Welcome show={messages.length === 0} onRun={runCommand} />
            {messages.map((msg, i) => <MessageRenderer key={i} msg={msg} i={i} runCommand={runCommand} />)}
            {working && <div className="msg msg-assistant"><WorkingIndicator /></div>}
          </div>}

          {workingDir && (
            <ChatInput 
              inputRef={inputRef}
              scrollToBottom={scrollToBottom}
            />
          )}
        </div>
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
