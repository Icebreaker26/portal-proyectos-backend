import { env } from '../../../config/env.js';
import { loginSchema, registroSchema } from '../schemas/authSchema.js';
import * as service from '../services/authService.js';

// sameSite:'none' en producción porque frontend y backend viven en subdominios *.up.railway.app
// distintos (cross-site para el navegador): con 'lax' el cookie no viaja en las peticiones
// fetch/XHR de apiService (withCredentials), solo en navegaciones top-level — el login
// "funcionaría" pero /api/auth/me nunca vería la sesión. 'none' exige Secure, ya true en prod.
const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
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

export const registro = async (req, res, next) => {
  try {
    const { nombre, email, password } = registroSchema.parse(req.body);
    const resultado = await service.registrar(nombre, email.toLowerCase(), password);

    res.cookie('token', resultado.token, cookieOpts);
    res.status(201).json(resultado.usuario);
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
