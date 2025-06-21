import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import './config/passport.js';
import {createApiLimiter, apiLimiter} from './middleware/rateLimiter.js';
import {notFound, errorHandler} from './middleware/errorHandler.js';
import redisClient from './config/redis.js';

//Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';


dotenv.config();
const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
    // Allow cross-origin communication
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

//Middleware
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());

// Initialize rate limiter after Redis is connected
let redisApiLimiter = apiLimiter; // Default to in-memory limiter

const initializeRateLimiter = async () => {
    try {
        if (redisClient.isReady) {
            redisApiLimiter = createApiLimiter();
            console.log('✅ Redis rate limiter initialized');
        }
    } catch (error) {
        console.log('⚠️ Using in-memory rate limiter:', error.message);
    }
};

// Check Redis connection status and initialize rate limiter
redisClient.on('ready', initializeRateLimiter);

//Rate-Limiting
app.use('/api', (req, res, next) => {
    redisApiLimiter(req, res, next);
});

//Initialize Passport
app.use(passport.initialize());

//API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

//Error handler
app.use(notFound);
app.use(errorHandler);

export default app;