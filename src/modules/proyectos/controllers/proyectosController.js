import { crearSchema, actualizarEstadoSchema, consentimientoSchema, idParamSchema } from '../schemas/proyectosSchema.js';
import * as service from '../services/proyectosService.js';

export const listar = async (req, res, next) => {
  try { res.json(await service.listar(req.user, req.query)); }
  catch (err) { next(err); }
};

export const listarPublico = async (req, res, next) => {
  try { res.json(await service.listarPublicos()); }
  catch (err) { next(err); }
};

export const obtenerPublico = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const proyecto = await service.obtenerPublico(id);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) { next(err); }
};

export const obtener = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const proyecto = await service.obtener(id, req.user);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) { next(err); }
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
    const { id } = idParamSchema.parse(req.params);
    const { estado, comentario } = actualizarEstadoSchema.parse(req.body);
    const proyecto = await service.actualizarEstado(id, estado, req.user.uuid, comentario);
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json(proyecto);
  } catch (err) { next(err); }
};

export const actualizarConsentimiento = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { consiente } = consentimientoSchema.parse(req.body);
    const actualizado = await service.actualizarConsentimiento(id, req.user.uuid, consiente);
    if (!actualizado) return res.status(404).json({ error: 'No estás listado como participante de este proyecto' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const eliminar = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const eliminado = await service.eliminar(id);
    if (!eliminado) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
