const API_URL = "https://cipherchat-x8nx.onrender.com";
let socket = null;

function logDebug(msg) {
  const logDiv = document.getElementById("debug-log");
  if (logDiv) {
    logDiv.innerHTML += `<div>> ${msg}</div>`;
  }
}

// 1. Backend Health Check
fetch(API_URL)
  .then(res => res.text())
  .then(data => {
    document.getElementById("status").innerText = "Backend Status: " + data;
    logDebug("HTTP fetch success.");
  })
  .catch(err => {
    document.getElementById("status").innerText = "Backend unreachable.";
    logDebug("HTTP fetch error: " + err.message);
  });

// 2. Main Logic
window.addEventListener("DOMContentLoaded", () => {
  if (typeof io !== "undefined") {
    try {
      socket = io(API_URL, {
        transports: ["websocket", "polling"]
      });

      socket.on("connect", () => {
        logDebug("Socket connected successfully! ID: " + socket.id);
      });

      socket.on("connect_error", (err) => {
        logDebug("Socket connection error: " + err.message);
      });

      socket.on("receive_message", (data) => {
        logDebug("Received message from " + data.sender);
        const box = document.getElementById("chat-box");
        box.innerHTML += `<p><strong>${data.sender}:</strong> ${data.message}</p>`;
        box.scrollTop = box.scrollHeight;
      });
    } catch (e) {
      logDebug("Socket init exception: " + e.message);
    }
  } else {
    logDebug("CRITICAL: Socket.io library failed to load.");
  }

  // Login Handler
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const usernameInput = document.getElementById("username");
      const username = usernameInput ? usernameInput.value.trim() : "";
      if (!username) return alert("Please enter a username!");

      document.getElementById("status").innerText = "Connected as: " + username;
      document.getElementById("auth-section").classList.add("hidden");
      document.getElementById("chat-section").classList.remove("hidden");
    });
  }

  // Send Message Handler
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const input = document.getElementById("message-input");
      const msg = input.value.trim();
      const username = document.getElementById("username").value.trim() || "Anonymous";

      if (msg) {
        const box = document.getElementById("chat-box");
        box.innerHTML += `<p><strong>You:</strong> ${msg}</p>`;
        box.scrollTop = box.scrollHeight;

        if (socket && socket.connected) {
          socket.emit("send_message", { sender: username, message: msg });
          logDebug("Message sent to server.");
        } else {
          logDebug("Cannot send: Socket disconnected.");
        }
        input.value = "";
      }
    });
  }
});