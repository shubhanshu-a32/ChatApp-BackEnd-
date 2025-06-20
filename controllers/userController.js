import User from '../models/User.js';
import redisClient from '../config/redis.js';

//Get current User
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Failed to fetch user' });
    }
};

//Get online users from Redis
export const getOnlineUsers = async (req, res) => {
    try {
        const onlineUsers = await redisClient.sMembers('onlineUsers');
        
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
        const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
        console.log('Users returned:', users.map(u => ({ id: u._id, name: u.name, email: u.email })));
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching all users:', err);
        res.status(500).json({ message: 'Failed to fetch all users' });
    }
};