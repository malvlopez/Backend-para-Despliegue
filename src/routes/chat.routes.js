import { Router } from 'express';
import { processChatMessage, generateModuleAssessment, sendMessage } from '../controllers/chat.controller.js';
import { verifyToken, checkRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/send', verifyToken, checkRoles(['STUDENT']), processChatMessage);
router.post('/assessment', verifyToken, checkRoles(['STUDENT']), generateModuleAssessment);
router.post('/live-message', verifyToken, sendMessage);

export default router;