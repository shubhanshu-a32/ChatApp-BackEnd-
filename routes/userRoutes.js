import express from 'express';
import { getMe, getOnlineUsers, getAllUsers } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getAllUsers);
router.get('/me', protect, getMe);
router.get('/online', protect, getOnlineUsers);

export default router;