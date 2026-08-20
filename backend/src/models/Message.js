const mongoose = require('mongoose');


// ye code yahan pe use kiya gya hai for messages in conversation between users.
// jaise ki senders aur receivers ke beech mein messages ka record rakhna.
// or message ke content, type, reactions aur status ko track karna.
// or timestamps se pata chal jata hai ki message kab bheja gaya tha aur kab update hua tha.
// or messageType se pata chalta hai ki message kis type ka hai jaise text, image, video, audio ya file.

const messageSchema = new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String,},
    imageOrFileUrl: { type: String },
    // Authoritative reference to the exact uploaded File record for this
    // message's attachment (if any). imageOrFileUrl is kept in sync with
    // attachment.fileUrl at write time so existing UI code that only reads
    // imageOrFileUrl keeps working, but `attachment` is what guarantees the
    // message always points at the exact file that was uploaded rather than
    // a URL that could be stale, reused, or mismatched.
    attachment: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    messageType: { type: String, enum: ['text', 'image', 'video', 'audio', 'file']},
    reactions: [
    { 
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
        emoji: String 
    },
],
    messageStatus: { type: String,default: 'sent' },
}, { timestamps: true });

const  Message= mongoose.model('Message', messageSchema);
module.exports = Message;