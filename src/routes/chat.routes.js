import { Router } from 'express';
import { processChatMessage } from '../controllers/chat.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/send', verifyToken, processChatMessage);

export default router;