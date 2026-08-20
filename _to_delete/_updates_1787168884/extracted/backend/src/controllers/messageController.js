const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const File = require('../models/File');
const { getReceiverSocketId } = require('../socket/socket');
const response = require('../utils/responseHandler');
const cloudinary = require('../config/cloudinaryConfig');

const sendMessage = async (req, res) => {
    const { conversationId, content, messageType = 'text', receiverId } = req.body;
    const senderId = req.user._id;

    if (!conversationId && !receiverId) {
        return response(res, 400, "Either conversationId or receiverId is required");
    }

    try {
        let activeConversationId = conversationId;
        let activeReceiverId = receiverId;
        let conversation;

        // If conversationId is not provided, find or create conversation first
        if (!activeConversationId) {
            conversation = await Conversation.findOne({
                participants: { $all: [senderId, receiverId] },
                isGroup: false
            });

            if (!conversation) {
                conversation = new Conversation({
                    participants: [senderId, receiverId],
                    isGroup: false
                });
                await conversation.save();
            }
            activeConversationId = conversation._id;
            activeReceiverId = receiverId;
        } else {
            conversation = await Conversation.findById(activeConversationId);
            if (!conversation) {
                return response(res, 404, "Conversation not found");
            }
            if (conversation.isGroup) {
                activeReceiverId = null;
            } else {
                activeReceiverId = conversation.participants.find(
                    (p) => p.toString() !== senderId.toString()
                );
            }
        }

        let mediaUrl = null;
        let actualMessageType = messageType;

        // Handle attachment file if present
        if (req.file) {
            // Determine type if not specified
            if (req.file.mimetype.startsWith('image/')) {
                actualMessageType = 'image';
            } else if (req.file.mimetype.startsWith('video/')) {
                actualMessageType = 'video';
            } else if (req.file.mimetype.startsWith('audio/')) {
                actualMessageType = 'audio';
            } else {
                actualMessageType = 'file';
            }

            if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
                const uploadResult = await cloudinary.uploader.upload(fileStr, {
                    resource_type: "auto",
                    folder: 'chat_attachments'
                });
                mediaUrl = uploadResult.secure_url;
            } else {
                console.warn("Cloudinary not configured. Falling back to dummy media url.");
                mediaUrl = `https://picsum.photos/400/300`; // simple placeholder image
            }

            // Track chat attachments in the shared Files library too, so the
            // Files page (All / Images / Videos / Documents / Shared with me)
            // reflects real files exchanged in conversations.
            try {
                const fileType = ['image', 'video'].includes(actualMessageType)
                    ? actualMessageType
                    : (actualMessageType === 'file' ? 'document' : 'other');

                const shareTargets = conversation.isGroup
                    ? conversation.participants.filter((p) => p.toString() !== senderId.toString())
                    : (activeReceiverId ? [activeReceiverId] : []);

                await File.create({
                    owner: senderId,
                    filename: req.file.originalname,
                    fileUrl: mediaUrl,
                    fileType,
                    mimeType: req.file.mimetype,
                    fileSize: req.file.size,
                    sharedWith: shareTargets
                });
            } catch (fileErr) {
                console.error("Error tracking chat attachment in Files library:", fileErr);
            }
        }

        // Create new message
        const newMessage = new Message({
            conversation: activeConversationId,
            sender: senderId,
            receiver: activeReceiverId,
            content: content || "",
            imageOrFileUrl: mediaUrl,
            messageType: actualMessageType,
            messageStatus: 'sent'
        });

        await newMessage.save();

        // Update conversation lastMessage pointer
        await Conversation.findByIdAndUpdate(activeConversationId, {
            lastMessage: newMessage._id,
        });

        // Populate sender and receiver for real-time emission
        const populatedMessage = await Message.findById(newMessage._id)
            .populate('sender receiver', 'username profilePicture');

        // Socket.IO Emit
        const io = req.app.get('socketio');
        if (io) {
            if (conversation.isGroup) {
                conversation.participants.forEach((participantId) => {
                    if (participantId.toString() !== senderId.toString()) {
                        const socketId = getReceiverSocketId(participantId.toString());
                        if (socketId) {
                            io.to(socketId).emit('newMessage', populatedMessage);
                        }
                    }
                });
            } else if (activeReceiverId) {
                const receiverSocketId = getReceiverSocketId(activeReceiverId.toString());
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('newMessage', populatedMessage);
                }
            }
        }

        return response(res, 201, "Message sent successfully", populatedMessage);
    } catch (error) {
        console.error("Error in sendMessage:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const getMessages = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    try {
        // Verify user is participant of the conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return response(res, 403, "Not authorized to access this conversation");
        }

        const messages = await Message.find({ conversation: conversationId })
            .populate('sender receiver', 'username profilePicture')
            .sort({ createdAt: 1 });

        return response(res, 200, "Messages retrieved successfully", messages);
    } catch (error) {
        console.error("Error in getMessages:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const markMessagesAsSeen = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    try {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return response(res, 403, "Not authorized to access this conversation");
        }

        // Mark all messages sent by the other participant as 'seen'
        await Message.updateMany(
            { conversation: conversationId, receiver: userId, messageStatus: { $ne: 'seen' } },
            { $set: { messageStatus: 'seen' } }
        );

        // Find the other participant's ID
        const otherParticipantId = conversation.participants.find(
            (p) => p.toString() !== userId.toString()
        );

        // Emit socket notification to the sender that their messages have been seen
        const io = req.app.get('socketio');
        if (io) {
            const otherSocketId = getReceiverSocketId(otherParticipantId);
            if (otherSocketId) {
                io.to(otherSocketId).emit('messagesSeen', { conversationId, seenBy: userId });
            }
        }

        return response(res, 200, "Messages marked as seen successfully");
    } catch (error) {
        console.error("Error in markMessagesAsSeen:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { sendMessage, getMessages, markMessagesAsSeen };
