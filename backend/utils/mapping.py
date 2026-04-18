from backend.message_types import MessageType, ServerMessage

def event_to_server_message(event: dict) -> ServerMessage:
    event_type = event.get("type")
    if event_type == "thinking":
        return ServerMessage(type=MessageType.THINKING, chunk=event.get("chunk"))
    elif event_type == "tool_call":
        return ServerMessage(type=MessageType.TOOL_CALL, tool_name=event.get("name"), tool_args=event.get("args"))
    elif event_type == "tool_result":
        return ServerMessage(type=MessageType.TOOL_RESULT, tool_name=event.get("name"), result=event.get("result"))
    elif event_type == "response":
        return ServerMessage(type=MessageType.RESPONSE, chunk=event.get("chunk"))
    elif event_type == "system":
        return ServerMessage(type=MessageType.SYSTEM, message=event.get("message"))
    elif event_type == "clear":
        return ServerMessage(type=MessageType.CLEAR)
    elif event_type == "config_changed":
        return ServerMessage(type=MessageType.CONFIG_CHANGED, message=event.get("message", "Configuration changed"))
    elif event_type == "done":
        return ServerMessage(
            type=MessageType.DONE,
            context_pct=event.get("context_pct"),
            tokens_used=event.get("tokens_used"),
            token_limit=event.get("token_limit"),
        )
    elif event_type == "error":
        return ServerMessage(type=MessageType.ERROR, error=event.get("error"))
    else:
        return ServerMessage(type=MessageType.ERROR, error=f"Unknown event type: {event_type}")
