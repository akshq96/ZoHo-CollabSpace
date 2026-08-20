const mongoose = require('mongoose');

// ye code yahan pe use kiya gya hai for conversations between users.
// lastMessage se pata chalta hai ki conversation mein last message kya tha.
// unreadcount se pata chalta hai ki kitne unread messages hain conversation mein.

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    unreadcount: { type: Number, default: 0 },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    groupAvatar: { type: String }
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;