import bcrypt from 'bcrypt';
import pool from '../src/db/database.js';
import { asignarPermisosPorDefecto } from '../src/services/permisosDefaultService.js';

// Llena la base de datos con usuarios, proyectos (con el modelo extendido del ADR 0008:
// programa/asignatura/semestre, profesor, resumen, stack, participantes con
// consentimiento, historial de revisiones) y votos de prueba, para probar el portal
// manualmente. Idempotente: se puede correr varias veces sin duplicar nada (emails
// reutilizados vía ON CONFLICT, proyectos por título+autor). No usar contra producción.
//
// Los proyectos son repos reales de github.com/Icebreaker26 (elegidos por el autor),
// "adjudicados" a las cuentas de estudiante/profesor de prueba de abajo -- ningún
// estudiante/profesor de este seed es una persona real, solo los repos lo son.
//
// Uso: npm run seed:demo

const PASSWORD = 'Demo1234!';

// Imagen social que GitHub genera automáticamente para cada repo público (opengraph) --
// solo para repos públicos; los privados no la sirven sin auth, así que esos quedan sin portada.
const portadaGithub = (owner, repo) => `https://opengraph.githubassets.com/1/${owner}/${repo}`;

const USUARIOS = [
  { nombre: 'Admin Demo', email: 'admin@ucp.edu.co', rol: 'admin' },
  { nombre: 'Laura Gómez', email: 'profesor1@ucp.edu.co', rol: 'profesor' },
  { nombre: 'Carlos Ríos', email: 'profesor2@ucp.edu.co', rol: 'profesor' },
  { nombre: 'Juan Pérez', email: 'estudiante1@ucp.edu.co', rol: 'estudiante' },
  { nombre: 'María Torres', email: 'estudiante2@ucp.edu.co', rol: 'estudiante' },
  { nombre: 'Andrés López', email: 'estudiante3@ucp.edu.co', rol: 'estudiante' },
  { nombre: 'Valentina Ruiz', email: 'estudiante4@ucp.edu.co', rol: 'estudiante' },
];

const upsertUsuario = async ({ nombre, email, rol }) => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol
     RETURNING id`,
    [nombre, email, hash, rol],
  );
  const id = rows[0].id;
  if (rol !== 'admin') await asignarPermisosPorDefecto(id, rol);
  return id;
};

// Mismo algoritmo que generarSlugUnico() en proyectosService.js, duplicado aquí porque
// este script inserta directo en BD (no pasa por el servicio/HTTP).
const slugify = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '').slice(0, 80) || 'proyecto';

const slugUnico = async (titulo) => {
  const base = slugify(titulo);
  let slug = base;
  let sufijo = 2;
  for (;;) {
    const { rows } = await pool.query('SELECT 1 FROM proyectos WHERE slug = $1', [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${sufijo}`;
    sufijo += 1;
  }
};

const crearProyecto = async (autorUuid, datos) => {
  const existente = await pool.query(
    `SELECT id FROM proyectos WHERE autor_uuid = $1 AND titulo = $2`,
    [autorUuid, datos.titulo],
  );
  if (existente.rows.length > 0) return existente.rows[0].id;

  const slug = await slugUnico(datos.titulo);

  const { rows } = await pool.query(
    `INSERT INTO proyectos (
       autor_uuid, titulo, descripcion, repositorio_url, estado,
       programa, asignatura, semestre, tipo_proyecto, profesor_uuid,
       resumen, imagen_portada_url, stack, palabras_clave, video_demo_url, demo_url,
       slug, visibilidad, licencia
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id`,
    [
      autorUuid, datos.titulo, datos.descripcion, datos.repositorioUrl || null, datos.estado,
      datos.programa || null, datos.asignatura || null, datos.semestre || null,
      datos.tipoProyecto || null, datos.profesorUuid || null,
      datos.resumen || null, datos.imagenPortadaUrl || null, datos.stack || [], datos.palabrasClave || [],
      datos.videoDemoUrl || null, datos.demoUrl || null,
      slug, datos.visibilidad || 'publico', datos.licencia || null,
    ],
  );
  const proyectoId = rows[0].id;

  // Autor siempre como participante líder, consentimiento implícito.
  await pool.query(
    `INSERT INTO proyecto_participantes (proyecto_id, usuario_uuid, rol, orden_autoria, consiente_publicacion)
     VALUES ($1, $2, 'lider', 1, true)`,
    [proyectoId, autorUuid],
  );
  for (const coautor of datos.coautores || []) {
    await pool.query(
      `INSERT INTO proyecto_participantes (proyecto_id, usuario_uuid, rol, orden_autoria, aporte, consiente_publicacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [proyectoId, coautor.uuid, coautor.rol || 'desarrollo', coautor.orden || 2, coautor.aporte || null, coautor.consiente ?? false],
    );
  }

  // Historial de revisión: si el proyecto no está pendiente, es porque "ya pasó" por
  // una revisión — se deja el registro para que proyecto_revisiones no esté vacío.
  if (datos.estado !== 'pendiente' && datos.revisorUuid) {
    await pool.query(
      `INSERT INTO proyecto_revisiones (proyecto_id, estado_anterior, estado_nuevo, revisor_uuid, comentario)
       VALUES ($1, 'pendiente', $2, $3, $4)`,
      [proyectoId, datos.estado, datos.revisorUuid, datos.comentarioRevision || null],
    );
  }

  return proyectoId;
};

const votar = async (usuarioUuid, proyectoId) => {
  await pool.query(
    `INSERT INTO votos (usuario_uuid, proyecto_id) VALUES ($1, $2)
     ON CONFLICT (usuario_uuid, proyecto_id) DO UPDATE SET is_active = true`,
    [usuarioUuid, proyectoId],
  );
};

const main = async () => {
  const ids = {};
  for (const u of USUARIOS) {
    ids[u.email] = await upsertUsuario(u);
  }

  // Proyectos reales de github.com/Icebreaker26 (el autor de este repo), elegidos por él
  // mismo y "adjudicados" a las cuentas de prueba de arriba -- ver AGENTS.md para el detalle.
  const proyectos = [
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'The Linkin Tool — Planificación de enlaces PTP',
      descripcion: 'Software para planificar enlaces punto a punto (PTP) en proyectos de telecomunicaciones: calcula línea de vista, zona de Fresnel y presupuesto de enlace a partir de las coordenadas de los dos extremos.',
      repositorioUrl: 'https://github.com/Icebreaker26/thelinkintool',
      imagenPortadaUrl: portadaGithub('Icebreaker26', 'thelinkintool'),
      programa: 'Ingeniería Electrónica y Telecomunicaciones',
      asignatura: 'Radioenlaces',
      semestre: '2025-2',
      tipoProyecto: 'trabajo_de_grado',
      profesor: 'profesor2@ucp.edu.co',
      resumen: 'Calcula línea de vista, zona de Fresnel y presupuesto de enlace para radioenlaces punto a punto.',
      stack: ['JavaScript', 'Node.js'],
      palabrasClave: ['telecomunicaciones', 'radioenlaces', 'ptp'],
      comentarioRevision: 'Aprobado — herramienta sólida y bien documentada para el curso de radioenlaces.',
    },
    {
      autor: 'estudiante1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Moodle Tracker',
      descripcion: 'Panel local para no perder el rastro de tareas y entregas del aula virtual institucional (Moodle), usando la API oficial sin servidores intermedios ni dependencias externas.',
      repositorioUrl: 'https://github.com/Icebreaker26/moodle-tracker',
      imagenPortadaUrl: portadaGithub('Icebreaker26', 'moodle-tracker'),
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Electiva de Desarrollo',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor1@ucp.edu.co',
      resumen: 'Panel local para rastrear tareas y entregas de Moodle vía su API oficial, sin servidores intermedios.',
      stack: ['JavaScript'],
      palabrasClave: ['moodle', 'productividad', 'api'],
      coautores: [{ email: 'estudiante2@ucp.edu.co', rol: 'desarrollo', aporte: 'Integración con la API de calificaciones', consiente: true }],
      comentarioRevision: 'Aprobado.',
    },
    {
      autor: 'estudiante2@ucp.edu.co',
      estado: 'pendiente',
      titulo: 'UCP Markdown CLI — Informe de opción de grado',
      descripcion: 'Herramienta de línea de comandos para escribir el informe de opción de grado (IST, UCP) en Markdown: citas en formato IEEE, checklist de formato institucional, seguimiento de pendientes y exportación a Word.',
      repositorioUrl: 'https://github.com/Icebreaker26/ucp-markdown-cli',
      imagenPortadaUrl: portadaGithub('Icebreaker26', 'ucp-markdown-cli'),
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Proyecto de Grado I',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor1@ucp.edu.co',
      resumen: 'CLI para escribir el informe de grado en Markdown con citas IEEE, checklist de formato y exportación a Word.',
      stack: ['JavaScript', 'Node.js'],
      palabrasClave: ['markdown', 'academico', 'cli'],
      // A propósito SIN consentir: para demostrar que no se puede aprobar hasta que
      // estudiante4 confirme su consentimiento vía PUT /:id/consentimiento.
      coautores: [{ email: 'estudiante4@ucp.edu.co', rol: 'investigacion', aporte: 'Checklist de formato institucional', consiente: false }],
    },
    {
      autor: 'estudiante4@ucp.edu.co',
      estado: 'rechazado',
      titulo: 'Instalador automatizado CachyOS',
      descripcion: 'Instalación automatizada estilo CachyOS (Arch Linux + KDE + btrfs) para VirtualBox, pensada para levantar entornos de laboratorio reproducibles rápidamente.',
      repositorioUrl: 'https://github.com/Icebreaker26/cachy-custom-installer',
      imagenPortadaUrl: portadaGithub('Icebreaker26', 'cachy-custom-installer'),
      programa: 'Ingeniería de Sistemas',
      asignatura: null,
      semestre: '2025-2',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor2@ucp.edu.co',
      resumen: 'Automatiza la instalación de un entorno Arch Linux + KDE + btrfs en VirtualBox para laboratorios reproducibles.',
      stack: ['Shell', 'Arch Linux'],
      palabrasClave: ['linux', 'devops', 'automatizacion'],
      comentarioRevision: 'Rechazado: falta explicar qué objetivo de curso cumple el proyecto y cómo se evalúa — se puede reenviar con ese alcance académico aclarado.',
    },
    {
      autor: 'profesor1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'CORE — Motor de gestión legal, ambiental y contractual',
      descripcion: 'Monolito modular PERN para la gestión legal, ambiental, contractual y operativa de una empresa del sector energético: tutelas, contratos, comunicaciones y aprobaciones, con permisos granulares por módulo y acción.',
      repositorioUrl: 'https://github.com/Icebreaker26/legal-case-engine-frontend',
      imagenPortadaUrl: portadaGithub('Icebreaker26', 'legal-case-engine-frontend'),
      programa: 'Ingeniería de Sistemas',
      asignatura: null,
      semestre: '2026-1',
      tipoProyecto: 'trabajo_de_grado',
      resumen: 'Monolito modular PERN para gestión legal, ambiental y contractual con permisos granulares por módulo.',
      stack: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
      palabrasClave: ['legaltech', 'gestion', 'permisos'],
      comentarioRevision: 'Autoaprobado por la autora (rol profesor).',
    },
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Fábrica de reels 3D — motor + kits de estilo',
      descripcion: 'Motor para producir videos cortos verticales con Remotion + Three.js, narración por IA y efectos de sonido sintetizados, con kits de estilo intercambiables para que un cliente nuevo solo necesite un guion, no una app nueva.',
      repositorioUrl: 'https://github.com/Icebreaker26/3d-animations-showcase',
      // Repo privado: GitHub no sirve la imagen social sin auth, queda sin portada.
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Electiva de IA Aplicada',
      semestre: '2026-1',
      tipoProyecto: 'investigacion',
      profesor: 'profesor1@ucp.edu.co',
      resumen: 'Motor de videos 3D con Remotion + Three.js y narración por IA, con kits de estilo intercambiables.',
      stack: ['TypeScript', 'React', 'Three.js', 'Remotion'],
      palabrasClave: ['ia', '3d', 'video'],
      coautores: [{ email: 'estudiante1@ucp.edu.co', rol: 'diseno', aporte: 'Kits de estilo cartoon y noche', consiente: true }],
      comentarioRevision: 'Aprobado — buena demostración del patrón motor + kit de estilo intercambiable.',
    },
  ];

  const proyectoIds = {};
  for (const p of proyectos) {
    const id = await crearProyecto(ids[p.autor], {
      ...p,
      profesorUuid: p.profesor ? ids[p.profesor] : null,
      revisorUuid: p.profesor ? ids[p.profesor] : ids['admin@ucp.edu.co'],
      coautores: (p.coautores || []).map((c) => ({ ...c, uuid: ids[c.email] })),
    });
    proyectoIds[p.titulo] = id;
  }

  const votos = [
    ['The Linkin Tool — Planificación de enlaces PTP', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'profesor1@ucp.edu.co']],
    ['Moodle Tracker', ['estudiante2@ucp.edu.co', 'estudiante3@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co', 'profesor2@ucp.edu.co']],
    ['CORE — Motor de gestión legal, ambiental y contractual', ['estudiante1@ucp.edu.co', 'estudiante3@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor2@ucp.edu.co']],
    ['Fábrica de reels 3D — motor + kits de estilo', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co']],
  ];

  for (const [titulo, emails] of votos) {
    for (const email of emails) {
      await votar(ids[email], proyectoIds[titulo]);
    }
  }

  console.log('Seed de prueba completo.\n');
  console.log(`Contraseña de todas las cuentas: ${PASSWORD}\n`);
  console.log('Usuarios:');
  for (const u of USUARIOS) console.log(`  - ${u.email} (${u.rol})`);
  console.log(`\n${proyectos.length} proyectos reales de github.com/Icebreaker26 (4 aprobados, 1 pendiente, 1 rechazado).`);
  console.log('"UCP Markdown CLI — Informe de opción de grado" tiene un coautor sin consentir —');
  console.log('sirve para probar que no se puede aprobar hasta que estudiante4 confirme.');

  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
