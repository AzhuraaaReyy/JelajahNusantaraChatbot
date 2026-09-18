const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const resetBtn = document.getElementById("chat-reset");

const INITIAL_GREETING =
  "Halo! Saya asisten perjalanan Anda. Ada rencana liburan ke mana minggu ini, atau butuh saran itinerary khusus?";

let conversation = [];
let busy = false;

const TIMEOUT_MS = 30000;

function getApiUrl() {
  const host = "localhost:3000";
  const sameOrigin =
    window.location.host === host || window.location.host === "127.0.0.1:3000";
  return sameOrigin ? "/api/chat" : `http://${host}/api/chat`;
}

const API_URL = getApiUrl();

if (!form || !input || !chatBox) {
  throw new Error("Chat elements missing from the page");
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (busy) return;

  const userMessage = input.value.trim();
  if (!userMessage) return;

  setBusy(true);
  appendMessage("user", userMessage);
  conversation.push({ role: "user", text: userMessage });
  input.value = "";

  const loadingMsg = appendMessage("bot", "Menyusun rekomendasi...");
  loadingMsg.classList.add("loading");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!text) throw new Error("Server tidak memberikan respons");

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Respons tidak valid dari server");
    }

    if (!response.ok) throw new Error(data.error || "Terjadi kesalahan");

    loadingMsg.textContent = data.result;
    loadingMsg.classList.remove("loading");
    conversation.push({ role: "model", text: data.result });
  } catch (err) {
    const message =
      err.name === "AbortError"
        ? "Permintaan melebihi batas waktu, coba lagi."
        : err.message || "Terjadi kesalahan";
    loadingMsg.textContent = "Error: " + message;
    loadingMsg.classList.remove("loading");
  } finally {
    clearTimeout(timer);
    setBusy(false);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

function appendMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

function setBusy(state) {
  busy = state;
  input.disabled = state;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = state;
  form.setAttribute("aria-busy", String(state));
}

function resetChat() {
  conversation = [];
  chatBox.innerHTML = "";
  const greeting = document.createElement("div");
  greeting.className = "message bot";
  greeting.textContent = INITIAL_GREETING;
  chatBox.appendChild(greeting);
}

if (resetBtn) resetBtn.addEventListener("click", resetChat);

const contactForm = document.getElementById("form-contact");

if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("name").value.trim() || "Tamu";
    contactForm.reset();
    alert(
      "Terima kasih, " + name + "! Tim kami akan menghubungi Anda secepatnya."
    );
  });
}