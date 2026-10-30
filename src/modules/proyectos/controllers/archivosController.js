import multer from 'multer';
import pool from '../../../db/database.js';
import { idParamSchema } from '../schemas/proyectosSchema.js';
import * as archivosService from '../services/archivosService.js';

const TIPOS_PERMITIDOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      const err = new Error('Tipo de archivo no permitido');
      err.status = 400;
      err.publicMessage = 'Tipo de archivo no permitido (solo PDF, PNG, JPEG, WEBP)';
      return cb(err);
    }
    cb(null, true);
  },
});

export const middlewareSubida = upload.single('archivo');

// Solo el autor del proyecto (o un admin) puede subir archivos — WRITE sobre
// 'proyectos' no distingue de quién es cada proyecto, así que se valida aquí.
export const subir = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo (campo "archivo")' });

    const { rows } = await pool.query('SELECT autor_uuid FROM proyectos WHERE id = $1 AND is_active = true', [id]);
    const proyecto = rows[0];
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (proyecto.autor_uuid !== req.user.uuid && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el autor del proyecto puede subir archivos' });
    }

    const archivo = await archivosService.guardarArchivo(id, req.user.uuid, req.file);
    res.status(201).json(archivo);
  } catch (err) { next(err); }
};

export const listar = async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    res.json(await archivosService.listarPorProyecto(id));
  } catch (err) { next(err); }
};

// Descarga del binario: exige sesión (ver proyectosRoutes.js — va después de
// verifyToken). Los metadatos de archivos ya son públicos vía GET /pub/:id; el
// binario no, para no construir un segundo control de acceso público por ahora.
export const descargar = async (req, res, next) => {
  try {
    const archivo = await archivosService.obtenerParaDescargar(req.params.archivoId);
    if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.setHeader('Content-Type', archivo.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${archivo.nombre_original}"`);
    res.sendFile(archivo.rutaAbsoluta);
  } catch (err) { next(err); }
};
