// Issue #12 — acción para que estudiante/profesor puedan listar profesores y buscar una cuenta
// por email exacto (para elegir profesor / agregar coautor con cuenta real), sin desbloquear el
// GET /api/usuarios completo (ese sigue siendo admin-only, por el riesgo de enumeración).
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO acciones (nombre) VALUES ('BUSCAR')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DELETE FROM permisos WHERE accion_id = (SELECT id FROM acciones WHERE nombre = 'BUSCAR');
    DELETE FROM acciones WHERE nombre = 'BUSCAR';
  `);
};
