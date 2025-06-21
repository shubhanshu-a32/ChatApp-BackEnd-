import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis.js';

// Factory function to create rate limiter after Redis is connected
export const createApiLimiter = () => {
    return rateLimit({
        store: new RedisStore({
            sendCommand: (...args) => redisClient.sendCommand(args),
        }),
        windowMs: 15 * 60 * 1000, //15 mins
        max: 100, //Limit to 100 per user and API
        message: 'Too many requests please try again later',
    });
};

// Create a simple in-memory limiter as fallback
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, //15 mins
    max: 100, //Limit to 100 per user and API
    message: 'Too many requests please try again later',
});