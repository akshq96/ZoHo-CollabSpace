const express = require('express');
const { createStatus, getStatuses, getMyStatus, deleteMyStatus } = require('../controllers/statusController');
const protectRoute = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/', protectRoute, upload.single('media'), createStatus);
router.get('/', protectRoute, getStatuses);
router.get('/mine', protectRoute, getMyStatus);
router.delete('/', protectRoute, deleteMyStatus);

module.exports = router;
