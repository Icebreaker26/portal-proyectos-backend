import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload; // { uuid, rol, email }
    next();
  } catch {
    return res.status(401).json({ error: 'No autorizado' });
  }
};
