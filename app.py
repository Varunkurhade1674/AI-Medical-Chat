"""
FastAPI application entrypoint for the AI Medical Chatbot.

Routes:
    GET  /                              -> renders the chat UI
    GET  /api/sessions                  -> list all chat sessions
    POST /api/sessions                  -> create a new chat session
    GET  /api/sessions/{id}/messages    -> get all messages for a session
    DELETE /api/sessions/{id}           -> delete a session and its messages
    POST /api/chat                      -> send a message, get an AI reply
"""
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import init_db, get_db
from database.models import ChatSession, Message
from chains.chat_chain import generate_response

load_dotenv()

app = FastAPI(title="AI Medical Chatbot", version="1.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


class ChatRequest(BaseModel):
    session_id: int
    message: str


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()
    return [
        {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()}
        for s in sessions
    ]


@app.post("/api/sessions")
def create_session(db: Session = Depends(get_db)):
    session = ChatSession(title="New Conversation")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
    }


@app.get("/api/sessions/{session_id}/messages")
def get_messages(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return [
        {"role": m.role, "message": m.message, "timestamp": m.timestamp.isoformat()}
        for m in session.messages
    ]


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"status": "deleted"}


@app.post("/api/chat")
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    previous_messages = list(session.messages)

    try:
        answer = generate_response(payload.message, previous_messages)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    db.add_all(
        [
            Message(session_id=session.id, role="user", message=payload.message),
            Message(session_id=session.id, role="assistant", message=answer),
        ]
    )

    if session.title == "New Conversation":
        session.title = payload.message[:50]

    db.commit()

    return {"answer": answer}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
