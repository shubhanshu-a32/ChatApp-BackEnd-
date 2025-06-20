import express from 'express';
import passport from 'passport';

import{
    register,
    login,
    googleSuccess,
    verifyGoogleToken
} from '../controllers/authController.js';

const router = express.Router();

//Register and login
router.post('/register', register);
router.post('/login', login);

//Google OAuth
router.post('/google', verifyGoogleToken);

//Google OAuth Callback (for traditional OAuth flow)
router.get('/google', passport.authenticate('google', {scope: ['profile', 'email']}));
router.get(
    '/google/callback',
    passport.authenticate('google', {failureRedirect: '/login'}),
    googleSuccess
);

export default router;