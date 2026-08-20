const Connection = require('../models/Connection');
const User = require('../models/User');
const response = require('../utils/responseHandler');

const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h before re-requesting someone who declined you

// Derive the viewer-relative state ('NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED'
// | 'ACCEPTED' | 'BLOCKED' | 'BLOCKED_BY_THEM') a UI needs to decide which
// button(s) to render for a given other user. This is intentionally the ONE
// place that maps a raw Connection doc onto a viewer's perspective — the
// frontend never re-derives this itself.
function stateFor(doc, viewerId) {
    if (!doc) return 'NONE';
    if (doc.status === 'ACCEPTED') return 'ACCEPTED';
    if (doc.status === 'PENDING') {
        return doc.requester.toString() === viewerId.toString() ? 'PENDING_SENT' : 'PENDING_RECEIVED';
    }
    if (doc.status === 'BLOCKED') {
        return doc.blockedBy && doc.blockedBy.toString() === viewerId.toString() ? 'BLOCKED' : 'BLOCKED_BY_THEM';
    }
    // DECLINED collapses back to NONE from the UI's point of view — the
    // cooldown is enforced server-side in sendRequest, not surfaced as a
    // distinct state the frontend has to special-case.
    return 'NONE';
}

// Whether userA is currently allowed to message userB — the ONE backend
// gate every message-sending / conversation-creation path must call. Never
// trust a frontend-hidden button for this.
const canMessage = async (userAId, userBId) => {
    const doc = await Connection.findOne({ pairKey: Connection.pairKeyFor(userAId, userBId) });
    return !!doc && doc.status === 'ACCEPTED';
};

// Whether either user has blocked the other — used to hard-stop messaging,
// connection requests, and status visibility regardless of any other state.
const isBlockedEitherWay = async (userAId, userBId) => {
    const doc = await Connection.findOne({ pairKey: Connection.pairKeyFor(userAId, userBId) });
    return !!doc && doc.status === 'BLOCKED';
};

const sendRequest = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params;

    if (!userId) return response(res, 400, "userId is required");
    if (userId === me.toString()) return response(res, 400, "You can't connect with yourself");

    try {
        const target = await User.findById(userId).select('username');
        if (!target) return response(res, 404, "User not found");

        const pairKey = Connection.pairKeyFor(me, userId);
        let doc = await Connection.findOne({ pairKey });

        if (doc) {
            if (doc.status === 'ACCEPTED') return response(res, 400, "You're already connected.");
            if (doc.status === 'BLOCKED') return response(res, 403, "Unable to send a connection request to this user.");
            if (doc.status === 'PENDING') {
                if (doc.requester.toString() === me.toString()) {
                    return response(res, 400, "Request already sent.");
                }
                return response(res, 400, `${target.username || 'This user'} already sent you a request — check Connection Requests to accept it.`);
            }
            if (doc.status === 'DECLINED') {
                if (doc.declinedAt && Date.now() - new Date(doc.declinedAt).getTime() < DECLINE_COOLDOWN_MS) {
                    const waitHrs = Math.ceil((DECLINE_COOLDOWN_MS - (Date.now() - new Date(doc.declinedAt).getTime())) / 3600000);
                    return response(res, 429, `You can send another request to ${target.username || 'this user'} in ${waitHrs}h.`);
                }
                doc.requester = me;
                doc.recipient = userId;
                doc.status = 'PENDING';
                doc.declinedAt = null;
                await doc.save();
                return response(res, 201, "Connection request sent", doc);
            }
        }

        doc = await Connection.create({ requester: me, recipient: userId, status: 'PENDING', pairKey });
        return response(res, 201, "Connection request sent", doc);
    } catch (error) {
        console.error("Error in sendRequest:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const acceptRequest = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params; // the requester

    try {
        const pairKey = Connection.pairKeyFor(me, userId);
        const doc = await Connection.findOne({ pairKey });
        if (!doc || doc.status !== 'PENDING') return response(res, 404, "No pending request from this user.");
        if (doc.recipient.toString() !== me.toString()) return response(res, 403, "Only the recipient can accept this request.");

        doc.status = 'ACCEPTED';
        await doc.save();
        const populated = await doc.populate('requester recipient', 'username profilePicture about isOnline lastSeen');
        return response(res, 200, "Connection accepted", populated);
    } catch (error) {
        console.error("Error in acceptRequest:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const declineRequest = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params;

    try {
        const pairKey = Connection.pairKeyFor(me, userId);
        const doc = await Connection.findOne({ pairKey });
        if (!doc || doc.status !== 'PENDING') return response(res, 404, "No pending request from this user.");
        if (doc.recipient.toString() !== me.toString()) return response(res, 403, "Only the recipient can decline this request.");

        doc.status = 'DECLINED';
        doc.declinedAt = new Date();
        await doc.save();
        return response(res, 200, "Connection declined", { userId });
    } catch (error) {
        console.error("Error in declineRequest:", error);
        return response(res, 500, "Internal Server Error");
    }
};

// "Remove Contact" on an ACCEPTED connection. Deletes the relationship doc
// (not the conversation/messages — those live in separate models and are
// untouched) so a fresh connection request can be sent later without
// waiting out a decline cooldown that was never actually earned.
const removeConnection = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params;

    try {
        const pairKey = Connection.pairKeyFor(me, userId);
        const doc = await Connection.findOne({ pairKey });
        if (doc && doc.status === 'ACCEPTED') {
            await Connection.deleteOne({ _id: doc._id });
        }
        return response(res, 200, "Contact removed", { userId });
    } catch (error) {
        console.error("Error in removeConnection:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const blockUser = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params;

    if (userId === me.toString()) return response(res, 400, "You can't block yourself");

    try {
        const pairKey = Connection.pairKeyFor(me, userId);
        let doc = await Connection.findOne({ pairKey });
        if (doc) {
            doc.status = 'BLOCKED';
            doc.blockedBy = me;
            await doc.save();
        } else {
            doc = await Connection.create({ requester: me, recipient: userId, status: 'BLOCKED', blockedBy: me, pairKey });
        }
        return response(res, 200, "User blocked", doc);
    } catch (error) {
        console.error("Error in blockUser:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const unblockUser = async (req, res) => {
    const me = req.user._id;
    const { userId } = req.params;

    try {
        const pairKey = Connection.pairKeyFor(me, userId);
        const doc = await Connection.findOne({ pairKey });
        if (!doc || doc.status !== 'BLOCKED') return response(res, 404, "No block found for this user.");
        if (!doc.blockedBy || doc.blockedBy.toString() !== me.toString()) {
            return response(res, 403, "Only the person who blocked can unblock.");
        }
        await Connection.deleteOne({ _id: doc._id });
        return response(res, 200, "User unblocked", { userId });
    } catch (error) {
        console.error("Error in unblockUser:", error);
        return response(res, 500, "Internal Server Error");
    }
};

// "My Contacts" — every ACCEPTED connection involving me.
const getConnections = async (req, res) => {
    const me = req.user._id;
    try {
        const docs = await Connection.find({
            status: 'ACCEPTED',
            $or: [{ requester: me }, { recipient: me }],
        })
            .populate('requester recipient', 'username email phoneNumber phoneSuffix profilePicture about isOnline lastSeen')
            .sort({ updatedAt: -1 });

        const contacts = docs
            .map((d) => {
                const other = d.requester._id.toString() === me.toString() ? d.recipient : d.requester;
                return other ? { connectionId: d._id, since: d.updatedAt, user: other } : null;
            })
            .filter(Boolean);

        return response(res, 200, "Contacts retrieved successfully", contacts);
    } catch (error) {
        console.error("Error in getConnections:", error);
        return response(res, 500, "Internal Server Error");
    }
};

// "Connection Requests" — pending requests I've RECEIVED (need my action).
const getPendingRequests = async (req, res) => {
    const me = req.user._id;
    try {
        const docs = await Connection.find({ status: 'PENDING', recipient: me })
            .populate('requester', 'username email phoneNumber phoneSuffix profilePicture about')
            .sort({ createdAt: -1 });

        const requests = docs.map((d) => ({ connectionId: d._id, requestedAt: d.createdAt, user: d.requester }));
        return response(res, 200, "Pending requests retrieved successfully", requests);
    } catch (error) {
        console.error("Error in getPendingRequests:", error);
        return response(res, 500, "Internal Server Error");
    }
};

// One roundtrip that returns every relationship state involving me — the
// frontend uses this to render Connect/Request Sent/Accept-Decline/Message/
// Blocked buttons in Discover People + search results without an N+1 of
// per-user relationship lookups.
const getRelationshipsMap = async (req, res) => {
    const me = req.user._id;
    try {
        const docs = await Connection.find({ $or: [{ requester: me }, { recipient: me }] });
        const map = {};
        docs.forEach((d) => {
            const otherId = d.requester.toString() === me.toString() ? d.recipient.toString() : d.requester.toString();
            map[otherId] = { state: stateFor(d, me), connectionId: d._id };
        });
        return response(res, 200, "Relationships retrieved successfully", map);
    } catch (error) {
        console.error("Error in getRelationshipsMap:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const getBlockedUsers = async (req, res) => {
    const me = req.user._id;
    try {
        const docs = await Connection.find({ status: 'BLOCKED', blockedBy: me })
            .populate('requester recipient', 'username email profilePicture');
        const blocked = docs.map((d) => {
            const other = d.requester._id.toString() === me.toString() ? d.recipient : d.requester;
            return { connectionId: d._id, user: other };
        });
        return response(res, 200, "Blocked users retrieved successfully", blocked);
    } catch (error) {
        console.error("Error in getBlockedUsers:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = {
    sendRequest,
    acceptRequest,
    declineRequest,
    removeConnection,
    blockUser,
    unblockUser,
    getConnections,
    getPendingRequests,
    getRelationshipsMap,
    getBlockedUsers,
    // internal helpers reused by other controllers
    canMessage,
    isBlockedEitherWay,
};
