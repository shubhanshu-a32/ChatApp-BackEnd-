import {Server} from 'socket.io';
import redisClient from '../config/redis.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io;

const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        return user;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
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
        console.log(`🔌New client connected: ${socket.id}`);

        const userId = socket.user._id;

        try {
            // Add user to online users set
            await redisClient.sAdd('onlineUsers', userId);
            
            // Update user's online status in database
            await User.findByIdAndUpdate(userId, { isOnline: true });
            
            // Notify others that user is online
            socket.broadcast.emit('user-online', socket.user);
            
            // Send current online users to the new user
            const onlineUserIds = await redisClient.sMembers('onlineUsers');
            const onlineUsers = await User.find({_id: {$in: onlineUserIds}}, 'name email avatar');
            socket.emit('online-users', onlineUsers);
        } catch (error) {
            console.error('Error handling user connection:', error);
        }

        // Listen for a request to get the initial online users
        socket.on('get-online-users', async () => {
            try {
                const onlineUserIds = await redisClient.sMembers('onlineUsers');
                const onlineUsers = await User.find({ _id: { $in: onlineUserIds } }, 'name _id');
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
            console.log(`❌ Client disconnected: ${socket.id}`);

            try {
                // Remove user from online users set
                await redisClient.sRem('onlineUsers', userId);
                
                // Update user's online status in database
                await User.findByIdAndUpdate(userId, { isOnline: false });
                
                // Notify others that user is offline
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