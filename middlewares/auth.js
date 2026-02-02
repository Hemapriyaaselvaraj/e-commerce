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

const isNotLoginOrEmailChange = (req, res, next) => {
    // Allow access if user is not logged in (normal case)
    if (!req.session.user) {
        return next();
    }
    
    // Allow access if user is logged in but this is email-change flow
    // Check both query params (GET) and body (POST)
    const flow = req.query.flow || req.body.flow;
    if (flow === 'email-change' && req.session.role === 'user') {
        return next();
    }
    
    // Otherwise, redirect logged-in users
    if (req.session.role === 'admin') {
        return res.redirect('/admin/dashboard');
    } else {
        return res.redirect('/');
    }
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


module.exports = {isNotLogin, isNotLoginOrEmailChange, isCustomerAccessible, isAdminAccessible, validateObjectId}