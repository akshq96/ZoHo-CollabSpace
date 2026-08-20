const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    mediaUrl: { type: String, required: true },
    // Identity fields for the exact uploaded media (see storageService.js) —
    // prevents a status from ever displaying a different file than the one
    // the user selected.
    storedName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    caption: { type: String, default: '' },
    // Optional user-uploaded audio track (mp3/wav/m4a) played alongside an
    // image status, or alongside a video status with its own audio muted.
    // No server-side muxing — this is a separate stored file referenced by
    // its own URL, never a filename/index guess.
    audioUrl: { type: String },
    audioStoredName: { type: String },
    audioMimeType: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const statusSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stories: [storySchema],
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index to automatically delete status documents when expiresAt is reached
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Status = mongoose.model('Status', statusSchema);
module.exports = Status;
