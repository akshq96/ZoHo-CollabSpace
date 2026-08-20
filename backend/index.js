const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./src/config/dbConnect');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const multer = require('multer');
const response = require('./src/utils/responseHandler');

// Routes imports
const authRoute = require('./src/routes/authRoute');
const conversationRoute = require('./src/routes/conversationRoute');
const messageRoute = require('./src/routes/messageRoute');
const userRoute = require('./src/routes/userRoute');
const statusRoute = require('./src/routes/statusRoute');
const fileRoute = require('./src/routes/fileRoute');
const connectionRoute = require('./src/routes/connectionRoute');

// Socket import
const { initializeSocket } = require('./src/socket/socket');

const PORT = process.env.PORT || 8000;
const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: true, // Allow client connection
    credentials: true
}));

// Connect to MongoDB
connectDB();

// Serve locally-stored uploads (chat attachments, status media, avatars,
// workspace files) whenever Cloudinary isn't configured. See
// src/services/storageService.js for why this exists: it's what guarantees
// the exact file a user selects is the exact file rendered back to them.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register endpoints
app.use('/api/auth', authRoute);
app.use('/api/conversations', conversationRoute);
app.use('/api/messages', messageRoute);
app.use('/api/users', userRoute);
app.use('/api/status', statusRoute);
app.use('/api/files', fileRoute);
app.use('/api/connections', connectionRoute);

// Global error handler — MUST be registered after all routes. Without this,
// any thrown error (most commonly multer's LIMIT_FILE_SIZE when a status
// video/image exceeds the upload cap, or LIMIT_UNEXPECTED_FILE on a
// mismatched form field) fell through to Express's default handler, which
// returns an HTML/plain-text error page with no CORS/JSON body. The
// frontend's `await res.json()` then throws a SyntaxError on that non-JSON
// response, which every catch block in this app surfaces as a generic
// "Failed to ..." message — hiding the real cause. This turns every error
// into the same structured JSON shape the rest of the API already uses.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return response(res, 413, 'That file is too large. Please choose a smaller image, video, or audio file.');
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return response(res, 400, `Unexpected file field: ${err.field}.`);
        }
        return response(res, 400, `Upload error: ${err.message}`);
    }

    console.error('Unhandled error:', err);
    return response(res, 500, 'Internal Server Error');
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Save Socket.IO instance to app context
app.set('socketio', io);

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
