// admin-dashboard-backend/src/routes/storeRoutes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getAllStores, createStore, updateStore, deleteStore } = require('../controllers/storeController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getAllStores);
router.post('/',
    auth,
    [ // Aturan validasi dan sanitasi
        body('name', 'Nama toko tidak boleh kosong').not().isEmpty().trim().escape(),
        body('address', 'Alamat tidak valid').optional().trim().escape(),
        body('phone', 'Nomor telepon tidak valid').optional().trim().escape()
    ],
    // Tambahkan middleware untuk menangani hasil validasi
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
    createStore
);
router.put('/:id', auth, updateStore);
router.delete('/:id', auth, deleteStore);

module.exports = router;