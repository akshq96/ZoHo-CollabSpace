const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config(); 
const connectDB = require('./src/config/dbConnect');
const bodyParser = require('body-parser');
const http = require('http');

// Routes imports
const authRoute = require('./src/routes/authRoute');
const conversationRoute = require('./src/routes/conversationRoute');
const messageRoute = require('./src/routes/messageRoute');
const userRoute = require('./src/routes/userRoute');
const statusRoute = require('./src/routes/statusRoute');
const fileRoute = require('./src/routes/fileRoute');

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

// Register endpoints
app.use('/api/auth', authRoute);
app.use('/api/conversations', conversationRoute);
app.use('/api/messages', messageRoute);
app.use('/api/users', userRoute);
app.use('/api/status', statusRoute);
app.use('/api/files', fileRoute);

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
