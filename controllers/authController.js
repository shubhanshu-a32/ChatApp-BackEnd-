import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {OAuth2Client} from 'google-auth-library';
import User from '../models/User.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//Generate JWT token
const generateToken = (user) => {
    return jwt.sign({id: user._id}, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

//Register
export const register = async (req, res) => {
    const {name, email, password} = req.body;

    // Input validation
    if (!name || !email || !password) {
        return res.status(400).json({message: 'All fields are required'});
    }

    if (password.length < 6) {
        return res.status(400).json({message: 'Password must be at least 6 characters long'});
    }

    if (name.length < 2) {
        return res.status(400).json({message: 'Name must be at least 2 characters long'});
    }

    try {
        // Check if user already exists
        const exists = await User.findOne({email});
        if(exists) {
            return res.status(400).json({message: 'User already exists with this email'});
        }

        // Hash password
        const hashed = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashed,
        });

        // Generate token
        const token = generateToken(user);

        // Send response without password
        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isOnline: user.isOnline,
        };

        res.status(201).json({
            user: userResponse,
            token
        });
    } catch(error) {
        console.error('Registration error:', error);
        res.status(500).json({message: 'Registration failed. Please try again.'});
    }
};

//Login
export const login = async (req, res) => {
    const {email, password} = req.body;

    // Input validation
    if (!email || !password) {
        return res.status(400).json({message: 'Email and password are required'});
    }

    try {
        const user = await User.findOne({email});
        if(!user) {
            return res.status(400).json({message: 'Invalid credentials'});
        }

        const match = await bcrypt.compare(password, user.password);
        if(!match) {
            return res.status(400).json({message: 'Invalid credentials'});
        }

        const token = generateToken(user);

        // Send response without password
        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isOnline: user.isOnline,
        };

        res.status(200).json({
            user: userResponse,
            token
        });
    } catch(error) {
        console.error('Login error:', error);
        res.status(500).json({message: 'Login failed. Please try again.'});
    }
};

//Google OAuth success handler
export const googleSuccess = (req, res) => {
    if(!req.user) {
        return res.redirect(`${process.env.CLIENT_URL}/login`);
    }

    const token = generateToken(req.user);
    res.redirect(`${process.env.CLIENT_URL}/oauth-success?token=${token}`);
};

//Google OAuth token verification
export const verifyGoogleToken = async (req, res) => {
    const {credential} = req.body;

    if (!credential) {
        return res.status(400).json({message: 'No credential provided'});
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const {email, name, picture} = payload;

        // Check if user exists
        let user = await User.findOne({email});

        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                name,
                email,
                avatar: picture,
                password: Math.random().toString(36).slice(-8), // Random password for Google users
            });
        }

        // Update user's avatar if it's changed
        if (user.avatar !== picture) {
            user.avatar = picture;
            await user.save();
        }

        const token = generateToken(user);

        // Send response without password
        const userResponse = {
            _id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            isOnline: user.isOnline,
        };

        res.status(200).json({
            user: userResponse,
            token
        });
    } catch (error) {
        console.error('Google verification error:', error);
        res.status(500).json({message: 'Google authentication failed'});
    }
};