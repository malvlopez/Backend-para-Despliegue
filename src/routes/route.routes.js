import { Router } from 'express';
import { createRoute, getRoutes, deleteRoute, updateRoute } from '../controllers/routes.controller.js';
import { verifyToken, checkRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', verifyToken, checkRoles(['ADMIN']), createRoute);
router.get('/', verifyToken, checkRoles(['ADMIN', 'STUDENT']), getRoutes);
router.put('/:id', verifyToken, checkRoles(['ADMIN']), updateRoute);
router.delete('/:id', verifyToken, checkRoles(['ADMIN']), deleteRoute);

export default router;