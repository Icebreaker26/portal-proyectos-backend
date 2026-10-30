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
    `SELECT id, titulo, descripcion, repositorio_url, estado, autor_uuid, created_at
       FROM proyectos WHERE ${condiciones.join(' AND ')} ORDER BY created_at DESC`,
    valores,
  );
  return rows;
};

export const listarPublicos = async () => {
  const { rows } = await pool.query(
    `SELECT id, titulo, descripcion, repositorio_url, created_at
       FROM proyectos WHERE is_active = true AND estado = 'aprobado' ORDER BY created_at DESC`,
  );
  return rows;
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
