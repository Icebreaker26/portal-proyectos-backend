import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../../db/database.js';
import { env } from '../../../config/env.js';
import { asignarPermisosPorDefecto } from '../../../services/permisosDefaultService.js';

const firmarToken = (usuario) => jwt.sign(
  { uuid: usuario.id, rol: usuario.rol, email: usuario.email },
  env.JWT_SECRET,
  { expiresIn: '8h' },
);

export const autenticar = async (email, password) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, password_hash, rol FROM global_usuarios WHERE email = $1 AND is_active = true',
    [email],
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) return null;

  return { token: firmarToken(usuario), usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } };
};

// Autorregistro: siempre crea rol 'estudiante'. La promoción a 'profesor' es manual (ver ADR 0006).
export const registrar = async (nombre, email, password) => {
  const hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, 'estudiante') RETURNING id, nombre, email, rol`,
    [nombre, email, hash],
  );
  const usuario = rows[0];

  await asignarPermisosPorDefecto(usuario.id, 'estudiante');

  return { token: firmarToken(usuario), usuario };
};
