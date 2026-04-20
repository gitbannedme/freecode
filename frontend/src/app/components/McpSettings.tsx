"use client";

import { useState, useEffect } from "react";
import styles from "./McpSettings.module.css";
import { PlusIcon, TrashIcon, XIcon, SaveIcon } from "./Icons";
import { getMcpServers, addMcpServer, removeMcpServer, McpServer } from "../lib/mcp";

export default function McpSettings() {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchServers = async () => {
    const data = await getMcpServers();
    setServers(data);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAdd = async () => {
    if (!newName || !newCommand) {
      setError(!newName ? "Name is required." : "Command is required.");
      return;
    }
    setError("");
    setLoading(true);
    const success = await addMcpServer(newName, {
      type: "stdio",
      command: newCommand,
      args: newArgs.split(",").map(a => a.trim()).filter(a => a)
    });
    if (success) {
      await fetchServers();
      setIsAdding(false);
      setNewName("");
      setNewCommand("");
      setNewArgs("");
    }
    setLoading(false);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to remove the '${name}' MCP server?`)) return;
    const success = await removeMcpServer(name);
    if (success) {
      await fetchServers();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>MCP SERVERS</span>
        <div style={{ display: "flex", gap: "4px" }}>
            {isAdding && (
                <button className={styles.iconBtn} onClick={handleAdd} title="Add Server" disabled={loading}>
                    <SaveIcon />
                </button>
            )}
            <button className={styles.iconBtn} onClick={() => setIsAdding(!isAdding)} title={isAdding ? "Cancel" : "Add MCP Server"}>
                {isAdding ? <XIcon /> : <PlusIcon />}
            </button>
        </div>
      </div>

      {isAdding && (
        <div className={styles.addForm}>
          <div className={styles.formGroup}>
            <label>Name</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.input} 
                placeholder="e.g. sqlite" 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Command</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.input} 
                placeholder="e.g. npx" 
                value={newCommand} 
                onChange={e => setNewCommand(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Arguments (comma separated)</label>
            <div className={styles.inputWrapper}>
              <input 
                className={styles.input} 
                placeholder="e.g. @modelcontextprotocol/server-sqlite, --db, dev.db" 
                value={newArgs} 
                onChange={e => setNewArgs(e.target.value)}
              />
            </div>
          </div>
        {error && <p className={styles.formError}>{error}</p>}
        </div>
      )}

      <div className={styles.serverList}>
        {Object.keys(servers).length === 0 ? (
          <div className={styles.emptyState}>
            No MCP servers configured.
          </div>
        ) : (
          Object.entries(servers).map(([name, server]) => (
            <div key={name} className={styles.serverItem}>
              <div className={styles.serverInfo}>
                <div className={styles.serverName}>{name}</div>
                <div className={styles.serverActions}>
                  <span className={styles.serverType}>{server.type}</span>
                  <button 
                    className={`${styles.iconBtn} ${styles.dangerBtn}`} 
                    onClick={() => handleDelete(name)}
                    title="Remove Server"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              <div className={styles.serverCommand}>
                {server.command} {server.args.join(" ")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
