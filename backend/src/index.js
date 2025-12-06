const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
// load .env as early as possible so downstream modules see process.env
dotenv.config();
const path = require("path");
const { connectDB } = require("./config/db");
const authRoutes = require("./routes/auth");
const communitiesRoutes = require("./routes/communities");
const postsRoutes = require("./routes/posts");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chat");
const http = require("http");
const { initSocket } = require("./socket");



const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());

// serve uploaded files
// app.use("/uploads", express.static(path.join(__dirname, "..", "..", "uploads")));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use("/api/auth", authRoutes);
app.use("/api/communities", communitiesRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);

// Database connection logic
const mongoUri = process.env.MONGO_URI;
// If we are not running directly (e.g. Vercel), we should ensure DB is connecting
if (require.main !== module) {
  connectDB(mongoUri).catch(console.error);
}

async function start() {
  try {
    await connectDB(mongoUri);
    const server = http.createServer(app);
    // initialize sockets
    initSocket(server);
    server.listen(PORT, () => console.log(`Server listening on ${PORT}`));

    return server;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
