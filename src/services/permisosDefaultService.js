import pool from '../db/database.js';

// Permisos que recibe automáticamente cada rol al crearse.
// 'admin' no necesita entrada aquí: checkPermission.js lo deja pasar siempre.
const PERMISOS_POR_ROL = {
  estudiante: [
    ['proyectos', 'READ'],
    ['proyectos', 'WRITE'],
    ['votos', 'WRITE'],
    ['votos', 'DELETE'],
    ['usuarios', 'BUSCAR'],
  ],
  profesor: [
    ['proyectos', 'READ'],
    ['proyectos', 'WRITE'],
    ['proyectos', 'DELETE'],
    ['proyectos', 'APROBAR'],
    ['votos', 'WRITE'],
    ['votos', 'DELETE'],
    ['usuarios', 'BUSCAR'],
  ],
};

export const asignarPermisosPorDefecto = async (usuarioUuid, rol) => {
  const permisos = PERMISOS_POR_ROL[rol];
  if (!permisos) return;

  for (const [modulo, accion] of permisos) {
    await pool.query(
      `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
       SELECT $1, m.id, a.id FROM modulos m, acciones a
       WHERE m.nombre = $2 AND a.nombre = $3
       ON CONFLICT DO NOTHING`,
      [usuarioUuid, modulo, accion],
    );
  }
};
