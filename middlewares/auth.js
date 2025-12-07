const isNotLogin = (req, res, next) => {
    if (req.session.user) {
        if (req.session.role === 'admin') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/');
        }
    }
    next(); 
};


const isCustomerAccessible = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/user/login'); 
    }

    if (req.session.role === 'user') {
        return next(); 
    }

    return res.redirect('/admin/dashboard'); 
};


const isAdminAccessible = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/user/login');
    }

    if (req.session.role === 'admin') {
        return next(); 
    }
    return res.redirect('/');
};



module.exports = {isNotLogin, isCustomerAccessible, isAdminAccessible}