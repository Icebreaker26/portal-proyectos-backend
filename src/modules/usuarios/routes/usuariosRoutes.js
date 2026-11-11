import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../../middlewares/auth.js';
import { checkPermission } from '../../../middlewares/checkPermission.js';
import * as ctrl from '../controllers/usuariosController.js';

const router = Router();

// Issue #12 — búsqueda por email exacto: además de exigir el email completo (buscarSchema), se
// limita la tasa de intentos por IP para dificultar un barrido de enumeración.
const buscarLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

router.use(verifyToken);
router.get('/', checkPermission('usuarios', 'READ'), ctrl.listar);
router.get('/profesores', checkPermission('usuarios', 'BUSCAR'), ctrl.listarProfesores);
router.get('/buscar', buscarLimiter, checkPermission('usuarios', 'BUSCAR'), ctrl.buscarPorEmail);
router.put('/:id/rol', checkPermission('usuarios', 'WRITE'), ctrl.actualizarRol);

export default router;
