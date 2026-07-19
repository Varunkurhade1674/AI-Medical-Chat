"""
Conversation memory utilities.

Because each FastAPI request is stateless, we reconstruct the chat history
as a single plain-text block from the messages already stored in SQLite.
This provides the `{chat_history}` expected by our PromptTemplate.
"""

def build_memory_from_history(messages: list) -> list:
    """
    We no longer use LangChain's ConversationBufferMemory because it was moved/removed 
    in recent LangChain versions. Instead, we just pass the messages list directly.
    """
    return messages


def format_history_as_text(messages: list) -> str:
    """Return the buffered conversation as a single plain-text block."""
    if not messages:
        return "This is the beginning of the conversation."
        
    formatted = []
    for msg in messages:
        role = msg.get("role") if isinstance(msg, dict) else msg.role
        text = msg.get("message") if isinstance(msg, dict) else msg.message
        prefix = "Human: " if role == "user" else "AI: "
        formatted.append(f"{prefix}{text}")
        
    return "\n".join(formatted)
