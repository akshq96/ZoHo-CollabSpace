const Status = require('../models/Status');
const User = require('../models/User');
const Connection = require('../models/Connection');
const response = require('../utils/responseHandler');
const cloudinary = require('../config/cloudinaryConfig');
const { saveBuffer } = require('../services/storageService');

const cloudinaryConfigured = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const AUDIO_TYPES = /^audio\/(mpeg|mp3|wav|x-wav|wave|m4a|mp4|x-m4a)$/;

const createStatus = async (req, res) => {
    const userId = req.user._id;
    const { caption, mediaType = 'image' } = req.body;
    const mediaFile = req.files?.media?.[0] || req.file; // req.file kept for back-compat if upload.single is ever used
    const audioFile = req.files?.audio?.[0];

    if (!mediaFile) {
        return response(res, 400, "Media file is required for status updates");
    }
    if (audioFile && !AUDIO_TYPES.test(audioFile.mimetype)) {
        return response(res, 400, "Audio must be MP3, WAV, or M4A.");
    }

    try {
        let mediaUrl = null;
        let storedName = null;

        // Upload the exact selected media to Cloudinary if configured,
        // otherwise to local disk (see storageService.js). Every story gets
        // its own randomly-named file, so consecutive status posts (even of
        // the same mediaType, even uploaded seconds apart) can never end up
        // pointing at each other's media.
        if (cloudinaryConfigured()) {
            const fileStr = `data:${mediaFile.mimetype};base64,${mediaFile.buffer.toString('base64')}`;
            const uploadResult = await cloudinary.uploader.upload(fileStr, {
                resource_type: mediaType === 'video' ? 'video' : 'image',
                folder: 'status_stories'
            });
            mediaUrl = uploadResult.secure_url;
            storedName = uploadResult.public_id;
        } else {
            const saved = saveBuffer(mediaFile.buffer, mediaFile.originalname, mediaFile.mimetype, 'status');
            mediaUrl = saved.url;
            storedName = saved.storedName;
        }

        // Optional audio track — stored as its own file with its own
        // identity, same "no filename/index guessing" rule as the media
        // itself. No server-side muxing into the video/image file.
        let audioUrl = null;
        let audioStoredName = null;
        if (audioFile) {
            if (cloudinaryConfigured()) {
                const audioStr = `data:${audioFile.mimetype};base64,${audioFile.buffer.toString('base64')}`;
                const audioUpload = await cloudinary.uploader.upload(audioStr, {
                    resource_type: 'video', // Cloudinary serves audio via the video pipeline
                    folder: 'status_audio'
                });
                audioUrl = audioUpload.secure_url;
                audioStoredName = audioUpload.public_id;
            } else {
                const savedAudio = saveBuffer(audioFile.buffer, audioFile.originalname, audioFile.mimetype, 'status-audio');
                audioUrl = savedAudio.url;
                audioStoredName = savedAudio.storedName;
            }
        }

        const newStory = {
            mediaUrl,
            storedName,
            mimeType: mediaFile.mimetype,
            size: mediaFile.size,
            mediaType,
            caption: caption || '',
            audioUrl,
            audioStoredName,
            audioMimeType: audioFile?.mimetype || null,
            createdAt: new Date()
        };

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Check if user already has an active status document
        let userStatus = await Status.findOne({ user: userId });

        if (userStatus) {
            userStatus.stories.push(newStory);
            userStatus.expiresAt = expiresAt; // Reset TTL to 24h from latest story
            await userStatus.save();
        } else {
            userStatus = new Status({
                user: userId,
                stories: [newStory],
                expiresAt
            });
            await userStatus.save();
        }

        const populatedStatus = await Status.findById(userStatus._id)
            .populate('user', 'username profilePicture');

        return response(res, 201, "Status story added successfully", populatedStatus);
    } catch (error) {
        console.error("Error in createStatus:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const getMyStatus = async (req, res) => {
    const userId = req.user._id;

    try {
        const myStatus = await Status.findOne({ user: userId, expiresAt: { $gt: new Date() } })
            .populate('user', 'username profilePicture');

        if (!myStatus) {
            return response(res, 404, "No active status found");
        }

        return response(res, 200, "Your status retrieved successfully", myStatus);
    } catch (error) {
        console.error("Error in getMyStatus:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const deleteMyStatus = async (req, res) => {
    const userId = req.user._id;

    try {
        await Status.deleteOne({ user: userId });
        return response(res, 200, "Status deleted successfully");
    } catch (error) {
        console.error("Error in deleteMyStatus:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const getStatuses = async (req, res) => {
    const userId = req.user._id;

    try {
        // Fetch all active status documents (where expiresAt > now) for other users
        const statuses = await Status.find({
            user: { $ne: userId },
            expiresAt: { $gt: new Date() }
        })
        .populate('user', 'username profilePicture statusPrivacy')
        .sort({ updatedAt: -1 });

        if (statuses.length === 0) return response(res, 200, "Statuses retrieved successfully", []);

        // Pull every relationship between me and the authors of these
        // statuses in one query — used for both the 'contacts' privacy gate
        // (statusPrivacy === 'contacts' now means "accepted connections
        // only") and to hard-exclude anyone in a BLOCKED relationship with
        // me, regardless of their privacy setting.
        const authorIds = statuses.map(s => s.user?._id).filter(Boolean);
        const relDocs = await Connection.find({
            pairKey: { $in: authorIds.map(id => Connection.pairKeyFor(userId, id)) }
        });
        const relByAuthor = new Map();
        relDocs.forEach((d) => {
            const otherId = d.requester.toString() === userId.toString() ? d.recipient.toString() : d.requester.toString();
            relByAuthor.set(otherId, d);
        });

        const visibleStatuses = statuses.filter(s => {
            if (!s.user) return false;
            const rel = relByAuthor.get(s.user._id.toString());
            if (rel && rel.status === 'BLOCKED') return false; // blocked either direction — never visible
            if (s.user.statusPrivacy !== 'contacts') return true; // 'everyone'
            return !!rel && rel.status === 'ACCEPTED'; // 'contacts' == accepted connections only
        });

        return response(res, 200, "Statuses retrieved successfully", visibleStatuses);
    } catch (error) {
        console.error("Error in getStatuses:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { createStatus, getStatuses, getMyStatus, deleteMyStatus };
