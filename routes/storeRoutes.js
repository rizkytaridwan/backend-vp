// admin-dashboard-backend/src/routes/storeRoutes.js

const express = require('express');
const router = express.Router();
// Ditambahkan 'param' untuk validasi ID di URL
const { body, param, validationResult } = require('express-validator'); 

const { getAllStores, createStore, updateStore, deleteStore } = require('../controllers/storeController');
const auth = require('../middleware/authMiddleware');
// Middleware 'admin' perlu di-import untuk digunakan
const admin = require('../middleware/adminMiddleware'); 

// Middleware ini sudah bagus, kita akan pakai di semua route yang butuh validasi
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.get('/', auth, getAllStores);

router.post('/',
    [ // Kelompokkan middleware dalam satu array agar lebih rapi
        auth,
        admin // Menambahkan admin check untuk membuat toko
    ],
    [ // Aturan validasi
        body('name', 'Nama toko tidak boleh kosong').not().isEmpty().trim().escape(),
        body('address', 'Alamat tidak valid').optional().trim().escape(),
        body('phone', 'Nomor telepon tidak valid').optional().trim().escape()
    ],
    handleValidationErrors, // Gunakan middleware yang sudah dibuat, hindari duplikasi
    createStore
);

router.put('/:id',
    [auth, admin], // Ini sudah benar
    [
        param('id').isInt({ min: 1 }).withMessage('ID Toko harus valid'),
        body('name', 'Nama toko tidak boleh kosong').optional().not().isEmpty().trim().escape(),
        body('address', 'Alamat tidak valid').optional().trim().escape(),
        body('phone', 'Nomor telepon tidak valid').optional().isMobilePhone('id-ID').withMessage('Format nomor telepon salah'),
        body('status').optional().isIn(['active', 'inactive']).withMessage("Status harus 'active' atau 'inactive'")
    ],
    handleValidationErrors,
    updateStore
);

router.delete('/:id',
    [auth, admin], // Sebaiknya hanya admin yang bisa menghapus
    [ // Tambahkan validasi untuk ID saat menghapus
        param('id').isInt({ min: 1 }).withMessage('ID Toko harus valid')
    ],
    handleValidationErrors,
    deleteStore
);

module.exports = router;