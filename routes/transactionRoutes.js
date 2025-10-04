const express = require('express');
const router = express.Router();
const { getAllTransactions, exportTransactions } = require('../controllers/transactionController');
const auth = require('../middleware/authMiddleware');
const { exportSummary } = require('../controllers/transactionController');

router.get('/', auth, getAllTransactions);
router.get('/export', auth, exportTransactions);
router.get('/summary-export', auth, exportSummary);

module.exports = router;