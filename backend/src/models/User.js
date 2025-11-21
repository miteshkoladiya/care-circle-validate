const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["Patient", "Doctor", "Admin", "SuperAdmin"], default: "Patient" },
    avatar: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
  doctorDocument: { type: String, default: "" },
  registrationNumber: { type: String, default: "" },
  age: { type: Number },
  contactNumber: { type: String, default: "" },
  communities: [{ type: require('mongoose').Schema.Types.ObjectId, ref: 'Community' }],
  },
  { timestamps: true }
);

const User = model("User", UserSchema);
module.exports = { User };
