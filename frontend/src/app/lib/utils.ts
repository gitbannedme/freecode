import { RECENT_DIRS_KEY, SESSION_ID_KEY } from "./constants";

export function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function getOrCreateSessionId(): string {
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

export function loadRecentDirs(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_DIRS_KEY) || "[]"); } catch { return []; }
}

export function saveRecentDir(dir: string) {
  const dirs = [dir, ...loadRecentDirs().filter(d => d !== dir)].slice(0, 8);
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs));
}

export function shortenPath(path: string | null): string {
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
