import { createClient } from 'redis';

// Parse Redis URL if provided, otherwise use individual config
let redisClient;

if (process.env.REDIS_URL) {
    redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            connectTimeout: 10000,
            lazyConnect: true,
            tls: true, // Enable TLS for Upstash Redis
            rejectUnauthorized: false, // Allow self-signed certificates
        },
        retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with a individual error
                return new Error('The server refused the connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands with a individual error
                return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
                // End reconnecting with built in error
                return undefined;
            }
            // Reconnect after
            return Math.min(options.attempt * 100, 3000);
        },
    });
} else {
    // Fallback to individual configuration
    redisClient = createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            tls: process.env.REDIS_TLS === 'true' ? {} : false,
            connectTimeout: 10000,
            lazyConnect: true,
        },
        password: process.env.REDIS_PASSWORD,
    });
}

redisClient.on('error', (err) => {
    console.error('Redis error', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

redisClient.on('ready', () => {
    console.log('Redis client ready');
});

redisClient.on('end', () => {
    console.log('Redis connection ended');
});

redisClient.on('reconnecting', () => {
    console.log('Redis reconnecting...');
});

export default redisClient;