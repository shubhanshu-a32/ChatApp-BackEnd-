import express from 'express';
import {sendMessage, fetchMessages} from '../controllers/chatController.js';
import {protect} from '../middleware/authMiddleware.js';

const router = express.Router();

//All chat routes require routes
router.post('/send', protect, sendMessage);
router.get('/fetch', protect, fetchMessages);

export default router;