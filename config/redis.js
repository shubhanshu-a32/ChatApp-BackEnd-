import {createClient} from 'redis';
import ioredis from 'ioredis';

const redisClient = new ioredis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    tls: {},
});

redisClient.on('error', (err) => {
    console.error('Redis error', err);
});

redisClient.connect().then(() => {
    console.log('Connected to Redis');
});

export default redisClient;