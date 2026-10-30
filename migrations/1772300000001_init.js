export const up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE global_usuarios (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nombre        TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol           TEXT NOT NULL CHECK (rol IN ('estudiante', 'profesor', 'admin')),
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS global_usuarios;
    DROP EXTENSION IF EXISTS "uuid-ossp";
  `);
};
