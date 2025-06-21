import mongoose, { mongo } from "mongoose";
import dotenv from 'dotenv';
import app from './app.js';
import {initSocket} from './sockets/socket.js';
import redisClient from "./config/redis.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

//Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('✅ MongoDB connected');
}).catch((err) => {
    console.log('❌ MongoDB connection error:', err.message);
});

//Connect to Redis with better error handling
const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            console.log('✅ Redis connected');
        }
    } catch (err) {
        console.log('❌ Redis connection error:', err.message);
        // Don't retry immediately to avoid spam
        console.log('⚠️ Continuing without Redis - some features may be limited');
    }
};

// Try to connect to Redis once
connectRedis();

//Create HTTP Server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

//Init WebSocket (Socket.IO)
initSocket(server);