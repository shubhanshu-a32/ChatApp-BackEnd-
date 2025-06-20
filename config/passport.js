import passport from "passport";
import {Strategy as GoogleStrategy} from 'passport-google-oauth20';
import User from '../models/User.js';
import dotenv from 'dotenv'

dotenv.config();

console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try{
                let user = await User.findOne({googleId: profile.id});

                if(!user) {
                    user = await User.create({
                        googleId: profile.id,
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        avatar: profile.photos[0].value,
                    });
                }
                return done(null, user);
            } catch(error) {
                return done(error, false);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try{
        const user = await User.findById(id);
        done(null, user);
    } catch(error) {
        done(error, null);
    }
});