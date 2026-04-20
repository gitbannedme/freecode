import { Command } from "../lib/constants";

export type MsgKind =
  | { kind: "user"; text: string }
  | { kind: "thinking"; chunks: string[]; done: boolean }
  | { kind: "tool_call"; name: string; args: Record<string, unknown> }
  | { kind: "tool_result"; name: string; args: Record<string, unknown>; result: string; error?: boolean; content?: string }
  | { kind: "response"; chunks: string[] }
  | { kind: "system"; text: string }
  | { kind: "help"; commands: Command[] }
  | { kind: "error"; text: string };

export type SavedSession = {
  id: string;
  name: string;
  updatedAt: number;
  workingDir?: string;
};
