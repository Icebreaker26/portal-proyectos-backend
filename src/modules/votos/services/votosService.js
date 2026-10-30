import pool from '../../../db/database.js';

export const contarPorProyecto = async (proyectoId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM votos WHERE proyecto_id = $1 AND is_active = true`,
    [proyectoId],
  );
  return rows[0].total;
};

export const votar = async (usuarioUuid, proyectoId) => {
  const { rows } = await pool.query(
    `INSERT INTO votos (usuario_uuid, proyecto_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario_uuid, proyecto_id) DO UPDATE SET is_active = true
     RETURNING *`,
    [usuarioUuid, proyectoId],
  );
  return rows[0];
};

export const retirarVoto = async (usuarioUuid, proyectoId) => {
  const { rows } = await pool.query(
    `UPDATE votos SET is_active = false WHERE usuario_uuid = $1 AND proyecto_id = $2 RETURNING id`,
    [usuarioUuid, proyectoId],
  );
  return rows[0] || null;
};
