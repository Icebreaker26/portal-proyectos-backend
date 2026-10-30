import pool from '../../../db/database.js';

const tieneAprobar = async (usuario) => {
  if (usuario.rol === 'admin') return true;
  const { rows } = await pool.query(
    `SELECT 1
       FROM permisos p
       JOIN modulos m  ON m.id = p.modulo_id
       JOIN acciones a ON a.id = p.accion_id
      WHERE p.usuario_uuid = $1 AND m.nombre = 'proyectos' AND a.nombre = 'APROBAR'`,
    [usuario.uuid],
  );
  return rows.length > 0;
};

// Quien puede aprobar (profesor/admin) ve todos los proyectos, para poder moderarlos.
// Quien no (estudiante) ve los aprobados de todos + los suyos propios en cualquier estado.
export const listar = async (usuario, { estado } = {}) => {
  const condiciones = ['is_active = true'];
  const valores = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
  }

  if (!(await tieneAprobar(usuario))) {
    valores.push(usuario.uuid);
    condiciones.push(`(estado = 'aprobado' OR autor_uuid = $${valores.length})`);
  }

  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion, p.repositorio_url, p.estado, p.autor_uuid, p.created_at,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE ${condiciones.join(' AND ')} ORDER BY p.created_at DESC`,
    valores,
  );
  return rows;
};

export const listarPublicos = async () => {
  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion, p.repositorio_url, p.created_at,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE p.is_active = true AND p.estado = 'aprobado' ORDER BY p.created_at DESC`,
  );
  return rows;
};

// Detalle público de un proyecto: solo si está aprobado y activo (misma regla que
// listarPublicos). Incluye el nombre del autor y el conteo de votos.
export const obtenerPublico = async (id) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion, p.repositorio_url, p.created_at,
            g.nombre AS autor_nombre,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       JOIN global_usuarios g ON g.id = p.autor_uuid
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE p.id = $1 AND p.is_active = true AND p.estado = 'aprobado'`,
    [id],
  );
  return rows[0] || null;
};

export const crear = async (autorUuid, datos) => {
  const { rows } = await pool.query(
    `INSERT INTO proyectos (autor_uuid, titulo, descripcion, repositorio_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [autorUuid, datos.titulo, datos.descripcion, datos.repositorio_url || null],
  );
  return rows[0];
};

export const actualizarEstado = async (id, estado) => {
  const { rows } = await pool.query(
    `UPDATE proyectos SET estado = $2, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING *`,
    [id, estado],
  );
  return rows[0] || null;
};

export const eliminar = async (id) => {
  const { rows } = await pool.query(
    `UPDATE proyectos SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows[0] || null;
};
