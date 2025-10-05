const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

const { getAllStores, createStore, updateStore, deleteStore } = require('../controllers/storeController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');

// Middleware untuk menangani error validasi
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// GET /api/stores
router.get('/', auth, getAllStores);

// POST /api/stores
router.post('/',
    [auth, admin],
    [
        body('name', 'Nama toko tidak boleh kosong').not().isEmpty().trim().escape(),
        body('address').optional().trim().escape(),
        body('phone').optional({ checkFalsy: true }).trim().escape() // checkFalsy mengizinkan string kosong
    ],
    handleValidationErrors,
    createStore
);

// PUT /api/stores/:id
router.put('/:id',
    [auth, admin],
    [
        param('id').isInt({ min: 1 }).withMessage('ID Toko harus valid'),
        body('name', 'Nama toko tidak boleh kosong').not().isEmpty().trim().escape(),
        body('address').optional().trim().escape(),
        // PERBAIKAN: Menghapus isMobilePhone yang terlalu ketat dan mengizinkan field kosong
        body('phone', 'Nomor telepon tidak valid').optional({ checkFalsy: true }).trim().escape(),
        body('status').optional().isIn(['active', 'inactive']).withMessage("Status harus 'active' atau 'inactive'"),
        body('region_id', 'Regional harus dipilih').not().isEmpty()
    ],
    handleValidationErrors,
    updateStore
);

// DELETE /api/stores/:id
router.delete('/:id',
    [auth, admin],
    [
        param('id').isInt({ min: 1 }).withMessage('ID Toko harus valid')
    ],
    handleValidationErrors,
    deleteStore
);

module.exports = router;
