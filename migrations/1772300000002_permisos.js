export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE modulos (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT NOT NULL UNIQUE,
      descripcion TEXT
    );

    CREATE TABLE acciones (
      id     SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE
    );

    CREATE TABLE permisos (
      usuario_uuid UUID NOT NULL REFERENCES global_usuarios(id) ON DELETE CASCADE,
      modulo_id    INTEGER NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
      accion_id    INTEGER NOT NULL REFERENCES acciones(id) ON DELETE CASCADE,
      PRIMARY KEY (usuario_uuid, modulo_id, accion_id)
    );

    INSERT INTO acciones (nombre) VALUES ('READ'), ('WRITE'), ('DELETE')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS permisos;
    DROP TABLE IF EXISTS acciones;
    DROP TABLE IF EXISTS modulos;
  `);
};
