import React, { useState } from "react";
import { FolderIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon } from "./Icons";
import { SESSION_ID_KEY } from "../lib/constants";
import { useChatContext } from "../context/ChatContext";

export function Sidebar({ open }: { open: boolean }) {
  const {
    workingDir,
    savedSessions,
    setSavedSessions,
    working,
    sessionId,
    setDirPickerOpen,
    setConfirmModal
  } = useChatContext();

  const [sessionSearch, setSessionSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className={`sidebar-col ${open ? "" : "closed"}`}>
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
          {(() => {
            const filtered = Object.values(savedSessions)
              .filter(ses => workingDir !== null && ses.workingDir === workingDir && ses.name.toLowerCase().includes(sessionSearch.toLowerCase()))
              .sort((a, b) => b.updatedAt - a.updatedAt);
            if (!workingDir) return <div className="sidebar-empty">No project selected</div>;
            if (filtered.length === 0) return <div className="sidebar-empty">{sessionSearch ? "No matches" : "No saved sessions"}</div>;
            return filtered.map(ses => (
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
                            setSavedSessions((prev: any) => {
                              const next = { ...prev };
                              next[ses.id] = { ...next[ses.id], name: editName.trim() };
                              return next;
                            });
                          }
                          setEditingSessionId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as any).blur();
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
                          setSavedSessions((prev: any) => {
                            const next = { ...prev };
                            delete next[ses.id];
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
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
