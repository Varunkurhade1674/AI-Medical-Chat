// ---------------------------------------------------------------------------
// AI Medical Chatbot - frontend logic (vanilla JS, no frameworks)
// ---------------------------------------------------------------------------

const chatWindow = document.getElementById("chatWindow");
const sessionList = document.getElementById("sessionList");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const newChatBtn = document.getElementById("newChatBtn");
const typingIndicator = document.getElementById("typingIndicator");
const chatTitle = document.getElementById("chatTitle");

const onboardingModal = document.getElementById("onboardingModal");
const apiKeyInput = document.getElementById("apiKeyInput");
const startChatBtn = document.getElementById("startChatBtn");
const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const keyHelpText = document.getElementById("keyHelpText");

let currentSessionId = null;
let savedProvider = localStorage.getItem("ai_provider") || "groq";
let savedApiKey = localStorage.getItem("api_key") || "";

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

  const textSpan = document.createElement("span");
  textSpan.className = "message-text";
  textSpan.textContent = text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(textSpan.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });

  bubble.appendChild(textSpan);
  
  let speakBtn = null;
  if (role === "assistant") {
    speakBtn = document.createElement("button");
    speakBtn.className = "speak-btn";
    speakBtn.textContent = "Speak";
    speakBtn.addEventListener("click", () => {
      // Toggle speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        speakBtn.textContent = "Speak";
      } else {
        const utterance = new SpeechSynthesisUtterance(textSpan.textContent);
        utterance.onend = () => (speakBtn.textContent = "Speak");
        window.speechSynthesis.speak(utterance);
        speakBtn.textContent = "Stop";
      }
    });
    bubble.appendChild(speakBtn);
  }
  
  bubble.appendChild(copyBtn);
  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  
  return { textSpan, copyBtn };
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
      body: JSON.stringify({ 
        session_id: currentSessionId, 
        message: text,
        provider: savedProvider,
        api_key: savedApiKey
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Something went wrong.");
    }

    // Hide the static "typing" indicator instantly since we're going to stream
    setSending(false);

    // Create an empty assistant bubble
    const { textSpan, copyBtn } = appendMessage("assistant", "");
    
    // Read the stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullAnswer += chunk;
      
      // Update the UI
      textSpan.textContent = fullAnswer;
      scrollToBottom();
    }
    
    // Update the copy button event listener to copy the newly completed text
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(fullAnswer);
    });

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
// Onboarding Logic
// ---------------------------------------------------------------------------

function updateHelpText() {
  const provider = document.querySelector('input[name="aiProvider"]:checked').value;
  if (provider === "groq") {
    keyHelpText.innerHTML = 'Get a free key from <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a>';
  } else if (provider === "openai") {
    keyHelpText.innerHTML = 'Get a key from <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com</a>';
  } else if (provider === "google") {
    keyHelpText.innerHTML = 'Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a>';
  } else if (provider === "openrouter") {
    keyHelpText.innerHTML = 'Get a key from <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a>';
  }
}

providerRadios.forEach(radio => {
  radio.addEventListener("change", updateHelpText);
});

startChatBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  const errorDiv = document.getElementById("verifyError");
  const btnText = startChatBtn.querySelector(".btn-text");
  const spinner = startChatBtn.querySelector(".btn-spinner");
  
  if (!key) {
    errorDiv.textContent = "Please enter an API key to continue.";
    errorDiv.classList.remove("hidden");
    return;
  }
  
  const provider = document.querySelector('input[name="aiProvider"]:checked').value;
  
  // UI Loading State
  errorDiv.classList.add("hidden");
  startChatBtn.disabled = true;
  btnText.textContent = "Verifying...";
  spinner.classList.remove("hidden");
  
  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider, api_key: key })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to verify API key. Please check it and try again.");
    }
    
    // Verification successful
    localStorage.setItem("api_key", key);
    localStorage.setItem("ai_provider", provider);
    
    savedApiKey = key;
    savedProvider = provider;
    
    onboardingModal.classList.add("hidden");
    loadSessions();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove("hidden");
  } finally {
    startChatBtn.disabled = false;
    btnText.textContent = "Start Chatting";
    spinner.classList.add("hidden");
  }
});

function initOnboarding() {
  if (!savedApiKey) {
    onboardingModal.classList.remove("hidden");
    
    // Set radio to saved provider if it exists
    const radio = document.querySelector(`input[name="aiProvider"][value="${savedProvider}"]`);
    if (radio) {
      radio.checked = true;
      updateHelpText();
    }
  } else {
    loadSessions();
  }
}

// ---------------------------------------------------------------------------
// Speech-to-Text Logic
// ---------------------------------------------------------------------------

let recognition = null;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  
  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    messageInput.placeholder = "Listening...";
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript) {
      const currentText = messageInput.value;
      messageInput.value = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
      autoResize();
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove("recording");
  messageInput.placeholder = "Type your health question here...";
  if (recognition) recognition.stop();
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      recognition.start();
    }
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

initOnboarding();
