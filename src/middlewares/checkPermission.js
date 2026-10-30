import pool from '../db/database.js';

export const checkPermission = (modulo, accion) => async (req, res, next) => {
  try {
    if (req.user?.rol === 'admin') return next();

    const { rows } = await pool.query(
      `SELECT 1
         FROM permisos p
         JOIN modulos m  ON m.id = p.modulo_id
         JOIN acciones a ON a.id = p.accion_id
        WHERE p.usuario_uuid = $1 AND m.nombre = $2 AND a.nombre = $3`,
      [req.user.uuid, modulo, accion],
    );

    if (rows.length === 0) return res.status(403).json({ error: 'Permiso denegado' });
    next();
  } catch (err) {
    next(err);
  }
};
