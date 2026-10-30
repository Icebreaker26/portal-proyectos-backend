// ADR 0008 — modelo de datos extendido de proyecto. Columnas nuevas en `proyectos` +
// 4 tablas relacionadas (todo lo de cardinalidad variable respecto al proyecto es
// tabla aparte, nunca columna serializada — ver la "Regla de diseño" en el ADR).
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE proyectos
      ADD COLUMN programa          TEXT,
      ADD COLUMN asignatura        TEXT,
      ADD COLUMN semestre          TEXT,
      ADD COLUMN tipo_proyecto     TEXT CHECK (tipo_proyecto IN ('investigacion', 'aplicativo', 'trabajo_de_grado', 'otro')),
      ADD COLUMN profesor_uuid     UUID REFERENCES global_usuarios(id) ON DELETE SET NULL,
      ADD COLUMN resumen           TEXT,
      ADD COLUMN imagen_portada_url TEXT,
      ADD COLUMN cuerpo            TEXT,
      ADD COLUMN stack             TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN palabras_clave    TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN video_demo_url    TEXT,
      ADD COLUMN demo_url          TEXT,
      -- Default de respaldo (UUID) para inserts que no pasan por el servicio (seeds,
      -- tests, migraciones de datos); el servicio siempre genera un slug legible via
      -- generarSlugUnico() en proyectosService.js.
      ADD COLUMN slug              TEXT DEFAULT ('proyecto-' || uuid_generate_v4()),
      ADD COLUMN visibilidad       TEXT NOT NULL DEFAULT 'publico' CHECK (visibilidad IN ('publico', 'comunidad', 'privado')),
      ADD COLUMN licencia          TEXT;

    -- Proyectos existentes (si los hay) reciben un slug derivado del id para no dejar
    -- la columna NULL antes de volverla UNIQUE + NOT NULL.
    UPDATE proyectos SET slug = 'proyecto-' || id WHERE slug IS NULL;
    ALTER TABLE proyectos ALTER COLUMN slug SET NOT NULL;
    ALTER TABLE proyectos ADD CONSTRAINT proyectos_slug_unique UNIQUE (slug);

    CREATE TABLE proyecto_participantes (
      id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proyecto_id            UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      usuario_uuid           UUID REFERENCES global_usuarios(id) ON DELETE SET NULL,
      nombre_libre           TEXT,
      rol                    TEXT NOT NULL DEFAULT 'desarrollo' CHECK (rol IN ('lider', 'desarrollo', 'diseno', 'investigacion')),
      orden_autoria          INTEGER NOT NULL DEFAULT 1,
      aporte                 TEXT,
      consiente_publicacion  BOOLEAN NOT NULL DEFAULT false,
      created_at             TIMESTAMPTZ DEFAULT NOW(),
      CHECK (usuario_uuid IS NOT NULL OR nombre_libre IS NOT NULL)
    );
    CREATE UNIQUE INDEX proyecto_participantes_usuario_unico
      ON proyecto_participantes (proyecto_id, usuario_uuid) WHERE usuario_uuid IS NOT NULL;

    CREATE TABLE proyecto_revisiones (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proyecto_id     UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      estado_anterior TEXT NOT NULL,
      estado_nuevo    TEXT NOT NULL,
      revisor_uuid    UUID REFERENCES global_usuarios(id) ON DELETE SET NULL,
      comentario      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE proyecto_archivos (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proyecto_id      UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      tipo             TEXT NOT NULL CHECK (tipo IN ('pdf', 'imagen', 'otro')),
      ruta             TEXT NOT NULL,
      nombre_original  TEXT NOT NULL,
      mime_type        TEXT NOT NULL,
      tamano_bytes     INTEGER NOT NULL,
      hash_sha256      TEXT NOT NULL,
      descripcion_alt  TEXT,
      estado_escaneo   TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_escaneo IN ('pendiente', 'limpio', 'sospechoso')),
      subido_por       UUID REFERENCES global_usuarios(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE proyecto_slugs_historicos (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proyecto_id   UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
      slug_anterior TEXT NOT NULL UNIQUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS proyecto_slugs_historicos;
    DROP TABLE IF EXISTS proyecto_archivos;
    DROP TABLE IF EXISTS proyecto_revisiones;
    DROP TABLE IF EXISTS proyecto_participantes;

    ALTER TABLE proyectos
      DROP CONSTRAINT IF EXISTS proyectos_slug_unique,
      DROP COLUMN IF EXISTS programa,
      DROP COLUMN IF EXISTS asignatura,
      DROP COLUMN IF EXISTS semestre,
      DROP COLUMN IF EXISTS tipo_proyecto,
      DROP COLUMN IF EXISTS profesor_uuid,
      DROP COLUMN IF EXISTS resumen,
      DROP COLUMN IF EXISTS imagen_portada_url,
      DROP COLUMN IF EXISTS cuerpo,
      DROP COLUMN IF EXISTS stack,
      DROP COLUMN IF EXISTS palabras_clave,
      DROP COLUMN IF EXISTS video_demo_url,
      DROP COLUMN IF EXISTS demo_url,
      DROP COLUMN IF EXISTS slug,
      DROP COLUMN IF EXISTS visibilidad,
      DROP COLUMN IF EXISTS licencia;
  `);
};
