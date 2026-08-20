const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Local disk-backed storage. This is the default (and always-correct) storage
// path used whenever Cloudinary credentials are not configured. Unlike the
// previous fallback (a random stock-photo URL for chat/status media, or a
// username-seeded avatar), this guarantees the file a user selects is byte-
// for-byte the file that gets served back — every stored file gets its own
// cryptographically random name, so two uploads can never collide or be
// confused with one another regardless of original filename.
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
};

function safeExtension(originalname, mimetype) {
  const fromName = path.extname(originalname || '').toLowerCase();
  if (fromName && /^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return EXT_BY_MIME[mimetype] || '';
}

function ensureDir(subfolder) {
  const dir = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Persist an uploaded file buffer to disk under a unique name and return the
 * public-facing relative URL (served by the /uploads static route in
 * index.js) along with the identity fields needed to reference this exact
 * file later (storedName, mimeType, size).
 */
function saveBuffer(buffer, originalname, mimetype, subfolder = 'misc') {
  const dir = ensureDir(subfolder);
  const uniqueId = crypto.randomUUID();
  const ext = safeExtension(originalname, mimetype);
  const storedName = `${uniqueId}${ext}`;
  const fullPath = path.join(dir, storedName);
  fs.writeFileSync(fullPath, buffer);

  return {
    storedName,
    url: `/uploads/${subfolder}/${storedName}`,
    mimeType: mimetype,
    size: buffer.length,
  };
}

module.exports = { saveBuffer, UPLOADS_ROOT };
