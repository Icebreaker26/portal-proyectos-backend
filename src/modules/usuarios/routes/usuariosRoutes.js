import { Router } from 'express';
import { verifyToken } from '../../../middlewares/auth.js';
import { checkPermission } from '../../../middlewares/checkPermission.js';
import * as ctrl from '../controllers/usuariosController.js';

const router = Router();

router.use(verifyToken);
router.get('/', checkPermission('usuarios', 'READ'), ctrl.listar);
router.put('/:id/rol', checkPermission('usuarios', 'WRITE'), ctrl.actualizarRol);

export default router;
