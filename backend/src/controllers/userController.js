const User = require('../models/User');
const Connection = require('../models/Connection');
const response = require('../utils/responseHandler');

// Users with an active BLOCKED relationship (either direction) with the
// viewer should never surface in Discover People or search results.
async function blockedUserIds(viewerId) {
    const docs = await Connection.find({
        status: 'BLOCKED',
        $or: [{ requester: viewerId }, { recipient: viewerId }],
    }).select('requester recipient');
    return docs.map((d) => (d.requester.toString() === viewerId.toString() ? d.recipient.toString() : d.requester.toString()));
}

const getAllUsers = async (req, res) => {
    const activeUserId = req.user._id;

    try {
        const excluded = await blockedUserIds(activeUserId);
        const users = await User.find({ _id: { $ne: activeUserId, $nin: excluded } })
            .select('-emailOtp -emailOtpExpiry');
        return response(res, 200, "Users retrieved successfully", users);
    } catch (error) {
        console.error("Error in getAllUsers:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const searchUsers = async (req, res) => {
    const activeUserId = req.user._id;
    const { q } = req.query;

    if (!q) {
        return response(res, 400, "Search query is required");
    }

    try {
        const excluded = await blockedUserIds(activeUserId);
        // Case-insensitive regex match on username, email, or phone
        const regex = new RegExp(q, 'i');
        const users = await User.find({
            _id: { $ne: activeUserId, $nin: excluded },
            $or: [
                { username: regex },
                { email: regex },
                { phoneNumber: regex }
            ]
        }).select('-emailOtp -emailOtpExpiry');

        return response(res, 200, "Users searched successfully", users);
    } catch (error) {
        console.error("Error in searchUsers:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { getAllUsers, searchUsers };
