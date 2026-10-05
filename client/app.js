const API_URL = "https://cipherchat-x8nx.onrender.com";

let socket = null;
let userKeyPair = null;

// 1. Backend Health Check
fetch(API_URL)
  .then(res => res.text())
  .then(data => {
    document.getElementById("status").innerText = "Backend Status: " + data;
  })
  .catch(err => {
    document.getElementById("status").innerText = "Backend status check failed.";
  });

// 2. Client-Side E2EE Key Pair Generation (Web Crypto API)
async function generateE2EEKeys() {
  userKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  console.log("E2EE Key Pair generated successfully.");
}

// 3. Main App Logic
window.addEventListener("DOMContentLoaded", () => {
  // Initialize Socket.io connection
  try {
    if (typeof io !== "undefined") {
      socket = io(API_URL);

      socket.on("connect", () => {
        console.log("Connected to WebSocket server:", socket.id);
      });

      // Listen for incoming messages from other users
      socket.on("receive_message", (data) => {
        const box = document.getElementById("chat-box");
        box.innerHTML += `<p><strong>${data.sender || 'Peer'}:</strong> ${data.message}</p>`;
        box.scrollTop = box.scrollHeight;
      });
    }
  } catch (e) {
    console.error("Socket initialization error:", e);
  }

  // Handle Login & Key Generation
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const usernameInput = document.getElementById("username");
      const username = usernameInput ? usernameInput.value.trim() : "";

      if (!username) {
        alert("Please enter a username!");
        return;
      }

      document.getElementById("status").innerText = "Generating encryption keys...";
      await generateE2EEKeys();

      document.getElementById("status").innerText = "Connected as: " + username;
      document.getElementById("auth-section").classList.add("hidden");
      document.getElementById("chat-section").classList.remove("hidden");
    });
  }

  // Handle Sending Messages
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
          socket.emit("send_message", {
            sender: username,
            message: msg
          });
        }
        input.value = "";
      }
    });
  }
});
