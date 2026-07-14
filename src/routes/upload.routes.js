import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller.js';
import { verifyToken, checkRoles } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

router.post('/', verifyToken, checkRoles(['ADMIN']), upload.single('file'), uploadFile);

export default router;