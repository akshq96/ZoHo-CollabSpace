const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { canMessage, isBlockedEitherWay } = require('./connectionController');
const response = require('../utils/responseHandler');

const createOrGetConversation = async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
        return response(res, 400, "Receiver ID is required");
    }
    if (receiverId === senderId.toString()) {
        return response(res, 400, "You can't start a conversation with yourself");
    }

    try {
        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return response(res, 404, "Receiver not found");
        }

        // Check if a 1:1 conversation already exists between exactly these two
        // people. isGroup:false + participants.$size:2 keeps this from ever
        // matching a group conversation that happens to include both users —
        // otherwise "New Chat" could send someone into the wrong conversation.
        let conversation = await Conversation.findOne({
            isGroup: false,
            participants: { $all: [senderId, receiverId], $size: 2 }
        }).populate('participants', 'username profilePicture about isOnline lastSeen');

        if (!conversation) {
            // Being registered on ZoHo does NOT mean anyone can message you —
            // a brand-new 1:1 conversation can only be created between two
            // users with an ACCEPTED connection. Existing conversations
            // (created before this rule, or from a since-removed connection)
            // are never retroactively blocked from continuing — see
            // sendMessage's own block-check for the one thing that DOES
            // apply retroactively (an active block).
            if (await isBlockedEitherWay(senderId, receiverId)) {
                return response(res, 403, "You can't start a conversation with this user.");
            }
            if (!(await canMessage(senderId, receiverId))) {
                return response(res, 403, `You need to connect with ${receiver.username || 'this user'} before you can message them.`);
            }

            conversation = new Conversation({
                participants: [senderId, receiverId],
                isGroup: false,
                unreadcount: 0
            });
            await conversation.save();
            conversation = await conversation.populate('participants', 'username profilePicture about isOnline lastSeen');
        }

        return response(res, 200, "Conversation retrieved/created successfully", conversation);
    } catch (error) {
        console.error("Error in createOrGetConversation:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const getConversations = async (req, res) => {
    const userId = req.user._id;

    try {
        // Find conversations where the user is a participant
        const conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'username profilePicture about isOnline lastSeen')
        .populate({
            path: 'lastMessage',
            populate: {
                path: 'sender receiver',
                select: 'username profilePicture'
            }
        })
        .sort({ updatedAt: -1 });

        return response(res, 200, "Conversations retrieved successfully", conversations);
    } catch (error) {
        console.error("Error in getConversations:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const createGroupConversation = async (req, res) => {
    const { groupName, participants } = req.body;
    const adminId = req.user._id;

    if (!groupName || !participants || !Array.isArray(participants) || participants.length === 0) {
        return response(res, 400, "Group name and participants list are required");
    }

    try {
        // Ensure admin is included in participants
        const uniqueParticipants = Array.from(new Set([...participants, adminId.toString()]));

        // Generate dynamic group avatar
        const groupAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName)}`;

        const newGroup = new Conversation({
            participants: uniqueParticipants,
            isGroup: true,
            groupName,
            groupAdmin: adminId,
            groupAvatar
        });

        await newGroup.save();

        const populatedGroup = await Conversation.findById(newGroup._id)
            .populate('participants', 'username profilePicture about isOnline lastSeen')
            .populate('groupAdmin', 'username profilePicture');

        return response(res, 201, "Group conversation created successfully", populatedGroup);
    } catch (error) {
        console.error("Error in createGroupConversation:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { createOrGetConversation, getConversations, createGroupConversation };
