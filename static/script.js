// ---------------------------------------------------------------------------
// AI Medical Chatbot - frontend logic (vanilla JS, no frameworks)
// ---------------------------------------------------------------------------

const chatWindow = document.getElementById("chatWindow");
const sessionList = document.getElementById("sessionList");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const typingIndicator = document.getElementById("typingIndicator");
const chatTitle = document.getElementById("chatTitle");

let currentSessionId = null;

// ---------------------------------------------------------------------------
// Session list
// ---------------------------------------------------------------------------

async function loadSessions() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();

  sessionList.innerHTML = "";

  if (sessions.length === 0) {
    await createSession();
    return;
  }

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item" + (session.id === currentSessionId ? " active" : "");
    item.innerHTML = `
      <span class="session-title">${escapeHtml(session.title)}</span>
      <button class="delete-session-btn" title="Delete conversation">🗑</button>
    `;

    item.querySelector(".session-title").addEventListener("click", () => openSession(session.id, session.title));
    item.querySelector(".delete-session-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    sessionList.appendChild(item);
  });

  if (currentSessionId === null && sessions.length > 0) {
    openSession(sessions[0].id, sessions[0].title);
  }
}

async function createSession() {
  const res = await fetch("/api/sessions", { method: "POST" });
  const session = await res.json();
  currentSessionId = session.id;
  chatTitle.textContent = session.title;
  clearChatWindow(true);
  await loadSessions();
  messageInput.focus();
}

async function openSession(sessionId, title) {
  currentSessionId = sessionId;
  chatTitle.textContent = title || "Conversation";
  await loadSessions();
  await loadMessages(sessionId);
}

async function deleteSession(sessionId) {
  await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  if (sessionId === currentSessionId) {
    currentSessionId = null;
  }
  await loadSessions();
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

async function loadMessages(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/messages`);
  const messages = await res.json();

  clearChatWindow(messages.length === 0);
  messages.forEach((m) => appendMessage(m.role, m.message));
  scrollToBottom();
}

function clearChatWindow(showWelcome) {
  chatWindow.innerHTML = "";
  if (showWelcome) {
    chatWindow.innerHTML = `
      <div class="welcome-card">
        <div class="welcome-icon">🩺</div>
        <h2>Hi, I'm MediBuddy</h2>
        <p>
          I can help explain symptoms, healthy habits, first aid basics, and general
          wellness topics in simple terms. I'm not a doctor, so for diagnosis or
          treatment always check with a licensed healthcare professional.
        </p>
      </div>`;
  }
}

function appendMessage(role, text) {
  const welcome = chatWindow.querySelector(".welcome-card");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "🙂" : "⚕";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });

  bubble.appendChild(copyBtn);
  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentSessionId) return;

  appendMessage("user", text);
  messageInput.value = "";
  autoResize();
  scrollToBottom();
  setSending(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, message: text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Something went wrong.");
    }

    const data = await res.json();
    appendMessage("assistant", data.answer);
    loadSessions(); // refresh title if it was auto-generated
  } catch (err) {
    appendMessage("assistant", `⚠️ ${err.message}`);
  } finally {
    setSending(false);
    scrollToBottom();
  }
}

function setSending(isSending) {
  sendBtn.disabled = isSending;
  typingIndicator.classList.toggle("hidden", !isSending);
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + "px";
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

sendBtn.addEventListener("click", sendMessage);
newChatBtn.addEventListener("click", createSession);

messageInput.addEventListener("input", autoResize);

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadSessions();
