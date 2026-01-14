const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userModel = require('../models/userModel');
require('dotenv').config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URI, 
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      let user = await userModel.findOne({ googleId: profile.id });

      if (user) {
        if (user.isBlocked) {
            return done(null, false, { message: 'Your account has been blocked.' });
        }
        return done(null, user);
      }
      
      const email = profile.emails[0].value;
      user = await userModel.findOne({ email });

      if (user) {
        if (user.isBlocked) {
          return done(null, false, { message: 'Your account has been blocked.' });
        }
        if (user.signupMethod !== 'google') {
          return done(null, false, { message: `You have previously signed up with ${user.signupMethod}. Please log in using that method.` });
        }
    
        user.googleId = profile.id;
        await user.save();
        return done(null, user);
      }

      const newUser = new userModel({
        googleId: profile.id, 
        firstName: profile.name.givenName || '',
        lastName: profile.name.familyName || '',
        email,
        password: null, 
        phoneNumber: '0000000000',
        role: 'user',
        isActive: true,
        isBlocked: false,
        isVerified: true, 
        signupMethod: 'google'
      });
      
      await newUser.save();
      return done(null, newUser);

    } catch (err) {
      console.error('Error in Google Strategy:', err);
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
