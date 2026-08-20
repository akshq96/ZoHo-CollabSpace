const express = require('express');
const { uploadFile, getFiles, deleteFile, shareFile } = require('../controllers/fileController');
const protectRoute = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', protectRoute, getFiles);
router.post('/upload', protectRoute, upload.single('file'), uploadFile);
router.post('/:fileId/share', protectRoute, shareFile);
router.delete('/:fileId', protectRoute, deleteFile);

module.exports = router;
