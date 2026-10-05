const API_URL = "https://cipherchat-x8nx.onrender.com";

let socket = null;

// 1. Check Backend Connection immediately
fetch(API_URL)
  .then(res => res.text())
  .then(data => {
    document.getElementById("status").innerText = "Backend Status: " + data;
  })
  .catch(err => {
    document.getElementById("status").innerText = "Backend status check failed.";
    console.error("Fetch error:", err);
  });

// 2. Initialize events after DOM is fully loaded
window.addEventListener("DOMContentLoaded", () => {
  // Safely initialize Socket.io
  try {
    if (typeof io !== "undefined") {
      socket = io(API_URL);
      socket.on("connect", () => {
        console.log("WebSocket connected successfully:", socket.id);
      });
    }
  } catch (e) {
    console.error("Socket initialization error:", e);
  }

  // Login Button Action
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const usernameInput = document.getElementById("username");
      const username = usernameInput ? usernameInput.value.trim() : "";

      if (!username) {
        alert("Please enter a username!");
        return;
      }

      document.getElementById("status").innerText = "Connected as: " + username;
      document.getElementById("auth-section").classList.add("hidden");
      document.getElementById("chat-section").classList.remove("hidden");
    });
  }

  // Send Message Action
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const input = document.getElementById("message-input");
      const msg = input.value.trim();
      if (msg) {
        const box = document.getElementById("chat-box");
        box.innerHTML += `<p><strong>You:</strong> ${msg}</p>`;
        box.scrollTop = box.scrollHeight;

        if (socket && socket.connected) {
          socket.emit("send_message", { message: msg });
        }
        input.value = "";
      }
    });
  }
});
