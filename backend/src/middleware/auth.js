const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);
    req.user = payload;
    try { if (process.env.NODE_ENV !== 'production') console.debug('[auth] user', { id: payload && payload.id, role: payload && payload.role }); } catch (e) {}
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { authMiddleware };
