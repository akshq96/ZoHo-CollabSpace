const Contact = require('../models/Contact');
const User = require('../models/User');
const response = require('../utils/responseHandler');

const getContacts = async (req, res) => {
    const ownerId = req.user._id;
    try {
        const contacts = await Contact.find({ owner: ownerId })
            .populate('contactUser', 'username email phoneNumber phoneSuffix profilePicture about isOnline lastSeen')
            .sort({ createdAt: -1 });

        // Filter out contacts whose target user no longer exists.
        const validContacts = contacts.filter(c => c.contactUser);

        return response(res, 200, "Contacts retrieved successfully", validContacts.map(c => ({
            contactId: c._id,
            addedAt: c.createdAt,
            user: c.contactUser
        })));
    } catch (error) {
        console.error("Error in getContacts:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const addContact = async (req, res) => {
    const ownerId = req.user._id;
    const { userId } = req.body;

    if (!userId) {
        return response(res, 400, "userId is required");
    }
    if (userId === ownerId.toString()) {
        return response(res, 400, "You can't add yourself as a contact");
    }

    try {
        const targetUser = await User.findById(userId).select('-emailOtp -emailOtpExpiry');
        if (!targetUser) {
            return response(res, 404, "User not found");
        }

        let contact = await Contact.findOne({ owner: ownerId, contactUser: userId });
        if (!contact) {
            contact = await Contact.create({ owner: ownerId, contactUser: userId });
        }

        return response(res, 201, "Contact added", { contactId: contact._id, addedAt: contact.createdAt, user: targetUser });
    } catch (error) {
        console.error("Error in addContact:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const removeContact = async (req, res) => {
    const ownerId = req.user._id;
    const { userId } = req.params;

    try {
        await Contact.deleteOne({ owner: ownerId, contactUser: userId });
        // Removing a contact intentionally does NOT touch Conversation/Message
        // records — existing chat history stays available.
        return response(res, 200, "Contact removed", { userId });
    } catch (error) {
        console.error("Error in removeContact:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { getContacts, addContact, removeContact };
