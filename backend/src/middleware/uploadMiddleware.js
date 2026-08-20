const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    // Phone-shot videos routinely exceed the old 25MB cap — that was a real
    // cause of "status upload fails" for video/large-image posts: multer
    // throws LIMIT_FILE_SIZE, and with no error-handling middleware in
    // index.js that became an unhandled HTML error page instead of a JSON
    // response the frontend could parse/show (see index.js's new handler).
    fileSize: 75 * 1024 * 1024 // 75 MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, documents, archives, and code files
    cb(null, true);
  }
});

module.exports = upload;
