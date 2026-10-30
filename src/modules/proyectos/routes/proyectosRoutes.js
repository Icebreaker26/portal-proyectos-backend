import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../../middlewares/auth.js';
import { checkPermission } from '../../../middlewares/checkPermission.js';
import * as ctrl from '../controllers/proyectosController.js';

const router = Router();

const pubLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Pública: visitante consulta sin login, ANTES de verifyToken
router.get('/pub', pubLimiter, ctrl.listarPublico);
router.get('/pub/:id', pubLimiter, ctrl.obtenerPublico);

router.use(verifyToken);
router.get('/', checkPermission('proyectos', 'READ'), ctrl.listar);
router.post('/', checkPermission('proyectos', 'WRITE'), ctrl.crear);
router.put('/:id/estado', checkPermission('proyectos', 'APROBAR'), ctrl.actualizarEstado);
router.delete('/:id', checkPermission('proyectos', 'DELETE'), ctrl.eliminar);

export default router;
