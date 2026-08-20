const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  // The randomly-generated on-disk (or Cloudinary public) name. Never derived
  // from the original filename, so two uploads with the same name can never
  // collide or be confused with one another.
  storedName: {
    type: String
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['image', 'video', 'document', 'other'],
    default: 'other'
  },
  mimeType: {
    type: String
  },
  fileSize: {
    type: Number,
    default: 0
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
