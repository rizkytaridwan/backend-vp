// admin-dashboard-backend/src/routes/storeRoutes.js

const express = require('express');
const router = express.Router();
const { getAllStores, createStore, updateStore, deleteStore } = require('../controllers/storeController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getAllStores);
router.post('/', auth, createStore);
router.put('/:id', auth, updateStore);
router.delete('/:id', auth, deleteStore);

module.exports = router;