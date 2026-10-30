import { crearSchema, actualizarEstadoSchema } from '../schemas/proyectosSchema.js';
import * as service from '../services/proyectosService.js';

export const listar = async (req, res, next) => {
  try { res.json(await service.listar(req.user, req.query)); }
  catch (err) { next(err); }
};

export const listarPublico = async (req, res, next) => {
  try { res.json(await service.listarPublicos()); }
  catch (err) { next(err); }
};

export const crear = async (req, res, next) => {
  try {
    const datos = crearSchema.parse(req.body);
    const proyecto = await service.crear(req.user.uuid, datos);
    res.status(201).json(proyecto);
  } catch (err) { next(err); }
};

export const actualizarEstado = async (req, res, next) => {
  try {
    const { estado } = actualizarEstadoSchema.parse(req.body);
    const proyecto = await service.actualizarEstado(req.params.id, estado);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) { next(err); }
};

export const eliminar = async (req, res, next) => {
  try {
    const eliminado = await service.eliminar(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
