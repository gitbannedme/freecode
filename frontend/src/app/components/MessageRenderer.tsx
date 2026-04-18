import React from "react";
import { MsgKind } from "../types/chat";
import { UserMsg, ThinkingBlock, ToolBlock, ResponseBlock } from "./ChatBlocks";

interface MessageRendererProps {
  msg: MsgKind;
  i: number;
  runCommand: (cmd: string) => void;
}

export function MessageRenderer({ msg, i, runCommand }: MessageRendererProps) {
  switch (msg.kind) {
    case "user":
      return <UserMsg key={i} text={msg.text} />;

    case "thinking":
      return (
        <div key={i} className={`msg msg-assistant${msg.done ? " done" : ""}`}>
          <ThinkingBlock chunks={msg.chunks} done={msg.done} />
        </div>
      );

    case "tool_call":
      return (
        <div key={i} className="msg msg-assistant">
          <ToolBlock name={msg.name} args={msg.args} />
        </div>
      );

    case "tool_result":
      return (
        <div key={i} className="msg msg-assistant">
          <ToolBlock
            name={msg.name}
            args={msg.args}
            result={msg.result}
            resultError={msg.error}
          />
        </div>
      );

    case "response":
      return (
        <div key={i} className="msg msg-assistant">
          <ResponseBlock chunks={msg.chunks} />
        </div>
      );

    case "system":
      return <div key={i} className="msg-system">{msg.text}</div>;

    case "help":
      return (
        <div key={i} className="msg msg-system-ui">
          <div className="help-block">
            <div className="help-header">AVAILABLE COMMANDS</div>
            {msg.commands.map(c => (
              <div key={c.name} className="help-row">
                <span className="help-name" onClick={() => runCommand(c.name)}>{c.name}</span>
                <span className="help-desc">{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "error":
      return <div key={i} className="msg-error">✗ {msg.text}</div>;
    
    default:
      return null;
  }
}
