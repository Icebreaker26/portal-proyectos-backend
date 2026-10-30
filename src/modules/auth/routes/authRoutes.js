import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../../middlewares/auth.js';
import * as ctrl from '../controllers/authController.js';

const router = Router();

// Rate limit propio en login/registro: son los endpoints públicos más sensibles del módulo.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/registro', authLimiter, ctrl.registro);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', verifyToken, ctrl.logout);
router.get('/me', verifyToken, ctrl.me);

export default router;
