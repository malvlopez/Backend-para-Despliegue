import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller.js'; 
import { verifyToken, checkRoles } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', authCtrl.register);        
router.get('/verify/:token', authCtrl.verifyAccount);
router.post('/login', authCtrl.login);     
router.post('/forgot-password', authCtrl.forgotPassword); 
router.patch('/reset-password/:token', authCtrl.resetPassword); 

router.get('/profile', verifyToken, authCtrl.getProfile);
router.get('/verify-cedula/:cedula', authCtrl.checkCedula);

router.get('/admin/users', verifyToken, checkRoles(['ADMIN']), (req, res) => {
  res.json({ message: "Bienvenido, Administrador. Aquí están los usuarios." });
});

router.post('/learning-paths', verifyToken, checkRoles(['ADMIN', 'TEACHER']), (req, res) => {
  res.json({ message: "Ruta de aprendizaje creada con éxito." });
});

export default router;