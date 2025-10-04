const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/dashboardController');
const auth = require('../middleware/authMiddleware');

router.get('/stats', auth, getStats);

module.exports = router;