const { Server } = require('socket.io');
const User = require('../models/User');

let io;
const userSocketMap = {}; // userId -> socketId

const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT"]
        }
    });

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        const userId = socket.handshake.query.userId;

        if (userId && userId !== "undefined") {
            userSocketMap[userId] = socket.id;

            // Mark user online
            User.findByIdAndUpdate(userId, { isOnline: true })
                .then(() => {
                    io.emit("getOnlineUsers", Object.keys(userSocketMap));
                })
                .catch(err => console.error("Error setting user online:", err));
        }

        // Typing indicator events
        socket.on('typing', ({ receiverId }) => {
            const receiverSocketId = getReceiverSocketId(receiverId);
            if (receiverSocketId) {
                socket.to(receiverSocketId).emit('typing', { senderId: userId });
            }
        });

        socket.on('stop_typing', ({ receiverId }) => {
            const receiverSocketId = getReceiverSocketId(receiverId);
            if (receiverSocketId) {
                socket.to(receiverSocketId).emit('stop_typing', { senderId: userId });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            if (userId && userId !== "undefined") {
                delete userSocketMap[userId];
                
                // Mark user offline
                User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() })
                    .then(() => {
                        io.emit("getOnlineUsers", Object.keys(userSocketMap));
                    })
                    .catch(err => console.error("Error setting user offline:", err));
            }
        });
    });

    return io;
};

module.exports = { initializeSocket, getReceiverSocketId };
