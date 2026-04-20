"""Main Agent class with tool-calling loop."""

import json
import uuid
import os
import platform
import asyncio
from typing import AsyncGenerator
from google import genai
from google.genai import types

from .state import SessionState, Message
from .tools import ToolRegistry, FileSystemMCP, ShellMCP
from .tools.mcp_server import AddMcpServerTool
from .tools.mcp_remove_server import RemoveMcpServerTool
from .mcp_manager import McpManager
from .compaction import should_compact, compact_history

MAX_TOOL_ITERATIONS = 50


def _build_system_prompt(working_dir: str, model: str) -> str:
    cwd = os.path.abspath(working_dir)
    plat = platform.system()
    if plat.lower() == "windows":
        shell = os.environ.get("COMSPEC", "powershell.exe")
    else:
        shell = os.environ.get("SHELL", "bash")

    return f"""You are FreeCode, an advanced, interactive agentic coding assistant developed to help users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques or malicious use.
IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming.

# System & Identity
 - You are FreeCode. If the user asks for your name or identity, proudly state you are FreeCode v2.0.
 - You exist to analyze codebases, write code, run commands, and solve complex problems autonomously.
 - All text you output is displayed to the user. Use markdown for formatting.
 - The system will automatically compact prior messages as context approaches limits.

# Doing tasks
 - Read files before modifying them. Understand existing code before suggesting changes.
 - Do not create files unless absolutely necessary. Prefer editing existing files.
 - Do not add features, refactor, or make "improvements" beyond what was asked.
 - If an approach fails, diagnose why before switching tactics. Don't retry blindly.
 - If the user asks to /compact, summarize the conversation concisely and say "Context compacted."

# Executing actions with care
 - For destructive or hard-to-reverse operations (deleting files, overwriting data), confirm with the user first.
 - Carefully consider the reversibility and blast radius of actions.

# Using your tools
 - `filesystem` tool: use for all file operations (ls, read, write, edit, find, delete). Do NOT use shell for file operations.
 - `shell` tool: use for build commands, tests, git, package managers.
 - `add_mcp_server` tool: use when the user asks to add an MCP server (e.g. sqlite). It writes to the config and hot-reloads the connection immediately.
 - `remove_mcp_server` tool: use when the user asks to remove an MCP server.
 - IMPORTANT FOR SHELL: You are running on {plat}. If it is Windows, write valid Powershell or CMD commands (e.g. use `Remove-Item` instead of `rm`, `Get-ChildItem` instead of `ls` if needed, etc.).
 - Do NOT try to run `bash` commands like `rm -rf` on Windows unless running in WSL or Git Bash.

# Tone and style
 - Be concise and direct. Lead with the answer or action, not the reasoning.
 - No emojis unless the user explicitly asks.
 - Skip preamble and filler. Do not restate what the user said — just do it.
 - NEVER mention in your thinking what instructions you're supposed to follow. Keep internal reasoning private.

# Environment
 - Working directory: {cwd}
 - Platform: {plat}
 - Shell: {shell}
 - Model Capabilities: {model}
 - Today's date: {__import__('datetime').date.today()}"""


class Agent:
    """Agentic loop orchestrator."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemma-4-26b-a4b-it",
        working_dir: str = ".",
        enable_thinking: bool = True,
        token_limit: int = 100000,
    ):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.enable_thinking = enable_thinking
        self.state = SessionState(working_dir=working_dir, token_limit=token_limit)
        self.system_prompt = _build_system_prompt(working_dir, model)

        self.mcp_manager = McpManager(config_path=os.path.join(working_dir, ".freecode", "mcp_servers.json"))
        
        self.tools = ToolRegistry()
        self.tools.register(FileSystemMCP(working_dir=working_dir))
        self.tools.register(ShellMCP())
        self.tools.register(AddMcpServerTool(self.mcp_manager, self.tools))
        self.tools.register(RemoveMcpServerTool(self.mcp_manager, self.tools))
        
        asyncio.create_task(self.mcp_manager.connect_all(self.tools))

    def update_api_key(self, api_key: str):
        """Replace the SDK client with a fresh one using the new key."""
        self.client = genai.Client(api_key=api_key)

    async def process_input(
        self, user_message: str, effort: str = "MEDIUM", working_dir: str = ".", model: str = None, context_files: list[str] = None
    ) -> AsyncGenerator[dict, None]:
        """
        Main agentic loop.
        Yields: {"type": "thinking"|"tool_call"|"tool_result"|"response"|"done"|"error", ...}
        """
        if working_dir and str(self.state.working_dir) != str(os.path.abspath(working_dir)):
            self.state.working_dir = os.path.abspath(working_dir)
            self.system_prompt = _build_system_prompt(working_dir, self.model)
            self.tools.register(FileSystemMCP(working_dir=working_dir))

        if model and self.model != model:
            self.model = model
            self.system_prompt = _build_system_prompt(str(self.state.working_dir), model)

        if context_files:
            user_message = f"User is focusing on: {', '.join(context_files)}\n\n{user_message}"

        self.state.add_message("user", user_message)

        is_manual_compact = user_message.startswith("/compact")
        is_clear = user_message.startswith("/clear")

        if is_clear:
            self.state.messages = []
            self.state.token_count = 0
            yield {"type": "clear"}
            yield {"type": "system", "message": "Conversation history cleared."}
            yield {"type": "done", "tokens_used": 0, "token_limit": self.state.token_limit, "context_pct": 0.0}
            return

        has_history = len(self.state.messages) > 3

        if is_manual_compact:
            if not has_history:
                msg = "Nothing to compact yet. Start a conversation first!"
                if len(self.state.messages) > 1:
                    msg = "Conversation is too short to compact. Send a few more messages!"
                yield {"type": "system", "message": msg}
                _, limit = self.state.token_usage()
                tokens_used = self.state.token_count or self.state.token_usage()[0]
                context_pct = round(min(tokens_used / limit * 100, 100.0), 1) if limit else 0.0
                yield {"type": "done", "tokens_used": tokens_used, "token_limit": limit, "context_pct": context_pct}
                return

            async for event in self._compact():
                yield event
            api_tokens = self.state.token_count
            _, limit = self.state.token_usage()
            tokens_used = api_tokens if api_tokens else self.state.token_usage()[0]
            context_pct = round(min(tokens_used / limit * 100, 100.0), 1) if limit else 0.0
            yield {"type": "done", "tokens_used": tokens_used, "token_limit": limit, "context_pct": context_pct}
            return

        if should_compact(self.state) and has_history:
            async for event in self._compact():
                yield event

        task_id = str(uuid.uuid4())[:8]
        self.state.add_task(task_id, "tool_loop", {"messages_count": len(self.state.messages)})

        try:
            async for event in self._model_loop(effort=effort):
                yield event

            self.state.update_task_status(task_id, "completed")
            api_tokens = self.state.token_count
            _, limit = self.state.token_usage()
            tokens_used = api_tokens if api_tokens else self.state.token_usage()[0]
            context_pct = round(min(tokens_used / limit * 100, 100.0), 1) if limit else 0.0
            yield {"type": "done", "tokens_used": tokens_used, "token_limit": limit, "context_pct": context_pct}

        except Exception as e:
            self.state.update_task_status(task_id, "failed")
            yield {"type": "error", "error": str(e)}

    async def _model_loop(self, effort: str = "MEDIUM") -> AsyncGenerator[dict, None]:
        """
        Iterative tool-calling loop. Runs the model, executes any tool calls,
        feeds results back, and repeats until the model produces a final text
        response or the iteration cap is reached.
        """
        is_gemma = self.model.startswith("gemma")

        for iteration in range(MAX_TOOL_ITERATIONS):
            messages = [
                {"role": m.role, "content": m.content} for m in self.state.messages
            ]

            config = types.GenerateContentConfig(
                tools=[{"function_declarations": self.tools.get_definitions()}],
            )
            if self.enable_thinking and not is_gemma:
                config.thinking_config = types.ThinkingConfig(
                    thinking_level=types.ThinkingLevel[effort]
                )

            contents = [
                types.Content(role="user",  parts=[types.Part(text=self.system_prompt)]),
                types.Content(role="model", parts=[types.Part(text="Understood. I'm ready to assist.")]),
            ]
            is_first_response = len(messages) == 0
            for msg in self.state.messages:
                if msg.tool_call:
                    contents.append(
                        types.Content(
                            role="model",
                            parts=[types.Part(function_call=types.FunctionCall(
                                name=msg.tool_call["name"],
                                args=msg.tool_call["args"]
                            ))]
                        )
                    )
                elif msg.tool_result:
                    contents.append(
                        types.Content(
                            role="tool",
                            parts=[types.Part(function_response=types.FunctionResponse(
                                name=msg.tool_result["name"],
                                response={"result": msg.tool_result["result"]}
                            ))]
                        )
                    )
                else:
                    contents.append(
                        types.Content(
                            role=msg.role,
                            parts=[types.Part(text=msg.content)]
                        )
                    )

            full_text = ""
            tool_call_found = None
            skipped_system_ack = False

            async for chunk in self._stream_generate(contents, config):
                if isinstance(chunk, dict) and chunk.get("__usage__"):
                    self.state.token_count = chunk["total_tokens"]
                    continue

                if isinstance(chunk, dict) and chunk.get("type") == "error":
                    yield chunk
                    return

                if hasattr(chunk, "candidates") and chunk.candidates:
                    for part in chunk.candidates[0].content.parts:
                        if hasattr(part, "thought") and part.thought and getattr(part, "text", ""):
                            if part.text.strip():
                                yield {"type": "thinking", "chunk": part.text}

                if getattr(chunk, "text", None):
                    full_text += chunk.text
                    is_system_ack = (
                        is_first_response
                        and not skipped_system_ack
                        and full_text.strip() in [
                            "Understood. I'm ready to assist.",
                            "Understood. I'm ready to help.",
                        ]
                    )
                    if not is_system_ack:
                        yield {"type": "response", "chunk": chunk.text}
                    else:
                        skipped_system_ack = True

                if hasattr(chunk, "candidates") and chunk.candidates:
                    for part in chunk.candidates[0].content.parts:
                        if hasattr(part, "function_call") and part.function_call:
                            tool_call_found = part.function_call
                            break

            if tool_call_found:
                tool_name = tool_call_found.name
                tool_args = dict(tool_call_found.args) if tool_call_found.args else {}

                self.state.add_message(
                    "model",
                    f"[tool_call:{tool_name}]",
                    tool_call={"name": tool_name, "args": tool_args}
                )

                if full_text.strip():
                    yield {"type": "cancel_response"}

                yield {"type": "tool_call", "tool_name": tool_name, "tool_args": tool_args}

                tool = self.tools.get(tool_name)
                if not tool:
                    result = f"Error: Tool '{tool_name}' not found"
                else:
                    try:
                        result = await tool.execute(**tool_args)
                        if tool_name == "filesystem" and tool_args.get("operation") in ("write", "edit"):
                            self.state.track_file_modification(tool_args.get("path", ""))
                        elif tool_name == "add_mcp_server":
                            yield {"type": "config_changed", "message": "MCP Server configuration changed"}
                    except Exception as e:
                        result = f"Error: {e}"

                # Capture content for implicit artifacts
                tool_content = None
                if tool_name == "filesystem":
                    if tool_args.get("operation") == "write":
                        tool_content = tool_args.get("content")
                    elif tool_args.get("operation") == "edit":
                        # For edit, we might want to read the file after, 
                        # but for now we'll just pass the successful result.
                        pass

                yield {"type": "tool_result", "tool_name": tool_name, "result": result, "content": tool_content}
                self.state.add_message(
                    "tool", 
                    f"Tool Result ({tool_name}):\n{result}",
                    tool_result={"name": tool_name, "result": result}
                )
                # Continue the loop — model will see the tool result next iteration
                continue

            # No tool call — model produced a final response
            if full_text:
                self.state.add_message("model", full_text)
            return

        # Exceeded iteration cap
        yield {"type": "error", "error": f"Agent stopped after {MAX_TOOL_ITERATIONS} tool calls without a final response."}

    async def _compact(self) -> AsyncGenerator[dict, None]:
        yield {"type": "system", "message": "Compacting context... This may take a moment."}

        summary = await compact_history(
            self.client, self.model, self.state.messages
        )

        self.state.messages = [
            Message(
                role="model",
                content=f"Previous context summary:\n\n{summary}",
            )
        ]

        yield {"type": "clear"}
        yield {"type": "response", "chunk": f"Previous context summary:\n\n{summary}"}
        yield {"type": "system", "message": "Context successfully compacted."}

    async def _stream_generate(self, contents, config) -> AsyncGenerator[dict, None]:
        try:
            stream = await self.client.aio.models.generate_content_stream(
                model=self.model, contents=contents, config=config
            )
            last_usage = None
            async for chunk in stream:
                if getattr(chunk, "usage_metadata", None):
                    last_usage = chunk.usage_metadata
                yield chunk

            if last_usage:
                yield {
                    "__usage__": True,
                    "prompt_tokens": last_usage.prompt_token_count or 0,
                    "response_tokens": last_usage.candidates_token_count or 0,
                    "thoughts_tokens": last_usage.thoughts_token_count or 0,
                    "total_tokens": last_usage.total_token_count or 0,
                }
        except Exception as e:
            yield {"type": "error", "error": str(e)}
