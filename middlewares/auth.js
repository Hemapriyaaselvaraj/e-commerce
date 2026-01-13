const mongoose = require('mongoose');

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

const validateObjectId = (req, res, next) => {
    const { id } = req.params;
    
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).render('admin/404');
    }
    
    next();
};


module.exports = {isNotLogin, isCustomerAccessible, isAdminAccessible, validateObjectId}