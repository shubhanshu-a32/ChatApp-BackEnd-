import {Server} from 'socket.io';
import redisClient from '../config/redis.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io;

// In-memory fallback for online users when Redis is not available
const inMemoryOnlineUsers = new Set();

const verifyToken = async (token) => {
    try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-jwt-secret-for-development';
        const decoded = jwt.verify(token, jwtSecret);
        const user = await User.findById(decoded.id).select('-password');
        return user;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
};

// Helper function to safely execute Redis operations with fallback
const safeRedisOperation = async (operation) => {
    try {
        console.log('🔴 Redis client ready status:', redisClient.isReady);
        if (redisClient.isReady) {
            const result = await operation();
            console.log('🔴 Redis operation successful:', result);
            return result;
        } else {
            console.log('🔴 Redis client not ready, using in-memory fallback');
            return null;
        }
    } catch (error) {
        console.error('🔴 Redis operation failed:', error.message);
        return null;
    }
};

// Helper function to add user to online users (Redis or in-memory)
const addUserToOnline = async (userId) => {
    userId = String(userId);
    const redisResult = await safeRedisOperation(() => redisClient.sAdd('onlineUsers', userId));
    if (redisResult === null) {
        // Redis not available, use in-memory
        inMemoryOnlineUsers.add(userId);
        console.log('📝 Added user to in-memory online users:', userId);
        return true;
    }
    return redisResult;
};

// Helper function to remove user from online users (Redis or in-memory)
const removeUserFromOnline = async (userId) => {
    userId = String(userId);
    const redisResult = await safeRedisOperation(() => redisClient.sRem('onlineUsers', userId));
    if (redisResult === null) {
        // Redis not available, use in-memory
        inMemoryOnlineUsers.delete(userId);
        console.log('🗑️ Removed user from in-memory online users:', userId);
        return true;
    }
    return redisResult;
};

// Helper function to get online users (Redis or in-memory)
const getOnlineUsersFromStore = async () => {
    const redisResult = await safeRedisOperation(() => redisClient.sMembers('onlineUsers'));
    if (redisResult === null) {
        // Redis not available, use in-memory
        console.log('📋 Getting online users from in-memory store:', Array.from(inMemoryOnlineUsers));
        return Array.from(inMemoryOnlineUsers).map(String);
    }
    return redisResult.map(String);
};

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            credentials: true,
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        },
        allowEIO3: true,
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        cookie: {
            name: 'io',
            path: '/',
            httpOnly: true,
            sameSite: 'lax'
        },
        path: '/socket.io',
        serveClient: false,
        connectTimeout: 45000,
    });

    // Connection middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                console.log('No token provided');
                return next(new Error('Authentication error: No token provided'));
            }

            // Verify token and get user
            const user = await verifyToken(token);
            if (!user) {
                console.log('Invalid token');
                return next(new Error('Authentication error: Invalid token'));
            }

            socket.user = user;
            next();
        } catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication error: ' + error.message));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`🔌New client connected: ${socket.id}, User: ${socket.user.name} (${socket.user._id})`);

        const userId = socket.user._id;

        try {
            // Add user to online users set (Redis)
            console.log(`📝 Adding user ${userId} to online users in Redis`);
            await addUserToOnline(userId);
            
            // Update user's online status in database
            console.log(`📝 Updating user ${userId} online status in database`);
            await User.findByIdAndUpdate(userId, { isOnline: true });
            
            // Notify others that user is online
            console.log(`📢 Broadcasting user-online event for user ${userId}`);
            socket.broadcast.emit('user-online', socket.user);
            
            // Send current online users to the new user
            console.log(`📋 Fetching current online users for user ${userId}`);
            const onlineUserIds = await getOnlineUsersFromStore();
            console.log(`📋 Online user IDs from Redis:`, onlineUserIds);
            let onlineUsers = await User.find({_id: {$in: onlineUserIds}}, 'name email avatar _id');
            // Ensure all _id fields are strings
            onlineUsers = onlineUsers.map(u => ({ ...u.toObject(), _id: String(u._id) }));
            console.log('SOCKET: Emitting online-users:', JSON.stringify(onlineUsers, null, 2));
            socket.emit('online-users', onlineUsers);
        } catch (error) {
            console.error('Error handling user connection:', error);
        }

        // Listen for a request to get the initial online users
        socket.on('get-online-users', async () => {
            console.log(`📡 User ${userId} requested online users`);
            try {
                const onlineUserIds = await getOnlineUsersFromStore();
                console.log(`📡 Online user IDs from Redis for request:`, onlineUserIds);
                let onlineUsers = await User.find({ _id: { $in: onlineUserIds } }, 'name _id');
                // Ensure all _id fields are strings
                onlineUsers = onlineUsers.map(u => ({ ...u.toObject(), _id: String(u._id) }));
                console.log('SOCKET: Emitting online-users:', JSON.stringify(onlineUsers, null, 2));
                socket.emit('online-users', onlineUsers);
            } catch (error) {
                console.error('Error fetching online users on request:', error);
            }
        });

        //Join room for public or private key
        socket.on('joinRoom', (roomId) => {
            socket.join(roomId);
            console.log(`User ${userId} joined room: ${roomId}`);
        });

        //Handle sending message
        socket.on('send_message', async (messageData) => {
            const {content, roomId} = messageData;
            
            if (!roomId) {
                console.error('No roomId provided in message');
                return;
            }

            const message = {
                ...messageData,
                createdAt: new Date(),
                userId: socket.user._id,
                user: socket.user.name
            };

            io.to(roomId).emit('receive_message', message);
            console.log(`Message sent to room ${roomId}:`, message);
        });

        //Handle disconnect
        socket.on('disconnect', async () => {
            console.log(`❌ Client disconnected: ${socket.id}, User: ${socket.user.name} (${socket.user._id})`);

            try {
                // Remove user from online users set (Redis)
                console.log(`🗑️ Removing user ${userId} from online users in Redis`);
                await removeUserFromOnline(userId);
                
                // Update user's online status in database
                console.log(`🗑️ Updating user ${userId} offline status in database`);
                await User.findByIdAndUpdate(userId, { isOnline: false });
                
                // Notify others that user is offline
                console.log(`📢 Broadcasting user-offline event for user ${userId}`);
                socket.broadcast.emit('user-offline', { userId });
            } catch (error) {
                console.error('Error handling user disconnection:', error);
            }
        });
    });
};

export const getIo = () => {
    if(!io) throw new Error('Socket.io not initialized');
    return io;
};