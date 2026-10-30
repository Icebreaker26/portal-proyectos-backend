import { Router } from 'express';
import { verifyToken } from '../../../middlewares/auth.js';
import * as ctrl from '../controllers/authController.js';

const router = Router();

router.post('/login', ctrl.login);
router.post('/logout', verifyToken, ctrl.logout);
router.get('/me', verifyToken, ctrl.me);

export default router;
