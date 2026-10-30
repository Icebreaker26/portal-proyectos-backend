import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../../db/database.js';
import { env } from '../../../config/env.js';

export const autenticar = async (email, password) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, password_hash, rol FROM global_usuarios WHERE email = $1 AND is_active = true',
    [email],
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) return null;

  const token = jwt.sign(
    { uuid: usuario.id, rol: usuario.rol, email: usuario.email },
    env.JWT_SECRET,
    { expiresIn: '8h' },
  );

  return { token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } };
};
