const API_URL = "https://cipherchat-x8nx.onrender.com";
let socket = null;
let currentUsername = "";
let currentChatTarget = "Global";
let rsaKeyPair = null;
const peerPublicKeys = {};

const chatHistory = { "Global": [] };

function bufferToBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function base64ToBuffer(b64) {
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes.buffer;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType, fileName) {
  const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf") || ext === "pdf") return "📕";
  if (mimeType.includes("word") || ext === "doc" || ext === "docx") return "📘";
  if (mimeType.includes("zip") || mimeType.includes("rar") || ext === "zip" || ext === "7z") return "📦";
  if (ext === "js" || ext === "py" || ext === "html" || ext === "css" || ext === "json") return "💻";
  return "📄";
}

function appendBubble(sender, contentObj, isSelf = false) {
  const box = document.getElementById("chat-box");
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${isSelf ? "sent" : "received"}`;
  
  if (!isSelf) {
    const nameSpan = document.createElement("div");
    nameSpan.className = "sender-name";
    nameSpan.innerText = sender;
    msgDiv.appendChild(nameSpan);
  }

  if (contentObj.type === "text") {
    const textSpan = document.createElement("span");
    textSpan.innerText = contentObj.text;
    msgDiv.appendChild(textSpan);
  } else if (contentObj.type === "file") {
    const mime = contentObj.fileType || "";

    if (mime.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = contentObj.dataUrl;
      msgDiv.appendChild(img);
    } else if (mime.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = contentObj.dataUrl;
      video.controls = true;
      msgDiv.appendChild(video);
    } else if (mime.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.src = contentObj.dataUrl;
      audio.controls = true;
      msgDiv.appendChild(audio);
    } else {
      // Document / PDF / Archive / Code Fallback Download Box
      const link = document.createElement("a");
      link.className = "doc-box";
      link.href = contentObj.dataUrl;
      link.download = contentObj.fileName || "downloaded_file";
      
      const iconSpan = document.createElement("span");
      iconSpan.className = "doc-icon";
      iconSpan.innerText = getFileIcon(mime, contentObj.fileName);

      const infoDiv = document.createElement("div");
      infoDiv.className = "doc-info";
      
      const nameDiv = document.createElement("span");
      nameDiv.className = "doc-name";
      nameDiv.innerText = contentObj.fileName || "File";

      const sizeDiv = document.createElement("span");
      sizeDiv.className = "doc-size";
      sizeDiv.innerText = contentObj.fileSize ? formatBytes(contentObj.fileSize) : "Click to download";

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(sizeDiv);
      link.appendChild(iconSpan);
      link.appendChild(infoDiv);

      msgDiv.appendChild(link);
    }
  }

  box.appendChild(msgDiv);
  box.scrollTop = box.scrollHeight;
}

function saveAndRenderMessage(roomOrUser, sender, contentObj, isSelf) {
  if (!chatHistory[roomOrUser]) chatHistory[roomOrUser] = [];
  chatHistory[roomOrUser].push({ sender, contentObj, isSelf });

  if (currentChatTarget === roomOrUser) {
    appendBubble(sender, contentObj, isSelf);
  }
}

function loadChatHistory(target) {
  const box = document.getElementById("chat-box");
  box.innerHTML = "";
  const history = chatHistory[target] || [];
  history.forEach(msg => appendBubble(msg.sender, msg.contentObj, msg.isSelf));
}

async function generateRsaKeyPair() {
  rsaKeyPair = await window.crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["encrypt", "decrypt"]
  );
}

async function importPeerPublicKey(username, jwk) {
  try {
    peerPublicKeys[username] = await window.crypto.subtle.importKey(
      "jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]
    );
  } catch (err) {
    console.error("Key import failed for " + username, err);
  }
}

async function encryptPayload(jsonPayload, recipient) {
  const aesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plaintextStr = JSON.stringify(jsonPayload);
  const ciphertextBuf = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintextStr));
  const rawAesKeyBuf = await window.crypto.subtle.exportKey("raw", aesKey);

  const encryptedAesKeys = {};
  if (recipient === "Global") {
    for (const [peer, publicKey] of Object.entries(peerPublicKeys)) {
      const encKeyBuf = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKeyBuf);
      encryptedAesKeys[peer] = bufferToBase64(encKeyBuf);
    }
  } else if (peerPublicKeys[recipient]) {
    const encKeyBuf = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, peerPublicKeys[recipient], rawAesKeyBuf);
    encryptedAesKeys[recipient] = bufferToBase64(encKeyBuf);
  }

  return {
    ciphertext: bufferToBase64(ciphertextBuf),
    iv: bufferToBase64(iv),
    encryptedAesKeys
  };
}

async function decryptPayload(data) {
  const myEncryptedAesKeyB64 = data.encryptedAesKeys[currentUsername];
  if (!myEncryptedAesKeyB64) throw new Error("No payload key for recipient.");

  const rawAesKeyBuf = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, rsaKeyPair.privateKey, base64ToBuffer(myEncryptedAesKeyB64));
  const aesKey = await window.crypto.subtle.importKey("raw", rawAesKeyBuf, { name: "AES-GCM" }, true, ["decrypt"]);
  const decryptedBuf = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBuffer(data.iv) }, aesKey, base64ToBuffer(data.ciphertext));

  const jsonStr = new TextDecoder().decode(decryptedBuf);
  return JSON.parse(jsonStr);
}

function updateSidebar(usersList) {
  const ul = document.getElementById("user-list");
  ul.innerHTML = `<li class="user-item ${currentChatTarget === 'Global' ? 'active' : ''}" data-user="Global">🌐 Global Room</li>`;

  usersList.forEach(u => {
    if (u.username !== currentUsername) {
      importPeerPublicKey(u.username, u.publicKeyJwk);
      const li = document.createElement("li");
      li.className = `user-item ${currentChatTarget === u.username ? 'active' : ''}`;
      li.dataset.user = u.username;
      li.innerText = `👤 ${u.username}`;
      ul.appendChild(li);
    }
  });

  document.querySelectorAll(".user-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".user-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      currentChatTarget = item.dataset.user;
      document.getElementById("current-chat-title").innerText = `Chatting in: ${currentChatTarget === 'Global' ? 'Global Room' : 'Direct Message with ' + currentChatTarget}`;
      loadChatHistory(currentChatTarget);
    });
  });
}

async function sendEncryptedMessage(contentObj) {
  saveAndRenderMessage(currentChatTarget, "You", contentObj, true);
  const encryptedData = await encryptPayload(contentObj, currentChatTarget);
  socket.emit("send_message", { sender: currentUsername, recipient: currentChatTarget, ...encryptedData });
}

// Process single file
function processFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 50 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds 50MB per-file memory limit.`);
      return reject("File too large");
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          resolve({
            type: "file",
            fileName: file.name,
            fileType: "image/jpeg",
            fileSize: file.size,
            dataUrl: canvas.toDataURL("image/jpeg", 0.85)
          });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          type: "file",
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          dataUrl: reader.result
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  fetch(API_URL)
    .then(() => document.getElementById("status").innerText = "🔒 E2EE Online")
    .catch(() => document.getElementById("status").innerText = "Offline");

  if (typeof io !== "undefined") {
    socket = io(API_URL, { transports: ["websocket", "polling"] });

    socket.on("user_list_update", (usersList) => updateSidebar(usersList));

    socket.on("receive_message", async (data) => {
      try {
        const decryptedContent = await decryptPayload(data);
        const chatRoom = data.recipient === "Global" ? "Global" : data.sender;
        saveAndRenderMessage(chatRoom, data.sender, decryptedContent, false);
      } catch (err) {
        console.error("Decryption failed:", err);
      }
    });
  }

  document.getElementById("login-btn").addEventListener("click", async () => {
    currentUsername = document.getElementById("username").value.trim();
    if (!currentUsername) return alert("Please enter a username!");

    document.getElementById("status").innerText = "Generating keys...";
    await generateRsaKeyPair();

    const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", rsaKeyPair.publicKey);
    socket.emit("register_public_key", { username: currentUsername, publicKeyJwk });

    document.getElementById("status").innerText = `Logged in as: ${currentUsername}`;
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
  });

  document.getElementById("send-btn").addEventListener("click", async () => {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (msg) {
      await sendEncryptedMessage({ type: "text", text: msg });
      input.value = "";
    }
  });

  document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("send-btn").click();
  });

  // Handle Multi-File Selection
  const fileInput = document.getElementById("file-input");
  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      try {
        document.getElementById("status").innerText = `Encrypting ${file.name}...`;
        const filePayload = await processFile(file);
        await sendEncryptedMessage(filePayload);
      } catch (err) {
        console.error("File processing error:", err);
      }
    }

    document.getElementById("status").innerText = `Logged in as: ${currentUsername}`;
    fileInput.value = "";
  });
});
