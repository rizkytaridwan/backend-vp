// controllers/userController.js
const pool = require('../config/db');

// Mengambil semua user dengan informasi role, toko, dan regional
exports.getAllUsers = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    const searchQuery = `%${search}%`;

    try {
        const sql = `SELECT 
                u.id, u.telegram_chat_id, u.telegram_username, u.full_name, u.status,
                r.name AS role_name,
                rg.name AS region_name,
                COALESCE(s_utama.name, s_aktif.name) AS store_name,
                u.role_id, u.store_id, u.region_id
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN regions rg ON u.region_id = rg.id
             LEFT JOIN stores s_utama ON u.store_id = s_utama.id
             LEFT JOIN stores s_aktif ON u.active_store_id = s_aktif.id
             WHERE (u.full_name LIKE ? OR u.telegram_username LIKE ?)
             ORDER BY u.created_at DESC`;

        // PERBAIKAN: Terapkan LIMIT dan OFFSET langsung ke string
        const finalSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;
        const queryParams = [searchQuery, searchQuery];

        const [users] = await pool.execute(finalSql, queryParams);

        const [[{ total }]] = await pool.execute(
            'SELECT COUNT(id) as total FROM users WHERE (full_name LIKE ? OR telegram_username LIKE ?)',
            [searchQuery, searchQuery]
        );

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (err) {
        console.error("!!! ERROR in getAllUsers:", err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
};
// Mengupdate user (role, store, region, status)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { role_id, store_id, region_id, status } = req.body;

    try {
        await pool.execute(
            'UPDATE users SET role_id = ?, store_id = ?, region_id = ?, status = ?, active_store_id = ? WHERE id = ?',
            [role_id, store_id || null, region_id || null, status, store_id || null, id]
        );
        res.json({ msg: 'User berhasil diupdate' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengambil semua roles
exports.getRoles = async (req, res) => {
    try {
        const [roles] = await pool.execute('SELECT * FROM roles ORDER BY name ASC');
        res.json(roles);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengambil semua stores
exports.getStores = async (req, res) => {
    try {
        const [stores] = await pool.execute("SELECT id, name FROM stores WHERE status = 'active' ORDER BY name ASC");
        res.json(stores);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Mengambil semua regions
exports.getAllRegions = async (req, res) => {
    try {
        const [regions] = await pool.execute('SELECT * FROM regions ORDER BY name ASC');
        res.json(regions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};