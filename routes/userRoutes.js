// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser, getRoles, getStores } = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getAllUsers);
router.put('/:id', auth, updateUser);
router.get('/roles', auth, getRoles);
router.get('/stores', auth, getStores);

module.exports = router;