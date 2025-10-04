const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE telegram_username = ? AND role_id = 1', [username]);

        if (users.length === 0) {
            return res.status(401).json({ msg: 'Username atau password salah' });
        }

        const user = users[0];

        // Jika password di DB belum di-hash, hash sekarang
        if (user.password.length < 60) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);
            await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
            user.password = hashedPassword;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ msg: 'Username atau password salah' });
        }
        
        const payload = {
            user: { id: user.id, name: user.full_name, role: 'Super Admin' }
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: payload.user });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};