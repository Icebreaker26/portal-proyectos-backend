import { actualizarRolSchema, buscarSchema } from '../schemas/usuariosSchema.js';
import * as service from '../services/usuariosService.js';

export const listar = async (req, res, next) => {
  try { res.json(await service.listar()); }
  catch (err) { next(err); }
};

export const listarProfesores = async (req, res, next) => {
  try { res.json(await service.listarProfesores()); }
  catch (err) { next(err); }
};

export const buscarPorEmail = async (req, res, next) => {
  try {
    const { email } = buscarSchema.parse(req.query);
    const usuario = await service.buscarPorEmail(email);
    if (!usuario) return res.status(404).json({ error: 'No se encontró una cuenta con ese email' });
    res.json(usuario);
  } catch (err) { next(err); }
};

export const actualizarRol = async (req, res, next) => {
  try {
    const { rol } = actualizarRolSchema.parse(req.body);
    const usuario = await service.actualizarRol(req.params.id, rol);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) { next(err); }
};
