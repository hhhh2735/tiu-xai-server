require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static("public"));

/* ===== SOCKET AUTH ===== */
const authSocket = require("./auth/auth.middleware");
io.use(authSocket);

/* ===== GAME SOCKET ===== */
require("./socket/game.socket")(io);

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
