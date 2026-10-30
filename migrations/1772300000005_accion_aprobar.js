// Separa "crear/editar proyecto propio" (WRITE) de "aprobar/rechazar" (APROBAR),
// para que un estudiante con WRITE no pueda cambiar el estado de un proyecto.
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO acciones (nombre) VALUES ('APROBAR')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DELETE FROM permisos WHERE accion_id = (SELECT id FROM acciones WHERE nombre = 'APROBAR');
    DELETE FROM acciones WHERE nombre = 'APROBAR';
  `);
};
