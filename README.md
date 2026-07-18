# MediBuddy — AI Medical Chatbot (LangChain Fundamentals)

A compact, production-shaped chatbot that answers general health questions using
**Groq's Llama 3.3** through **LangChain**. Built as a hands-on tour of core LangChain
concepts: `PromptTemplate`, `ConversationBufferMemory`, and LCEL `RunnableSequence` chains.

> ⚠️ **Educational project only.** MediBuddy is not a medical device and does not
> replace professional medical advice, diagnosis, or treatment.

---

## Overview

MediBuddy is a full-stack chatbot with:

- A **FastAPI** backend exposing a small REST API
- A **LangChain** chain (`PromptTemplate | ChatGroq | StrOutputParser`) that generates answers
- **ConversationBufferMemory** rebuilt per-request from chat history stored in **SQLite**
- A framework-free **HTML/CSS/JS** frontend with a sidebar of past conversations

## Features

- Ask unlimited general health questions (symptoms, nutrition, fitness, mental health,
  general diseases, first aid, healthy lifestyle)
- Multi-turn conversation with memory of earlier messages in the same session
- Create, switch between, and delete conversations
- Every AI response ends with a medical disclaimer
- Responsive UI with typing indicator, auto-scroll, Enter-to-send, and copy-to-clipboard

## Folder Structure

```
AI-Medical-Chatbot/
├── database/
│   ├── database.py       # SQLAlchemy engine, session, Base, init_db()
│   └── models.py         # ChatSession and Message ORM models
├── chains/                # LangChain building blocks
│   ├── prompt.py         # PromptTemplate used by the assistant
│   ├── memory.py         # ConversationBufferMemory helpers
│   └── chat_chain.py     # LCEL RunnableSequence: prompt | ChatGroq | parser
├── templates/
│   └── index.html        # Jinja2 chat UI
├── static/
│   ├── style.css         # Blue / white / light-gray medical theme
│   └── script.js         # Sidebar, chat, typing indicator, copy button
├── app.py                # FastAPI app and routes
├── requirements.txt
├── .env.example
└── README.md
```

**Note on naming:** the spec called for a folder named `langchain/`, but that would shadow
the real `langchain` package on Python's import path and break every `from langchain... import`
statement in the project. It's named `chains/` instead so the app actually runs.

## LangChain Components Used

| Component | Where | Purpose |
|---|---|---|
| `PromptTemplate` | `chains/prompt.py` | Defines MediBuddy's persona, safety rules, and the disclaimer, with `{chat_history}` and `{question}` placeholders |
| `ChatGroq` | `chains/chat_chain.py` | Connects to Groq's hosted `llama-3.3-70b-versatile` model |
| `ConversationBufferMemory` | `chains/memory.py` | Rebuilt per request from SQLite rows so history survives across server restarts |
| `StrOutputParser` | `chains/chat_chain.py` | Extracts a plain string from the model's response |
| LCEL `RunnableSequence` (`|`) | `chains/chat_chain.py` | Composes `medical_prompt \| llm \| parser` into one runnable chain |

## Installation

1. **Clone / unzip the project**, then move into it:
   ```bash
   cd AI-Medical-Chatbot
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate      # Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in a free API key from
   [console.groq.com/keys](https://console.groq.com/keys).

## Database Setup

No manual setup needed. On first run, `init_db()` (in `database/database.py`) creates
`medical_chatbot.db` and the `chat_sessions` / `messages` tables automatically via
SQLAlchemy's `Base.metadata.create_all()`.

**Schema:**

- `chat_sessions`: `id`, `title`, `created_at`
- `messages`: `id`, `session_id` (FK), `role` (`"user"` / `"assistant"`), `message`, `timestamp`

## Running the Project

```bash
uvicorn app:app --reload
```

Then open **http://127.0.0.1:8000** in your browser. The first message you send
automatically creates a chat session; previous sessions appear in the left sidebar
and reload their full history when clicked.

## Screenshots

_Add screenshots of the chat UI here once you've run the project locally, e.g._

```
docs/screenshot-chat.png
docs/screenshot-sidebar.png
```

## Future Improvements

- Streaming token-by-token responses instead of waiting for the full reply
- Optional RAG layer over trusted medical sources for grounded answers
- User authentication so sessions are private per account
- Markdown rendering for AI responses (lists, bold text, etc.)
- Rate limiting and abuse protection on the `/api/chat` endpoint
- Automated tests for the chain and database layers

---

Built as a learning project for LangChain fundamentals — not for real medical use.
