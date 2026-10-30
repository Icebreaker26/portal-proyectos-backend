import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../../../db/database.js';

// uploads_vol (docker-compose.yml) monta /app/uploads en el contenedor; en local,
// 'uploads/' relativo a la raíz del proyecto (ya está en .gitignore).
const UPLOADS_DIR = path.resolve('uploads', 'proyectos');

const asegurarDirectorio = () => fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const tipoDesdeMime = (mime) => {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'imagen';
  return 'otro';
};

export const guardarArchivo = async (proyectoId, subidoPor, file) => {
  asegurarDirectorio();
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const nombreArchivo = `${proyectoId}-${hash}${path.extname(file.originalname)}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, nombreArchivo), file.buffer);

  const { rows } = await pool.query(
    `INSERT INTO proyecto_archivos (proyecto_id, tipo, ruta, nombre_original, mime_type, tamano_bytes, hash_sha256, subido_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, tipo, nombre_original, mime_type, tamano_bytes, created_at`,
    [proyectoId, tipoDesdeMime(file.mimetype), nombreArchivo, file.originalname, file.mimetype, file.size, hash, subidoPor],
  );
  return rows[0];
};

export const listarPorProyecto = async (proyectoId) => {
  const { rows } = await pool.query(
    `SELECT id, tipo, nombre_original, mime_type, tamano_bytes, descripcion_alt, created_at
       FROM proyecto_archivos WHERE proyecto_id = $1 ORDER BY created_at ASC`,
    [proyectoId],
  );
  return rows;
};

export const obtenerParaDescargar = async (archivoId) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.ruta, a.nombre_original, a.mime_type
       FROM proyecto_archivos a
       JOIN proyectos p ON p.id = a.proyecto_id
      WHERE a.id = $1 AND p.is_active = true`,
    [archivoId],
  );
  const archivo = rows[0];
  if (!archivo) return null;
  return { ...archivo, rutaAbsoluta: path.join(UPLOADS_DIR, archivo.ruta) };
};
