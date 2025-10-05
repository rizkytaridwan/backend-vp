// routes/userRoutes.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const { getAllUsers, updateUser, getRoles, getStores, getAllRegions } = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');


const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.get('/', auth, getAllUsers );

router.put('/:id', 
    [auth, admin],
    [
        param('id').isInt({ min: 1 }).withMessage('ID User harus berupa angka positif'),
        body('role_id').isInt({ min: 1 }).withMessage('Role ID harus valid'),
        body('store_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Store ID harus valid'),
        body('region_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Region ID harus valid'),
        body('status').isIn(['active', 'pending', 'inactive']).withMessage("Status tidak valid")
    ],
    handleValidationErrors,
    updateUser
);

router.get('/roles', auth, getRoles);
router.get('/stores', auth, getStores);
router.get('/regions', auth, getAllRegions); // Rute baru untuk mengambil data regional

module.exports = router;