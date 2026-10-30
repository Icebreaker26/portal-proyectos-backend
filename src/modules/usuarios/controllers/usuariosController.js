import { actualizarRolSchema } from '../schemas/usuariosSchema.js';
import * as service from '../services/usuariosService.js';

export const listar = async (req, res, next) => {
  try { res.json(await service.listar()); }
  catch (err) { next(err); }
};

export const actualizarRol = async (req, res, next) => {
  try {
    const { rol } = actualizarRolSchema.parse(req.body);
    const usuario = await service.actualizarRol(req.params.id, rol);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) { next(err); }
};
