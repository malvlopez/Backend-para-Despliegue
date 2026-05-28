import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller.js'; 
import { getProfile } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', authCtrl.register);        
router.get('/verify/:token', authCtrl.verifyAccount);
router.post('/login', authCtrl.login);     
router.post('/forgot-password', authCtrl.forgotPassword); 
router.post('/reset-password/:token', authCtrl.resetPassword);
router.get('/profile', verifyToken, getProfile);

export default router;