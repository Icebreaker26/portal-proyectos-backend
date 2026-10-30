// Registra el módulo 'usuarios' (gestión de roles, issue #10). Nadie recibe permisos
// sobre este módulo por defecto (ver permisosDefaultService.js) — checkPermission.js
// deja pasar solo a 'admin', así que en la práctica es admin-only.
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO modulos (nombre, descripcion) VALUES ('usuarios', 'Gestión de usuarios y roles (solo admin)')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DELETE FROM permisos WHERE modulo_id = (SELECT id FROM modulos WHERE nombre = 'usuarios');
    DELETE FROM modulos WHERE nombre = 'usuarios';
  `);
};
