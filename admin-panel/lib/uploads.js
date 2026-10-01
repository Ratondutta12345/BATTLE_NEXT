const fs = require('fs');
const path = require('path');

const uploadRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'public', 'uploads');

function getUploadDirectory(category) {
  const directory = path.join(uploadRoot, category);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function resolveUploadUrl(value) {
  const url = String(value || '');
  if (!url.startsWith('/uploads/')) return null;
  const resolved = path.resolve(uploadRoot, url.slice('/uploads/'.length));
  return resolved.startsWith(`${uploadRoot}${path.sep}`) ? resolved : null;
}

module.exports = { getUploadDirectory, resolveUploadUrl, uploadRoot };
