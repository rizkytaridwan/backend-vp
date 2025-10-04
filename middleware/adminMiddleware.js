// middleware/adminMiddleware.js
module.exports = function (req, res, next) {
    // role_id = 1 adalah Super Admin (sesuai authController)
    if (req.user && req.user.role_id === 1) {
        next();
    } else {
        res.status(403).json({ msg: 'Akses terlarang. Hanya untuk Admin.' });
    }
};