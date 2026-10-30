import { crearSchema } from '../schemas/votosSchema.js';
import * as service from '../services/votosService.js';

export const votar = async (req, res, next) => {
  try {
    const { proyecto_id } = crearSchema.parse(req.body);
    const voto = await service.votar(req.user.uuid, proyecto_id);
    res.status(201).json(voto);
  } catch (err) { next(err); }
};

export const retirarVoto = async (req, res, next) => {
  try {
    const eliminado = await service.retirarVoto(req.user.uuid, req.params.proyectoId);
    if (!eliminado) return res.status(404).json({ error: 'Voto no encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const contar = async (req, res, next) => {
  try { res.json({ total: await service.contarPorProyecto(req.params.proyectoId) }); }
  catch (err) { next(err); }
};
