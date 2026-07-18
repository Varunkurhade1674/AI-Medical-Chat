"""
LangChain LCEL Runnable chain for the medical chatbot.

This module wires together the three core LangChain pieces used in this
project:

    PromptTemplate  |  LLM  |  StrOutputParser

which LangChain composes into a single RunnableSequence via the `|` operator
(LCEL - LangChain Expression Language).
"""
import os

from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser

from chains.prompt import medical_prompt
from chains.memory import build_memory_from_history, format_history_as_text


def get_llm(api_key: str | None = None, provider: str = "groq"):
    """Build a configured LLM client based on the selected provider."""
    if not api_key:
        raise RuntimeError(
            "API key is not set. Please provide it in the UI."
        )

    if provider == "openai":
        return ChatOpenAI(
            api_key=api_key,
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=800,
        )
    elif provider == "google":
        return ChatGoogleGenerativeAI(
            api_key=api_key,
            model="gemini-1.5-flash",
            temperature=0.4,
            max_tokens=800,
        )
    elif provider == "openrouter":
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            model="meta-llama/llama-3.1-8b-instruct",
            temperature=0.4,
            max_tokens=800,
        )
    else:
        return ChatGroq(
            api_key=api_key,
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=800,
        )


def build_chain(api_key: str | None = None, provider: str = "groq"):
    """Compose the RunnableSequence: PromptTemplate | LLM | StrOutputParser."""
    llm = get_llm(api_key, provider)
    parser = StrOutputParser()
    return medical_prompt | llm | parser


def generate_response(question: str, previous_messages: list, api_key: str | None = None, provider: str = "groq") -> str:
    """
    Run the chain for a single user question, given the prior messages for
    this session pulled from the database.
    """
    memory = build_memory_from_history(previous_messages)
    chat_history_text = format_history_as_text(memory)

    chain = build_chain(api_key, provider)

    try:
        answer = chain.invoke({"chat_history": chat_history_text, "question": question})
    except Exception as exc:  # surface a clean, friendly error to the API layer
        raise RuntimeError(f"The AI service failed to respond: {exc}") from exc

    return answer.strip()
