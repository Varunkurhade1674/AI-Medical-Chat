"""
Conversation memory utilities built on LangChain's ConversationBufferMemory.

Because each FastAPI request is stateless, we rebuild a ConversationBufferMemory
from the messages already stored in SQLite, rather than keeping memory alive
in server RAM. This keeps LangChain's memory abstraction in the loop while
still giving us durable, reloadable chat history.
"""
from langchain.memory import ConversationBufferMemory


def build_memory_from_history(messages: list) -> ConversationBufferMemory:
    """
    Reconstruct a ConversationBufferMemory instance from stored DB messages.

    `messages` is expected to be a list of ORM Message objects (or anything
    with `.role` and `.message` attributes), ordered oldest to newest.
    """
    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=False,
        input_key="question",
    )

    for msg in messages:
        if msg.role == "user":
            memory.chat_memory.add_user_message(msg.message)
        else:
            memory.chat_memory.add_ai_message(msg.message)

    return memory


def format_history_as_text(memory: ConversationBufferMemory) -> str:
    """Return the buffered conversation as a single plain-text block."""
    variables = memory.load_memory_variables({})
    history = variables.get("chat_history", "")
    return history if history else "This is the beginning of the conversation."
