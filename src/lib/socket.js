import { io } from "socket.io-client";

let socket = null;

export function initSocketClient(baseUrl) {
  if (socket) return socket;
  socket = io(baseUrl, { autoConnect: true });
  socket.on("connect", () => console.log("socket connected", socket?.id));
  socket.on("disconnect", () => console.log("socket disconnected"));
  return socket;
}

export function getSocket() {
  if (!socket) throw new Error("Socket not initialized");
  return socket;
}

export function closeSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export default {};
