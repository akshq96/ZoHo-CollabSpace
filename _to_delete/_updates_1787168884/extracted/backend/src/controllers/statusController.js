const Status = require('../models/Status');
const response = require('../utils/responseHandler');
const cloudinary = require('../config/cloudinaryConfig');

const createStatus = async (req, res) => {
    const userId = req.user._id;
    const { caption, mediaType = 'image' } = req.body;

    if (!req.file) {
        return response(res, 400, "Media file is required for status updates");
    }

    try {
        let mediaUrl = null;

        // Upload media to Cloudinary or fallback
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            const uploadResult = await cloudinary.uploader.upload(fileStr, {
                resource_type: mediaType === 'video' ? 'video' : 'image',
                folder: 'status_stories'
            });
            mediaUrl = uploadResult.secure_url;
        } else {
            console.warn("Cloudinary not configured. Falling back to dummy media url for status.");
            mediaUrl = `https://picsum.photos/400/600?random=${Math.floor(Math.random() * 1000)}`;
        }

        const newStory = {
            mediaUrl,
            mediaType,
            caption: caption || '',
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
        .populate('user', 'username profilePicture')
        .sort({ updatedAt: -1 });

        return response(res, 200, "Statuses retrieved successfully", statuses);
    } catch (error) {
        console.error("Error in getStatuses:", error);
        return response(res, 500, "Internal Server Error");
    }
};

module.exports = { createStatus, getStatuses, getMyStatus, deleteMyStatus };
