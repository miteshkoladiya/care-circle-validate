const { Router } = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User } = require("../models/User");
const { authMiddleware } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// read and trim Cloudinary env variables (may have trailing spaces)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME && String(process.env.CLOUDINARY_CLOUD_NAME).trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY && String(process.env.CLOUDINARY_API_KEY).trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET && String(process.env.CLOUDINARY_API_SECRET).trim();

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
  console.log('[auth] Cloudinary configured, cloud:', CLOUDINARY_CLOUD_NAME);
} else {
  console.log('[auth] Cloudinary not configured; presence:', {
    CLOUDINARY_CLOUD_NAME: !!CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: !!CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: !!CLOUDINARY_API_SECRET,
  });
}

const router = Router();

// Keep local uploads dir for backward compatibility, but switch multer to memory storage for Cloudinary upload
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const allowed = ["application/pdf", "image/jpeg", "image/png"];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/register", upload.single("doctorDocument"), async (req, res) => {
  try {
    const { name, email, password, role, registrationNumber, age, contactNumber } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: "Missing fields" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const hashed = await bcrypt.hash(password, 10);
    // validate age if provided
    let parsedAge = undefined;
    if (age !== undefined && age !== null && String(age).trim() !== "") {
      parsedAge = Number(age);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 150) return res.status(400).json({ message: "Age must be a number between 1 and 150" });
    }
    // validate contactNumber (digits only, 10 digits)
    if (contactNumber && String(contactNumber).replace(/\D/g, '').length !== 10) return res.status(400).json({ message: "Contact number must be 10 digits" });

    const userData = { name, email, password: hashed, role: role || "Patient", registrationNumber: registrationNumber || '', age: parsedAge, contactNumber: contactNumber || '' };
    if (req.file && userData.role === "Doctor") {
  console.log('Register: received file', { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size });
      // upload buffer to Cloudinary if configured, otherwise fall back to saving locally
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        try {
          const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder: 'carecircle/documents', resource_type: 'auto' }, (error, result) => {
              if (error) return reject(error);
              resolve(result);
            });
            stream.end(req.file.buffer);
          });
          console.log('Cloudinary upload success', uploadResult && uploadResult.secure_url);
          userData.doctorDocument = uploadResult.secure_url;
        } catch (err) {
          console.error('Cloudinary upload failed', err);
          // fallback: write file locally and store local path
          const localName = `${Date.now()}-${req.file.originalname}`;
          const localPath = path.join(UPLOAD_DIR, localName);
          fs.writeFileSync(localPath, req.file.buffer);
          userData.doctorDocument = `/uploads/${localName}`;
          console.log('Fallback saved locally to', localPath);
        }
      } else {
        // no cloudinary configured: save locally
        const localName = `${Date.now()}-${req.file.originalname}`;
        const localPath = path.join(UPLOAD_DIR, localName);
        fs.writeFileSync(localPath, req.file.buffer);
        userData.doctorDocument = `/uploads/${localName}`;
        console.log('Cloudinary not configured; saved locally to', localPath);
      }
      userData.isVerified = false;
    }
  const user = await User.create(userData);
  const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
  // include doctorDocument in response for easier debugging / immediate preview in frontend
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, isVerified: user.isVerified, doctorDocument: user.doctorDocument }, token });
  } catch (err) { console.error(err); res.status(500).json({ message: "Server error" }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });
    // prevent unverified doctors from logging in
    if (user.role === 'Doctor' && !user.isVerified) {
      return res.status(403).json({ message: 'Account pending verification by admin. You cannot log in until your account is approved.', needsVerification: true });
    }

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, isVerified: user.isVerified }, token });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user });
});

// Update current user's profile
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const allowed = ["name", "avatar", "registrationNumber", "age", "contactNumber"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    // validation
    if (updates.age !== undefined) {
      const a = Number(updates.age);
      if (isNaN(a) || a < 0 || a > 150) return res.status(400).json({ message: 'Invalid age' });
      updates.age = a;
    }
    if (updates.contactNumber !== undefined) {
      const digits = String(updates.contactNumber).replace(/\D/g, '');
      if (digits.length !== 0 && digits.length !== 10) return res.status(400).json({ message: 'Contact number must be 10 digits or empty' });
      updates.contactNumber = updates.contactNumber ? String(updates.contactNumber) : '';
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('[auth] PUT /me failed', err);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    console.log(`[AUTH] Password reset token for ${email}: ${token}`);

    console.log(`[AUTH] Password reset token for ${email}: ${token}`);

    // Create Ethereal Test Account (Auto-generated)
    const nodemailer = require("nodemailer");
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    const mailOptions = {
      from: '"CareCircle Support" <support@carecircle.com>',
      to: email,
      subject: "Password Reset - CareCircle",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
            `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
            `http://localhost:5173/reset-password?token=${token}\n\n` +
            `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[AUTH] Email sent: ${info.messageId}`);
    console.log(`[AUTH] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

    res.json({ message: "Password reset email sent. Check backend logs for Preview URL." });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ message: "Error sending email. Please check server logs." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
