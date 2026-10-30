export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE proyectos (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      autor_uuid      UUID NOT NULL REFERENCES global_usuarios(id) ON DELETE CASCADE,
      titulo          TEXT NOT NULL,
      descripcion     TEXT NOT NULL,
      repositorio_url TEXT,
      estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
      is_active       BOOLEAN DEFAULT true,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO modulos (nombre, descripcion) VALUES ('proyectos', 'Proyectos subidos por estudiantes')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS proyectos;
    DELETE FROM modulos WHERE nombre = 'proyectos';
  `);
};
