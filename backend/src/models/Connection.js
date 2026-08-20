const mongoose = require('mongoose');

// Replaces the old one-directional Contact model with a real relationship
// state machine: NONE (no doc) -> PENDING -> ACCEPTED / DECLINED, plus a
// BLOCKED terminal state. There is at most ONE document between any two
// users regardless of direction — enforced by the unique `pairKey` index
// (the two user ids sorted and joined), so "A requests B" and "B requests A"
// can never create duplicate/conflicting relationship rows.
const connectionSchema = new mongoose.Schema({
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED'],
        default: 'PENDING',
    },
    // Who most recently blocked whom — only meaningful when status is
    // BLOCKED. Needed because either side of an existing relationship can
    // initiate a block.
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Set when status transitions to DECLINED so sendRequest can enforce a
    // cooldown before the same requester can try again.
    declinedAt: { type: Date },
    // [userA, userB].map(String).sort().join('_') — the invariant that
    // guarantees uniqueness regardless of who requested whom.
    pairKey: { type: String, required: true },
}, { timestamps: true });

connectionSchema.index({ pairKey: 1 }, { unique: true });
connectionSchema.index({ requester: 1, status: 1 });
connectionSchema.index({ recipient: 1, status: 1 });

connectionSchema.statics.pairKeyFor = function (a, b) {
    return [String(a), String(b)].sort().join('_');
};

const Connection = mongoose.model('Connection', connectionSchema);
module.exports = Connection;
