const express = require('express');
const {
    sendRequest, acceptRequest, declineRequest, removeConnection,
    blockUser, unblockUser, getConnections, getPendingRequests,
    getRelationshipsMap, getBlockedUsers,
} = require('../controllers/connectionController');
const protectRoute = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectRoute, getConnections);               // My Contacts (ACCEPTED)
router.get('/requests', protectRoute, getPendingRequests);   // Connection Requests (received, PENDING)
router.get('/status', protectRoute, getRelationshipsMap);    // { [userId]: { state, connectionId } }
router.get('/blocked', protectRoute, getBlockedUsers);

router.post('/request/:userId', protectRoute, sendRequest);
router.post('/accept/:userId', protectRoute, acceptRequest);
router.post('/decline/:userId', protectRoute, declineRequest);
router.post('/block/:userId', protectRoute, blockUser);
router.post('/unblock/:userId', protectRoute, unblockUser);
router.delete('/:userId', protectRoute, removeConnection);   // Remove Contact (ACCEPTED only)

module.exports = router;
