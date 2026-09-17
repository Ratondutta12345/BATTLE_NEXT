function requireAdminKey(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    return next();
  }

  const providedKey = req.get('x-admin-key');
  if (providedKey !== configuredKey) {
    return res.status(401).json({ error: 'Admin authorization required' });
  }

  return next();
}

module.exports = { requireAdminKey };
