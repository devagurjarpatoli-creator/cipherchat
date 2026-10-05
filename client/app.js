const API_URL = "https://cipherchat-x8nx.onrender.com";
let socket = null;
let currentUsername = "";
let rsaKeyPair = null;
const peerPublicKeys = {}; // Stores imported CryptoKey objects for peers: { username: key }

function logDebug(msg) {
  const logDiv = document.getElementById("debug-log");
  if (logDiv) {
    logDiv.innerHTML += `<div>> ${msg}</div>`;
  }
}

// Buffer & Base64 Converters
function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuffer(b64) {
  const binaryStr = atob(b64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// 1. Generate RSA Key Pair
async function generateRsaKeyPair() {
  logDebug("Generating RSA-OAEP 2048-bit key pair...");
  rsaKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  logDebug("RSA Key pair generated.");
}

// 2. Import Peer Public Key (JWK)
async function importPeerPublicKey(username, jwk) {
  try {
    const key = await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
    peerPublicKeys[username] = key;
    logDebug(`Imported public key for peer: ${username}`);
  } catch (err) {
    logDebug(`Failed to import key for ${username}: ` + err.message);
  }
}

// 3. Encrypt Message using Hybrid Encryption (AES-GCM + RSA-OAEP)
async function encryptMessage(plaintext) {
  // A. Generate dynamic AES-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // B. Encrypt message text with AES key
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    encodedText
  );

  // C. Export raw AES key
  const rawAesKeyBuf = await window.crypto.subtle.exportKey("raw", aesKey);

  // D. Encrypt the raw AES key using each peer's RSA public key
  const encryptedAesKeys = {};
  for (const [peer, publicKey] of Object.entries(peerPublicKeys)) {
    const encKeyBuf = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawAesKeyBuf
    );
    encryptedAesKeys[peer] = bufferToBase64(encKeyBuf);
  }

  return {
    ciphertext: bufferToBase64(ciphertextBuf),
    iv: bufferToBase64(iv),
    encryptedAesKeys: encryptedAesKeys,
  };
}

// 4. Decrypt Received Message
async function decryptMessage(data) {
  const myEncryptedAesKeyB64 = data.encryptedAesKeys[currentUsername];
  if (!myEncryptedAesKeyB64) {
    throw new Error("No payload key encrypted for this recipient.");
  }

  // A. Decrypt raw AES key using our RSA Private Key
  const rawAesKeyBuf = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaKeyPair.privateKey,
    base64ToBuffer(myEncryptedAesKeyB64)
  );

  // B. Import decrypted AES key
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    rawAesKeyBuf,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  // C. Decrypt ciphertext using AES key
  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(data.iv) },
    aesKey,
    base64ToBuffer(data.ciphertext)
  );

  return new TextDecoder().decode(decryptedBuf);
}

// Main Initialization
window.addEventListener("DOMContentLoaded", () => {
  if (typeof io !== "undefined") {
    socket = io(API_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => logDebug("Socket connected: " + socket.id));

    // Handle incoming existing keys
    socket.on("existing_keys", async (keysObj) => {
      for (const [user, jwk] of Object.entries(keysObj)) {
        if (user !== currentUsername) await importPeerPublicKey(user, jwk);
      }
    });

    // Handle new peer joining
    socket.on("user_joined", async ({ username, publicKeyJwk }) => {
      if (username !== currentUsername) {
        logDebug(`Peer joined: ${username}`);
        await importPeerPublicKey(username, publicKeyJwk);
      }
    });

    // Handle peer leaving
    socket.on("user_left", ({ username }) => {
      delete peerPublicKeys[username];
      logDebug(`Peer left: ${username}`);
    });

    // Handle incoming encrypted messages
    socket.on("receive_message", async (data) => {
      try {
        logDebug(`Received encrypted payload from ${data.sender}`);
        const plaintext = await decryptMessage(data);
        const box = document.getElementById("chat-box");
        box.innerHTML += `<p><strong>${data.sender}:</strong> ${plaintext}</p>`;
        box.scrollTop = box.scrollHeight;
      } catch (err) {
        logDebug("Decryption error: " + err.message);
      }
    });
  }

  // Login Handler
  document.getElementById("login-btn").addEventListener("click", async () => {
    const usernameInput = document.getElementById("username");
    currentUsername = usernameInput ? usernameInput.value.trim() : "";
    if (!currentUsername) return alert("Please enter a username!");

    document.getElementById("status").innerText = "Generating encryption keys...";
    await generateRsaKeyPair();

    // Export Public Key to JWK and register with server
    const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
    socket.emit("register_public_key", { username: currentUsername, publicKeyJwk });

    document.getElementById("status").innerText = "Connected as: " + currentUsername + " (E2EE Enabled)";
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
  });

  // Send Message Handler
  document.getElementById("send-btn").addEventListener("click", async () => {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();

    if (msg) {
      if (Object.keys(peerPublicKeys).length === 0) {
        logDebug("Warning: No active peers with keys online. Message sent locally only.");
      }

      const box = document.getElementById("chat-box");
      box.innerHTML += `<p><strong>You:</strong> ${msg}</p>`;
      box.scrollTop = box.scrollHeight;

      if (socket && socket.connected) {
        const encryptedData = await encryptMessage(msg);
        socket.emit("send_message", {
          sender: currentUsername,
          ...encryptedData
        });
        logDebug("Encrypted message transmitted.");
      }
      input.value = "";
    }
  });
});
