const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function initSocket(server) {
  io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || true } });

  io.on("connection", (socket) => {
    try {
      // try token from auth handshake (client should send { auth: { token } })
      const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload && payload.id) {
          const room = `user:${payload.id}`;
          socket.join(room);
          console.log("[socket] joined room", room);
        }
      }
    } catch (err) {
      console.warn("[socket] auth failed for socket", err && err.message);
    }

    socket.on("disconnect", () => {
      // optional cleanup
    });
  });

  return io;
}

function getIo() { return io; }

module.exports = { initSocket, getIo };
