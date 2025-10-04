// admin-dashboard-backend/src/controllers/dashboardController.js
const pool = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        // Query yang sudah ada
        const [salesToday] = await pool.execute('SELECT SUM(total_amount) as total FROM transactions WHERE DATE(transaction_date) = ?', [today]);
        const [transactionsToday] = await pool.execute('SELECT COUNT(id) as total FROM transactions WHERE DATE(transaction_date) = ?', [today]);
        const [pendingUsers] = await pool.execute("SELECT COUNT(id) as total FROM users WHERE status = 'pending'");
        const [activeUsers] = await pool.execute("SELECT COUNT(id) as total FROM users WHERE status = 'active'");
        const [salesChart] = await pool.execute(`
            SELECT DATE(transaction_date) as date, SUM(total_amount) as total 
            FROM transactions 
            WHERE transaction_date >= CURDATE() - INTERVAL 7 DAY
            GROUP BY DATE(transaction_date)
            ORDER BY date ASC
        `);
        const [recentTransactions] = await pool.execute(`
            SELECT t.invoice_number, t.cashier_name, t.total_amount, s.name as store_name
            FROM transactions t
            LEFT JOIN stores s ON t.store_id = s.id
            ORDER BY t.transaction_date DESC
            LIMIT 5
        `);
        
        // --- QUERY BARU ---
        // 1. Menghitung total toko yang aktif
        const [activeStores] = await pool.execute("SELECT COUNT(id) as total FROM stores WHERE status = 'active'");
        
        // 2. Mencari toko dengan penjualan tertinggi hari ini
         const [topStoresToday] = await pool.execute(`
            SELECT s.name, SUM(t.total_amount) as totalSales
            FROM transactions t
            JOIN stores s ON t.store_id = s.id
            WHERE DATE(t.transaction_date) = ?
            GROUP BY t.store_id, s.name
            ORDER BY totalSales DESC
            LIMIT 3 
        `, [today]);
        // --- SELESAI QUERY BARU ---

        res.json({
            stats: {
                salesToday: salesToday[0].total || 0,
                transactionsToday: transactionsToday[0].total || 0,
                pendingUsers: pendingUsers[0].total || 0,
                activeUsers: activeUsers[0].total || 0,
                activeStores: activeStores[0].total || 0, // Data baru
            },
            topStores: topStoresToday,
            salesChart,
            recentTransactions
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};