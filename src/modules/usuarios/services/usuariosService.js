import pool from '../../../db/database.js';
import { asignarPermisosPorDefecto } from '../../../services/permisosDefaultService.js';

export const listar = async () => {
  const { rows } = await pool.query(
    `SELECT id, nombre, email, rol, created_at
       FROM global_usuarios WHERE is_active = true ORDER BY created_at DESC`,
  );
  return rows;
};

export const actualizarRol = async (id, rol) => {
  const { rows } = await pool.query(
    `UPDATE global_usuarios SET rol = $2, updated_at = NOW()
       WHERE id = $1 AND is_active = true RETURNING id, nombre, email, rol`,
    [id, rol],
  );
  const usuario = rows[0];
  if (!usuario) return null;

  // Limpia los permisos de negocio antes de reasignar: un cambio de rol en cualquier
  // dirección no debe dejar permisos del rol anterior (p.ej. profesor->estudiante
  // perdiendo APROBAR/DELETE en proyectos).
  await pool.query(
    `DELETE FROM permisos
       WHERE usuario_uuid = $1
         AND modulo_id IN (SELECT id FROM modulos WHERE nombre IN ('proyectos', 'votos'))`,
    [id],
  );
  await asignarPermisosPorDefecto(id, rol);

  return usuario;
};
