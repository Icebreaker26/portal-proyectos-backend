import bcrypt from 'bcrypt';
import pool from '../src/db/database.js';

// Siembra un usuario admin con permisos completos sobre todos los módulos registrados.
// Uso: node scripts/seed.js <email> <password> <nombre>
const [, , email, password, nombre] = process.argv;

if (!email || !password || !nombre) {
  console.error('Uso: node scripts/seed.js <email> <password> <nombre>');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

const { rows } = await pool.query(
  `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING id`,
  [nombre, email, hash],
);
const usuarioUuid = rows[0].id;

await pool.query(
  `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
   SELECT $1, m.id, a.id FROM modulos m CROSS JOIN acciones a
   ON CONFLICT DO NOTHING`,
  [usuarioUuid],
);

console.log(`Admin sembrado: ${email}`);
await pool.end();
