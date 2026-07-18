"""
LangChain LCEL Runnable chain for the medical chatbot.

This module wires together the three core LangChain pieces used in this
project:

    PromptTemplate  |  ChatGroq  |  StrOutputParser

which LangChain composes into a single RunnableSequence via the `|` operator
(LCEL - LangChain Expression Language).
"""
import os

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser

from chains.prompt import medical_prompt
from chains.memory import build_memory_from_history, format_history_as_text


def get_llm() -> ChatGroq:
    """Build a configured ChatGroq client using Llama 3.3."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to your .env file (see .env.example)."
        )

    return ChatGroq(
        api_key=api_key,
        model="llama-3.3-70b-versatile",
        temperature=0.4,
        max_tokens=800,
    )


def build_chain():
    """Compose the RunnableSequence: PromptTemplate | ChatGroq | StrOutputParser."""
    llm = get_llm()
    parser = StrOutputParser()
    return medical_prompt | llm | parser


def generate_response(question: str, previous_messages: list) -> str:
    """
    Run the chain for a single user question, given the prior messages for
    this session pulled from the database.
    """
    memory = build_memory_from_history(previous_messages)
    chat_history_text = format_history_as_text(memory)

    chain = build_chain()

    try:
        answer = chain.invoke({"chat_history": chat_history_text, "question": question})
    except Exception as exc:  # surface a clean, friendly error to the API layer
        raise RuntimeError(f"The AI service failed to respond: {exc}") from exc

    return answer.strip()
