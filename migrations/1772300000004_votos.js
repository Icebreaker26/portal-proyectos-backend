export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE votos (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      usuario_uuid UUID NOT NULL REFERENCES global_usuarios(id) ON DELETE CASCADE,
      proyecto_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      is_active    BOOLEAN DEFAULT true,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (usuario_uuid, proyecto_id)
    );

    INSERT INTO modulos (nombre, descripcion) VALUES ('votos', 'Votos de usuarios autenticados sobre proyectos')
      ON CONFLICT (nombre) DO NOTHING;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS votos;
    DELETE FROM modulos WHERE nombre = 'votos';
  `);
};
