import {createClient} from 'redis';

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
});

redisClient.on('error', (err) => {
    console.error('Redis error', err);
});

redisClient.connect().then(() => {
    console.log('Connected to Redis');
});

export default redisClient;