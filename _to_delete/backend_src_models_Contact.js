const mongoose = require('mongoose');

// A one-directional "ownerId added contactUserId" relationship. Adding
// someone does NOT imply they added you back — each direction is its own
// document, matching how the People page distinguishes "My Contacts" from
// "Discover People" per-user.
const contactSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contactUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

contactSchema.index({ owner: 1, contactUser: 1 }, { unique: true });

const Contact = mongoose.model('Contact', contactSchema);
module.exports = Contact;
