const express = require('express');
const { getAllUsers, searchUsers } = require('../controllers/userController');
const protectRoute = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectRoute, getAllUsers);
router.get('/search', protectRoute, searchUsers);

module.exports = router;
