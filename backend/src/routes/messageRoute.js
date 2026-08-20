const express = require('express');
const { sendMessage, getMessages, markMessagesAsSeen, searchMessages } = require('../controllers/messageController');
const protectRoute = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/send', protectRoute, upload.single('file'), sendMessage);
// Must be registered before the /:conversationId catch-all below, otherwise
// Express would treat "search" as a conversation id.
router.get('/search', protectRoute, searchMessages);
router.get('/:conversationId', protectRoute, getMessages);
router.post('/seen/:conversationId', protectRoute, markMessagesAsSeen);

module.exports = router;
