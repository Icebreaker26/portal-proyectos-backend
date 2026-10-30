import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', detalles: err.format() });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'El registro ya existe' });
  }

  if (err.code === '23503') {
    return res.status(409).json({ error: 'Referencia inválida' });
  }

  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  res.status(err.status || 500).json({ error: err.publicMessage || 'Error interno del servidor' });
};
