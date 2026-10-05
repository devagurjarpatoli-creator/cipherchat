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
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e7 // 50MB buffer limit
});

const activeUsers = {};

function broadcastUserList() {
  const userList = Object.values(activeUsers).map(u => ({
    username: u.username,
    publicKeyJwk: u.publicKeyJwk
  }));
  io.emit("user_list_update", userList);
}

io.on("connection", (socket) => {
  socket.on("register_public_key", ({ username, publicKeyJwk }) => {
    activeUsers[socket.id] = { username, publicKeyJwk };
    socket.username = username;
    broadcastUserList();
  });

  socket.on("send_message", (data) => {
    if (data.recipient && data.recipient !== "Global") {
      const targetEntry = Object.entries(activeUsers).find(([_, u]) => u.username === data.recipient);
      if (targetEntry) {
        const [targetSocketId] = targetEntry;
        io.to(targetSocketId).emit("receive_message", data);
      }
    } else {
      socket.broadcast.emit("receive_message", data);
    }
  });

  socket.on("disconnect", () => {
    if (activeUsers[socket.id]) {
      delete activeUsers[socket.id];
      broadcastUserList();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
