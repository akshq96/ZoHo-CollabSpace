const express = require('express');
const { getContacts, addContact, removeContact } = require('../controllers/contactController');
const protectRoute = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectRoute, getContacts);
router.post('/', protectRoute, addContact);
router.delete('/:userId', protectRoute, removeContact);

module.exports = router;
