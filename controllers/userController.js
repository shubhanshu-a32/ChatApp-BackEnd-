import User from '../models/User.js';
import redisClient from '../config/redis.js';

// In-memory fallback for online users when Redis is not available
const inMemoryOnlineUsers = new Set();

// Helper function to get online users (Redis or in-memory)
const getOnlineUsersFromStore = async () => {
    try {
        if (redisClient.isReady) {
            return await redisClient.sMembers('onlineUsers');
        } else {
            // Redis not available, use in-memory
            console.log('📋 Getting online users from in-memory store:', Array.from(inMemoryOnlineUsers));
            return Array.from(inMemoryOnlineUsers);
        }
    } catch (error) {
        console.error('Redis operation failed:', error.message);
        // Fallback to in-memory
        return Array.from(inMemoryOnlineUsers);
    }
};

//Get current User
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Failed to fetch user' });
    }
};

//Get online users from Redis
export const getOnlineUsers = async (req, res) => {
    try {
        const onlineUsers = await getOnlineUsersFromStore();
        
        // Get user details for each online user
        const users = await User.find(
            { _id: { $in: onlineUsers } },
            'name email avatar'
        );

        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching online users:', err);
        res.status(500).json({ message: 'Failed to fetch online users' });
    }
};

// Get all users
export const getAllUsers = async (req, res) => {
    try {
        console.log('getAllUsers called by user:', req.user?.id);
        // Include the current user in the user list
        const users = await User.find().select('-password');
        console.log('Users returned:', users.map(u => ({ id: u._id, name: u.name, email: u.email })));
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching all users:', err);
        res.status(500).json({ message: 'Failed to fetch all users' });
    }
};