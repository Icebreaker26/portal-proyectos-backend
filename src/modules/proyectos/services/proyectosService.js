import pool from '../../../db/database.js';

export const listar = async ({ estado } = {}) => {
  const condiciones = ['is_active = true'];
  const valores = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`estado = $${valores.length}`);
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
