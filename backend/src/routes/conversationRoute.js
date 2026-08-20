const express = require('express');
const { createOrGetConversation, getConversations, createGroupConversation } = require('../controllers/conversationController');
const protectRoute = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protectRoute, createOrGetConversation);
router.get('/', protectRoute, getConversations);
router.post('/group', protectRoute, createGroupConversation);

module.exports = router;
