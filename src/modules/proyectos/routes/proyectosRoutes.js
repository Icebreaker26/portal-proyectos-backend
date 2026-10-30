import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../../middlewares/auth.js';
import { checkPermission } from '../../../middlewares/checkPermission.js';
import * as ctrl from '../controllers/proyectosController.js';
import * as archivosCtrl from '../controllers/archivosController.js';

const router = Router();

const pubLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Pública: visitante consulta sin login, ANTES de verifyToken
router.get('/pub', pubLimiter, ctrl.listarPublico);
router.get('/pub/:id', pubLimiter, ctrl.obtenerPublico);

router.use(verifyToken);
router.get('/', checkPermission('proyectos', 'READ'), ctrl.listar);
router.post('/', checkPermission('proyectos', 'WRITE'), ctrl.crear);
router.put('/:id/estado', checkPermission('proyectos', 'APROBAR'), ctrl.actualizarEstado);
router.put('/:id/consentimiento', checkPermission('proyectos', 'WRITE'), ctrl.actualizarConsentimiento);
router.delete('/:id', checkPermission('proyectos', 'DELETE'), ctrl.eliminar);

// Archivos (ADR 0008) — binario exige sesión, ver archivosController.js.
router.post('/:id/archivos', checkPermission('proyectos', 'WRITE'), archivosCtrl.middlewareSubida, archivosCtrl.subir);
router.get('/:id/archivos', checkPermission('proyectos', 'READ'), archivosCtrl.listar);
router.get('/archivos/:archivoId/descargar', checkPermission('proyectos', 'READ'), archivosCtrl.descargar);

export default router;
