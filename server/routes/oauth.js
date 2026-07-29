const router = require('express').Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL || 'http://localhost:3000'}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      if (!email) return done(new Error('No email from Google'));
      let user = await User.findOne({ where: { email } });
      if (!user) {
        user = await User.create({ name: profile.displayName || email.split('@')[0], email, password: '', role: 'customer', isVerified: true });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }), (req, res) => {
    const user = req.user;
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}/?token=${token}`);
  });
} else {
  router.get('/google', (req, res) => res.status(501).json({ error: 'Google OAuth not configured on server' }));
  router.get('/google/callback', (req, res) => res.status(501).json({ error: 'Google OAuth not configured on server' }));
}

module.exports = router;
