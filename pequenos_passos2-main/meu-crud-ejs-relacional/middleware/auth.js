
function verificarLogin(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }

    res.redirect('/login');
}

export default verificarLogin;
