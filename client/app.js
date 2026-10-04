const API_URL = "https://cipherchat-x8nx.onrender.com";

// 1. Check HTTP backend connection
fetch(API_URL)
  .then(res => res.text())
  .then(data => {
    document.getElementById("status").innerText = "Backend Status: " + data;
  })
  .catch(err => {
    document.getElementById("status").innerText = "Error connecting to backend.";
    console.error("Connection error:", err);
  });

// 2. Initialize Socket.io connection
const socket = io(API_URL);

socket.on("connect", () => {
  console.log("Connected to WebSocket server:", socket.id);
});

// 3. UI interaction handlers
document.getElementById("login-btn")?.addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  if (username) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
  }
});

document.getElementById("send-btn")?.addEventListener("click", () => {
  const input = document.getElementById("message-input");
  const msg = input.value.trim();
  if (msg) {
    const box = document.getElementById("chat-box");
    box.innerHTML += `<p><strong>You:</strong> ${msg}</p>`;
    box.scrollTop = box.scrollHeight;
    
    // Broadcast via socket if event is configured on backend
    socket.emit("send_message", { message: msg });
    input.value = "";
  }
});
