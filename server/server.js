const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("CipherChat Backend is Running!");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Store active public keys: { username: jwkPublicKey }
const publicKeys = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send existing public keys to newly connected client
  socket.emit("existing_keys", publicKeys);

  // Register user's public key
  socket.on("register_public_key", ({ username, publicKeyJwk }) => {
    socket.username = username;
    publicKeys[username] = publicKeyJwk;
    console.log(`Registered public key for ${username}`);

    // Broadcast new user's key to all other clients
    socket.broadcast.emit("user_joined", { username, publicKeyJwk });
  });

  // Relay encrypted messages
  socket.on("send_message", (data) => {
    socket.broadcast.emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete publicKeys[socket.username];
      io.emit("user_left", { username: socket.username });
      console.log(`User left: ${socket.username}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
