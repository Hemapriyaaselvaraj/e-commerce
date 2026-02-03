const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport')
const flash = require("connect-flash");

require('./config/passport')
require('dotenv').config();

const app = express();
const attachUserName = require('./middlewares/userName.middleware')


const userRoutes = require("./routes/user")
const adminRoutes = require('./routes/admin')
const homeRoutes = require('./routes/customer/home')
const productRoutes = require('./routes/customer/product')
const wishlistRoutes = require('./routes/customer/wishlist')
const cartRoutes = require('./routes/customer/cart')
const checkoutRoutes = require('./routes/customer/checkout');
const addressRoutes = require('./routes/customer/address');
const profileRoutes = require('./routes/customer/profile');
const orderRoutes = require('./routes/customer/order');
const walletRoutes = require('./routes/customer/wallet')
 
connectDB();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ 
  extended: true,
  limit: '50mb',
  parameterLimit: 50000
}));
app.use(express.json({ limit: '50mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { httpOnly: true,                     
    secure: false,                      
    maxAge: 1000 * 60 * 60 * 24 
    }     
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(attachUserName);

// Add request logger to debug routing issues
app.use((req, res, next) => {
  console.log(`REQUEST: ${req.method} ${req.originalUrl}`);
  console.log('Request received at:', new Date().toISOString());
  next();
});

app.use('/user',userRoutes)
app.use('/admin',adminRoutes)
app.use('/products', productRoutes)
app.use('/wishlist', wishlistRoutes)
app.use('/cart', cartRoutes)
app.use('/checkout', checkoutRoutes);
app.use('/addresses', addressRoutes);
app.use('/profile',profileRoutes)
app.use('/order', orderRoutes);
app.use('/wallet', walletRoutes)
app.use('/',homeRoutes)

app.use((req, res) => {
  res.status(404).render("user/404");
});


const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

// Increase timeout for file uploads
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000;
server.headersTimeout = 300000;
