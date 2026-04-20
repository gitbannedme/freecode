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
      return <UserMsg key={i} index={i} text={msg.text} />;

    case "thinking":
      return (
        <div key={i} className="msg msg-assistant">
          <div className="thread-dot thinking" />
          <div className="msg-body">
            <ThinkingBlock index={i} chunks={msg.chunks} done={msg.done} />
          </div>
        </div>
      );

    case "tool_call":
      return (
        <div key={i} className="msg msg-assistant">
          <div className="thread-dot thinking" />
          <div className="msg-body">
            <ToolBlock index={i} name={msg.name} args={msg.args} />
          </div>
        </div>
      );

    case "tool_result":
      return (
        <div key={i} className="msg msg-assistant">
          <div className={`thread-dot ${msg.error ? 'error' : 'success'}`} />
          <div className="msg-body">
            <ToolBlock
              index={i}
              name={msg.name}
              args={msg.args}
              result={msg.result}
              resultError={msg.error}
              content={msg.content}
            />
          </div>
        </div>
      );

    case "response":
      return (
        <div key={i} className="msg msg-assistant">
          <div className="thread-dot success" />
          <div className="msg-body">
            <ResponseBlock index={i} chunks={msg.chunks} />
          </div>
        </div>
      );

    case "system":
      return <div key={i} className="msg-system"><span className="msg-system-text">{msg.text}</span></div>;

    case "help":
      return (
        <div key={i} className="msg msg-assistant">
          <div className="thread-dot" style={{ visibility: "hidden" }} />
          <div className="msg-body">
            <div className="help-block">
              <div className="help-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span>Available Commands</span>
              </div>
              {msg.commands.map(c => (
                <div key={c.name} className="help-row" onClick={() => runCommand(c.name)}>
                  <span className="help-name">{c.name}</span>
                  <span className="help-desc">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "error":
      return (
        <div key={i} className="msg-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          <span>{msg.text}</span>
        </div>
      );

    default:
      return null;
  }
}
