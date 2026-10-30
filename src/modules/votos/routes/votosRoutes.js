import { Router } from 'express';
import { verifyToken } from '../../../middlewares/auth.js';
import { checkPermission } from '../../../middlewares/checkPermission.js';
import * as ctrl from '../controllers/votosController.js';

const router = Router();

router.get('/pub/:proyectoId/conteo', ctrl.contar);

router.use(verifyToken);
router.post('/', checkPermission('votos', 'WRITE'), ctrl.votar);
router.delete('/:proyectoId', checkPermission('votos', 'DELETE'), ctrl.retirarVoto);

export default router;
