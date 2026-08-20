const File = require('../models/File');
const response = require('../utils/responseHandler');
const cloudinary = require('../config/cloudinaryConfig');
const { saveBuffer } = require('../services/storageService');

const cloudinaryConfigured = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const uploadFile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    if (!req.file) {
      return response(res, 400, "No file uploaded");
    }

    const { mimetype, originalname, size, buffer } = req.file;
    
    // Determine file category
    let fileType = 'other';
    if (mimetype.startsWith('image/')) fileType = 'image';
    else if (mimetype.startsWith('video/')) fileType = 'video';
    else if (mimetype.includes('pdf') || mimetype.includes('word') || mimetype.includes('document') || mimetype.includes('text') || mimetype.includes('sheet') || mimetype.includes('csv')) {
      fileType = 'document';
    }

    let fileUrl = '';
    let storedName = '';
    if (cloudinaryConfigured()) {
      const fileStr = `data:${mimetype};base64,${buffer.toString('base64')}`;
      const uploadResult = await cloudinary.uploader.upload(fileStr, {
        resource_type: fileType === 'video' ? 'video' : 'auto',
        folder: 'workspace_files'
      });
      fileUrl = uploadResult.secure_url;
      storedName = uploadResult.public_id;
    } else {
      // Local disk storage, keyed by a random id — never the original
      // filename — so two uploads named the same thing never collide.
      const saved = saveBuffer(buffer, originalname, mimetype, 'files');
      fileUrl = saved.url;
      storedName = saved.storedName;
    }

    const newFile = await File.create({
      owner: userId,
      filename: originalname,
      storedName,
      fileUrl,
      fileType,
      mimeType: mimetype,
      fileSize: size
    });

    const populatedFile = await File.findById(newFile._id).populate('owner', 'username email profilePicture');

    return response(res, 201, "File uploaded successfully", populatedFile);
  } catch (error) {
    console.error("Error in uploadFile:", error);
    return response(res, 500, "Failed to upload file");
  }
};

const getFiles = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { category } = req.query; // 'all', 'images', 'videos', 'documents', 'shared', 'mine'

    let query = {
      $or: [
        { owner: userId },
        { sharedWith: userId }
      ]
    };

    if (category === 'images') {
      query.fileType = 'image';
    } else if (category === 'videos') {
      query.fileType = 'video';
    } else if (category === 'documents') {
      query.fileType = 'document';
    } else if (category === 'mine') {
      query = { owner: userId };
    } else if (category === 'shared') {
      query = { sharedWith: userId };
    }

    const files = await File.find(query)
      .populate('owner', 'username email profilePicture')
      .populate('sharedWith', 'username email profilePicture')
      .sort({ createdAt: -1 });

    return response(res, 200, "Files retrieved successfully", files);
  } catch (error) {
    console.error("Error in getFiles:", error);
    return response(res, 500, "Failed to fetch files");
  }
};

const shareFile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { fileId } = req.params;
    const { userIds } = req.body; // array of user ids to share with

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return response(res, 400, "userIds array is required");
    }

    const file = await File.findById(fileId);
    if (!file) {
      return response(res, 404, "File not found");
    }

    if (file.owner.toString() !== userId.toString()) {
      return response(res, 403, "You do not have permission to share this file");
    }

    const existing = new Set(file.sharedWith.map((id) => id.toString()));
    userIds.forEach((id) => existing.add(id.toString()));
    file.sharedWith = Array.from(existing);
    await file.save();

    const populatedFile = await File.findById(file._id)
      .populate('owner', 'username email profilePicture')
      .populate('sharedWith', 'username email profilePicture');

    return response(res, 200, "File shared successfully", populatedFile);
  } catch (error) {
    console.error("Error in shareFile:", error);
    return response(res, 500, "Failed to share file");
  }
};

const deleteFile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return response(res, 404, "File not found");
    }

    if (file.owner.toString() !== userId.toString()) {
      return response(res, 403, "You do not have permission to delete this file");
    }

    await File.findByIdAndDelete(fileId);
    return response(res, 200, "File deleted successfully", { fileId });
  } catch (error) {
    console.error("Error in deleteFile:", error);
    return response(res, 500, "Failed to delete file");
  }
};

module.exports = {
  uploadFile,
  getFiles,
  deleteFile,
  shareFile
};
