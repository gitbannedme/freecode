# Tool Refactor: Focused Single-Purpose Tools

**Date:** 2026-04-20

## Goal

Replace the monolithic `FileSystemMCP` and `ShellMCP` tools with focused, single-purpose tools organized in domain subfolders. Add missing `search/grep` and full `git/*` tools.

## File Structure

```
agent_core/tools/
├── base.py                  (unchanged)
├── __init__.py              (updated)
├── mcp_client.py            (unchanged)
├── mcp_server.py            (unchanged)
├── mcp_remove_server.py     (unchanged)
├── filesystem/
│   ├── __init__.py
│   ├── read.py
│   ├── write.py
│   ├── edit.py
│   ├── list.py
│   ├── find.py
│   └── delete.py
├── shell/
│   ├── __init__.py
│   └── run.py
├── search/
│   ├── __init__.py
│   └── grep.py
└── git/
    ├── __init__.py
    ├── status.py
    ├── diff.py
    ├── log.py
    ├── add.py
    ├── commit.py
    ├── push.py
    ├── pull.py
    ├── branch.py
    └── checkout.py
```

Old files `filesystem_mcp.py` and `shell_mcp.py` are deleted after migration.

## Tool Naming Convention

Tool names use forward-slash paths matching the folder structure:
- `filesystem/read`, `filesystem/write`, `filesystem/edit`, `filesystem/list`, `filesystem/find`, `filesystem/delete`
- `shell/run`
- `search/grep`
- `git/status`, `git/diff`, `git/log`, `git/add`, `git/commit`, `git/push`, `git/pull`, `git/branch`, `git/checkout`

## Tool Specifications

### filesystem/read
- **Input:** `path: str`
- **Output:** File contents with line numbers (`N | line`)
- **Errors:** file not found, not a file, binary file

### filesystem/write
- **Input:** `path: str`, `content: str`
- **Output:** Success message with char count
- **Behavior:** Creates parent directories; overwrites existing file

### filesystem/edit
- **Input:** `path: str`, `old_string: str`, `new_string: str`
- **Output:** Success message
- **Errors:** file not found, old_string not found, old_string not unique

### filesystem/list
- **Input:** `path: str`
- **Output:** Newline-separated directory entries
- **Errors:** path not found, not a directory

### filesystem/find
- **Input:** `path: str`, `pattern: str` (glob)
- **Output:** Newline-separated relative paths of matches

### filesystem/delete
- **Input:** `path: str`
- **Output:** Success message
- **Errors:** path not found; returns error for non-empty directories

### shell/run
- **Input:** `command: str`
- **Output:** stdout + stderr, labelled
- **Timeout:** 30 seconds
- **Behavior:** Runs in agent's working_dir

### search/grep
- **Input:** `pattern: str`, `path: str` (default `.`), `glob: str` (optional file filter, e.g. `*.py`)
- **Output:** Matches in `file:line: content` format
- **Behavior:** Recursive by default; uses Python `re` for pattern matching

### git/* tools
All git tools:
- Run in agent's `working_dir`
- Return raw git output (stdout + stderr)
- No timeout override (inherits shell default of 30s)

| Tool | Key inputs | Git command |
|------|-----------|-------------|
| `git/status` | — | `git status` |
| `git/diff` | `staged: bool`, `path: str` (optional) | `git diff [--staged] [path]` |
| `git/log` | `n: int` (default 10), `oneline: bool` (default true) | `git log` |
| `git/add` | `paths: list[str]` | `git add <paths>` |
| `git/commit` | `message: str` | `git commit -m` |
| `git/push` | `remote: str` (default `origin`), `branch: str` (optional) | `git push` |
| `git/pull` | `remote: str` (default `origin`), `branch: str` (optional) | `git pull` |
| `git/branch` | `name: str` (optional, creates if given), `delete: str` (optional) | `git branch` |
| `git/checkout` | `target: str`, `create: bool` (default false) | `git checkout [-b]` |

## Architecture

- `BaseTool` and `ToolRegistry` in `base.py` are unchanged.
- Each tool class is ~30-50 lines: one `definition` property, one `execute` method.
- `agent_core/tools/__init__.py` exports all tool classes and re-exports `BaseTool`, `ToolRegistry`.
- `agent.py` imports and registers all tools individually; `FileSystemMCP` and `ShellMCP` imports removed.
- System prompt tool guidance updated to list new tool names.
- Path safety (resolve relative to working_dir) is preserved in filesystem tools.

## Migration

1. Create subfolder `__init__.py` files
2. Implement each tool class
3. Update `tools/__init__.py`
4. Update `agent.py` registrations and system prompt
5. Delete `filesystem_mcp.py` and `shell_mcp.py`
