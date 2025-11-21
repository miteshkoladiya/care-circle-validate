function requireRoles(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });
    const roleValue = (user.role || '').trim();
    // normalized compare (case-insensitive)
    const allowed = roles.map(r => String(r).trim().toLowerCase());
    if (!allowed.includes(roleValue.toLowerCase())) {
      console.warn('[requireRoles] forbidden', { userRole: user.role, allowed: roles });
      return res.status(403).json({ message: `Forbidden: requires role ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = { requireRoles };
