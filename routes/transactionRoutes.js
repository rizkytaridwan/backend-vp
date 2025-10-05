const express = require('express');
const router = express.Router();
const { getAllTransactions, exportTransactions, exportSummary, exportSelisihReport } = require('../controllers/transactionController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getAllTransactions);
router.get('/export', auth, exportTransactions);
router.get('/summary-export', auth, exportSummary);
// Rute baru untuk laporan selisih
router.get('/export-selisih', auth, exportSelisihReport);

module.exports = router;
