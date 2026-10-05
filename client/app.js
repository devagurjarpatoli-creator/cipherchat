const API_URL = "https://cipherchat-x8nx.onrender.com";
let socket = null;
let currentUsername = "";
let rsaKeyPair = null;
const peerPublicKeys = {};

// Convert Buffer <-> Base64
function bufferToBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function base64ToBuffer(b64) {
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes.buffer;
}

// Helper to append chat bubble to DOM
function appendBubble(sender, text, isSelf = false) {
  const box = document.getElementById("chat-box");
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${isSelf ? "sent" : "received"}`;
  
  if (!isSelf) {
    const nameSpan = document.createElement("div");
    nameSpan.className = "sender-name";
    nameSpan.innerText = sender;
    msgDiv.appendChild(nameSpan);
  }

  const textSpan = document.createElement("span");
  textSpan.innerText = text;
  msgDiv.appendChild(textSpan);

  box.appendChild(msgDiv);
  box.scrollTop = box.scrollHeight;
}

// 1. Key Generation
async function generateRsaKeyPair() {
  rsaKeyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"]
  );
}

// 2. Import Public Key
async function importPeerPublicKey(username, jwk) {
  try {
    peerPublicKeys[username] = await window.crypto.subtle.importKey(
      "jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
    );
  } catch (err) {
    console.error("Key import failed for " + username, err);
  }
}

// 3. Encrypt Payload
async function encryptMessage(plaintext) {
  const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext));
  const rawAesKeyBuf = await window.crypto.subtle.exportKey("raw", aesKey);

  const encryptedAesKeys = {};
  for (const [peer, publicKey] of Object.entries(peerPublicKeys)) {
    const encKeyBuf = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKeyBuf);
    encryptedAesKeys[peer] = bufferToBase64(encKeyBuf);
  }

  return {
    ciphertext: bufferToBase64(ciphertextBuf),
    iv: bufferToBase64(iv),
    encryptedAesKeys
  };
}

// 4. Decrypt Payload
async function decryptMessage(data) {
  const myEncryptedAesKeyB64 = data.encryptedAesKeys[currentUsername];
  if (!myEncryptedAesKeyB64) throw new Error("No payload key for recipient.");

  const rawAesKeyBuf = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeyPair.privateKey, base64ToBuffer(myEncryptedAesKeyB64));
  const aesKey = await window.crypto.subtle.importKey("raw", rawAesKeyBuf, { name: "AES-GCM" }, true, ["decrypt"]);
  const decryptedBuf = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBuffer(data.iv) }, aesKey, base64ToBuffer(data.ciphertext));

  return new TextDecoder().decode(decryptedBuf);
}

// App Initialization
window.addEventListener("DOMContentLoaded", () => {
  // Backend status check
  fetch(API_URL)
    .then(res => res.text())
    .then(() => document.getElementById("status").innerText = "🔒 End-to-End Encrypted")
    .catch(() => document.getElementById("status").innerText = "Offline");

  if (typeof io !== "undefined") {
    socket = io(API_URL, { transports: ["websocket", "polling"] });

    socket.on("existing_keys", async (keysObj) => {
      for (const [user, jwk] of Object.entries(keysObj)) {
        if (user !== currentUsername) await importPeerPublicKey(user, jwk);
      }
    });

    socket.on("user_joined", async ({ username, publicKeyJwk }) => {
      if (username !== currentUsername) await importPeerPublicKey(username, publicKeyJwk);
    });

    socket.on("user_left", ({ username }) => {
      delete peerPublicKeys[username];
    });

    socket.on("receive_message", async (data) => {
      try {
        const plaintext = await decryptMessage(data);
        appendBubble(data.sender, plaintext, false);
      } catch (err) {
        console.error("Decryption error:", err);
      }
    });
  }

  // Login Click Handler
  document.getElementById("login-btn").addEventListener("click", async () => {
    const usernameInput = document.getElementById("username");
    currentUsername = usernameInput ? usernameInput.value.trim() : "";
    if (!currentUsername) return alert("Please enter a display name!");

    document.getElementById("status").innerText = "Generating security keys...";
    await generateRsaKeyPair();

    const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
    socket.emit("register_public_key", { username: currentUsername, publicKeyJwk });

    document.getElementById("status").innerText = `Logged in as: ${currentUsername}`;
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
  });

  // Send Message Click Handler
  document.getElementById("send-btn").addEventListener("click", async () => {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();

    if (msg) {
      appendBubble("You", msg, true);

      if (socket && socket.connected && Object.keys(peerPublicKeys).length > 0) {
        const encryptedData = await encryptMessage(msg);
        socket.emit("send_message", { sender: currentUsername, ...encryptedData });
      }
      input.value = "";
    }
  });

  // Press Enter to Send
  document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("send-btn").click();
  });
});
