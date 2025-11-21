const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is not set. Copy .env.example to .env and set MONGO_URI.");
  }
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
}

module.exports = { connectDB };
