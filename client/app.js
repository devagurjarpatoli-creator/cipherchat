const API_URL = "https://cipherchat-x8nx.onrender.com";
let socket = null;

function logDebug(msg) {
  const logDiv = document.getElementById("debug-log");
  if (logDiv) {
    logDiv.innerHTML += `<div>> ${msg}</div>`;
  }
}

// Backend Health Check
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

window.addEventListener("DOMContentLoaded", () => {
  // Initialize Socket.io with transport fallbacks
  try {
    socket = io(API_URL, {
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      logDebug("Socket connected! ID: " + socket.id);
    });

    socket.on("connect_error", (err) => {
      logDebug("Socket error: " + err.message);
    });

    socket.on("receive_message", (data) => {
      logDebug("Received message from " + data.sender);
      const box = document.getElementById("chat-box");
      box.innerHTML += `<p><strong>${data.sender}:</strong> ${data.message}</p>`;
      box.scrollTop = box.scrollHeight;
    });
  } catch (e) {
    logDebug("Socket init failed: " + e.message);
  }

  // Login Handler
  document.getElementById("login-btn").addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    if (!username) return alert("Enter a username!");

    document.getElementById("status").innerText = "Connected as: " + username;
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
  });

  // Send Message Handler
  document.getElementById("send-btn").addEventListener("click", () => {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    const username = document.getElementById("username").value.trim() || "Anonymous";

    if (msg) {
      const box = document.getElementById("chat-box");
      box.innerHTML += `<p><strong>You:</strong> ${msg}</p>`;
      box.scrollTop = box.scrollHeight;

      if (socket && socket.connected) {
        socket.emit("send_message", { sender: username, message: msg });
        logDebug("Emitted message to server.");
      } else {
        logDebug("Cannot send: Socket not connected.");
      }
      input.value = "";
    }
  });
});
