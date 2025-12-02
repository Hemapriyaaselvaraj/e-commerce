const isNotLogin = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        req.flash('error', null);
        next();
    }
}


const isCustomerAccessible = (req, res, next) => {
    if (req.session.user) {
        if (req.session.role === 'user') {
            next();
        } else {
            res.redirect('/admin/dashboard');
        }

    } else {
        next();
    }
}

const isAdminAccessible = (req, res, next) => {
    if (req.session.user && req.session.role === 'admin') {
        next();
    } else {
        res.redirect('/');
    }
}

module.exports = {isNotLogin, isCustomerAccessible, isAdminAccessible}