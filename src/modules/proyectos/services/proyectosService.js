import pool from '../../../db/database.js';

const tieneAprobar = async (usuario) => {
  if (usuario.rol === 'admin') return true;
  const { rows } = await pool.query(
    `SELECT 1
       FROM permisos p
       JOIN modulos m  ON m.id = p.modulo_id
       JOIN acciones a ON a.id = p.accion_id
      WHERE p.usuario_uuid = $1 AND m.nombre = 'proyectos' AND a.nombre = 'APROBAR'`,
    [usuario.uuid],
  );
  return rows.length > 0;
};

const error = (status, publicMessage) => {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
};

const validarProfesor = async (profesorUuid) => {
  if (!profesorUuid) return;
  const { rows } = await pool.query(
    `SELECT rol FROM global_usuarios WHERE id = $1 AND is_active = true`,
    [profesorUuid],
  );
  const usuario = rows[0];
  if (!usuario || !['profesor', 'admin'].includes(usuario.rol)) {
    throw error(400, 'El profesor indicado no existe o no tiene rol profesor');
  }
};

const slugify = (texto) =>
  texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 80) || 'proyecto';

const generarSlugUnico = async (titulo) => {
  const base = slugify(titulo);
  let slug = base;
  let sufijo = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await pool.query('SELECT 1 FROM proyectos WHERE slug = $1', [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${sufijo}`;
    sufijo += 1;
  }
};

// Quien puede aprobar (profesor/admin) ve todos los proyectos, para poder moderarlos.
// Quien no, ve lo suyo (autor o participante) + lo aprobado-no-privado de otros.
export const listar = async (usuario, { estado } = {}) => {
  const condiciones = ['p.is_active = true'];
  const valores = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`p.estado = $${valores.length}`);
  }

  if (!(await tieneAprobar(usuario))) {
    valores.push(usuario.uuid);
    const uIdx = valores.length;
    condiciones.push(`(
      p.autor_uuid = $${uIdx}
      OR EXISTS (SELECT 1 FROM proyecto_participantes pp WHERE pp.proyecto_id = p.id AND pp.usuario_uuid = $${uIdx})
      OR (p.estado = 'aprobado' AND p.visibilidad IN ('publico', 'comunidad'))
    )`);
  }

  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion, p.repositorio_url, p.estado, p.autor_uuid, p.created_at,
            p.programa, p.asignatura, p.semestre, p.tipo_proyecto, p.resumen, p.imagen_portada_url,
            p.stack, p.slug, p.visibilidad,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE ${condiciones.join(' AND ')} ORDER BY p.created_at DESC`,
    valores,
  );
  return rows;
};

export const listarPublicos = async () => {
  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.descripcion, p.repositorio_url, p.created_at,
            p.programa, p.asignatura, p.semestre, p.tipo_proyecto, p.resumen, p.imagen_portada_url,
            p.stack, p.slug,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE p.is_active = true AND p.estado = 'aprobado' AND p.visibilidad = 'publico'
      ORDER BY p.created_at DESC`,
  );
  return rows;
};

// Detalle público: solo si está aprobado, activo y con visibilidad 'publico' (misma
// regla que listarPublicos). Incluye autor, profesor (si tiene), participantes y
// metadatos de archivos (la descarga del binario exige sesión — ver archivosController.js).
export const obtenerPublico = async (id) => {
  const { rows } = await pool.query(
    `SELECT p.*, g.nombre AS autor_nombre, gp.nombre AS profesor_nombre,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       JOIN global_usuarios g ON g.id = p.autor_uuid
       LEFT JOIN global_usuarios gp ON gp.id = p.profesor_uuid
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE p.id = $1 AND p.is_active = true AND p.estado = 'aprobado' AND p.visibilidad = 'publico'`,
    [id],
  );
  const proyecto = rows[0];
  if (!proyecto) return null;

  const participantes = await pool.query(
    `SELECT pp.usuario_uuid, pp.nombre_libre, pp.rol, pp.orden_autoria, pp.aporte, g.nombre AS nombre_cuenta
       FROM proyecto_participantes pp
       LEFT JOIN global_usuarios g ON g.id = pp.usuario_uuid
      WHERE pp.proyecto_id = $1
      ORDER BY pp.orden_autoria ASC`,
    [id],
  );

  const archivos = await pool.query(
    `SELECT id, tipo, nombre_original, mime_type, tamano_bytes, descripcion_alt, created_at
       FROM proyecto_archivos WHERE proyecto_id = $1 ORDER BY created_at ASC`,
    [id],
  );

  return { ...proyecto, participantes: participantes.rows, archivos: archivos.rows };
};

// Expediente autenticado de un proyecto (a diferencia de obtenerPublico, no se limita a
// aprobado+publico): quien puede aprobar ve cualquiera; el resto solo si es autor,
// participante, o si ya está aprobado y no es privado — misma regla que listar(). Devuelve
// 404 en vez de 403 para no revelar que el proyecto existe a quien no debería verlo.
// Incluye el historial de revisiones (proyecto_revisiones) -- a diferencia del detalle
// público, aquí sí aplica: quien ve el expediente ya tiene algún vínculo con el proyecto.
export const obtener = async (id, usuario) => {
  const { rows } = await pool.query(
    `SELECT p.*, g.nombre AS autor_nombre, gp.nombre AS profesor_nombre,
            COALESCE(v.total, 0)::int AS votos
       FROM proyectos p
       JOIN global_usuarios g ON g.id = p.autor_uuid
       LEFT JOIN global_usuarios gp ON gp.id = p.profesor_uuid
       LEFT JOIN (SELECT proyecto_id, COUNT(*) AS total FROM votos WHERE is_active = true GROUP BY proyecto_id) v
         ON v.proyecto_id = p.id
      WHERE p.id = $1 AND p.is_active = true`,
    [id],
  );
  const proyecto = rows[0];
  if (!proyecto) return null;

  if (!(await tieneAprobar(usuario))) {
    const esAutor = proyecto.autor_uuid === usuario.uuid;
    const { rows: participa } = await pool.query(
      `SELECT 1 FROM proyecto_participantes WHERE proyecto_id = $1 AND usuario_uuid = $2`,
      [id, usuario.uuid],
    );
    const esAprobadoVisible = proyecto.estado === 'aprobado' && ['publico', 'comunidad'].includes(proyecto.visibilidad);
    if (!esAutor && participa.length === 0 && !esAprobadoVisible) return null;
  }

  const participantes = await pool.query(
    `SELECT pp.usuario_uuid, pp.nombre_libre, pp.rol, pp.orden_autoria, pp.aporte, pp.consiente_publicacion,
            g.nombre AS nombre_cuenta
       FROM proyecto_participantes pp
       LEFT JOIN global_usuarios g ON g.id = pp.usuario_uuid
      WHERE pp.proyecto_id = $1
      ORDER BY pp.orden_autoria ASC`,
    [id],
  );

  const archivos = await pool.query(
    `SELECT id, tipo, nombre_original, mime_type, tamano_bytes, descripcion_alt, created_at
       FROM proyecto_archivos WHERE proyecto_id = $1 ORDER BY created_at ASC`,
    [id],
  );

  const revisiones = await pool.query(
    `SELECT r.estado_anterior, r.estado_nuevo, r.comentario, r.created_at, g.nombre AS revisor_nombre
       FROM proyecto_revisiones r
       LEFT JOIN global_usuarios g ON g.id = r.revisor_uuid
      WHERE r.proyecto_id = $1 ORDER BY r.created_at ASC`,
    [id],
  );

  return {
    ...proyecto,
    participantes: participantes.rows,
    archivos: archivos.rows,
    revisiones: revisiones.rows,
  };
};

export const crear = async (autorUuid, datos) => {
  await validarProfesor(datos.profesor_uuid);
  const slug = await generarSlugUnico(datos.titulo);

  const { rows } = await pool.query(
    `INSERT INTO proyectos (
       autor_uuid, titulo, descripcion, repositorio_url,
       programa, asignatura, semestre, tipo_proyecto, profesor_uuid,
       resumen, imagen_portada_url, cuerpo, stack, palabras_clave,
       video_demo_url, demo_url, slug, visibilidad, licencia
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      autorUuid, datos.titulo, datos.descripcion, datos.repositorio_url || null,
      datos.programa || null, datos.asignatura || null, datos.semestre || null,
      datos.tipo_proyecto || null, datos.profesor_uuid || null,
      datos.resumen || null, datos.imagen_portada_url || null, datos.cuerpo || null,
      datos.stack || [], datos.palabras_clave || [],
      datos.video_demo_url || null, datos.demo_url || null,
      slug, datos.visibilidad || 'publico', datos.licencia || null,
    ],
  );
  const proyecto = rows[0];

  // El autor siempre queda como participante con consentimiento implícito (es quien
  // sube el proyecto). El resto de participantes con cuenta empieza sin consentir —
  // deben confirmarlo ellos mismos vía PUT /:id/consentimiento antes de poder aprobar.
  const entrada = datos.participantes?.length ? datos.participantes : [];
  const incluyeAutor = entrada.some((p) => p.usuario_uuid === autorUuid);
  const participantes = incluyeAutor
    ? entrada
    : [{ usuario_uuid: autorUuid, rol: 'lider', orden_autoria: 1 }, ...entrada];

  for (const p of participantes) {
    const esAutor = p.usuario_uuid === autorUuid;
    await pool.query(
      `INSERT INTO proyecto_participantes (proyecto_id, usuario_uuid, nombre_libre, rol, orden_autoria, aporte, consiente_publicacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [proyecto.id, p.usuario_uuid || null, p.nombre_libre || null, p.rol || 'desarrollo', p.orden_autoria || 1, p.aporte || null, esAutor],
    );
  }

  return proyecto;
};

// Aprobar exige que todo participante con cuenta en el portal haya confirmado su
// consentimiento de publicación (ADR 0008 — Ley 1581 de 2012 / derechos de autor
// compartidos). Cada cambio de estado queda registrado en proyecto_revisiones, con el
// comentario (motivo de rechazo u observación) si se da uno.
export const actualizarEstado = async (id, estado, revisorUuid, comentario) => {
  if (estado === 'aprobado') {
    const { rows: pendientes } = await pool.query(
      `SELECT 1 FROM proyecto_participantes
        WHERE proyecto_id = $1 AND usuario_uuid IS NOT NULL AND consiente_publicacion = false`,
      [id],
    );
    if (pendientes.length > 0) {
      throw error(409, 'No se puede aprobar: uno o más participantes no han confirmado su consentimiento de publicación');
    }
  }

  const actual = await pool.query('SELECT estado FROM proyectos WHERE id = $1 AND is_active = true', [id]);
  if (actual.rows.length === 0) return null;
  const estadoAnterior = actual.rows[0].estado;

  const { rows } = await pool.query(
    `UPDATE proyectos SET estado = $2, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING *`,
    [id, estado],
  );
  const proyecto = rows[0];

  await pool.query(
    `INSERT INTO proyecto_revisiones (proyecto_id, estado_anterior, estado_nuevo, revisor_uuid, comentario)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, estadoAnterior, estado, revisorUuid, comentario || null],
  );

  return proyecto;
};

export const actualizarConsentimiento = async (proyectoId, usuarioUuid, consiente) => {
  const { rows } = await pool.query(
    `UPDATE proyecto_participantes SET consiente_publicacion = $3
       WHERE proyecto_id = $1 AND usuario_uuid = $2 RETURNING id`,
    [proyectoId, usuarioUuid, consiente],
  );
  return rows[0] || null;
};

export const eliminar = async (id) => {
  const { rows } = await pool.query(
    `UPDATE proyectos SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows[0] || null;
};
