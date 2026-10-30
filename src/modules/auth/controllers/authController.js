import { env } from '../../../config/env.js';
import { loginSchema } from '../schemas/authSchema.js';
import * as service from '../services/authService.js';

const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 8 * 60 * 60 * 1000,
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const resultado = await service.autenticar(email, password);
    if (!resultado) return res.status(401).json({ error: 'Credenciales inválidas' });

    res.cookie('token', resultado.token, cookieOpts);
    res.json(resultado.usuario);
  } catch (err) {
    next(err);
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
};

export const me = (req, res) => {
  res.json(req.user);
};
