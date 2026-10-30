import bcrypt from 'bcrypt';
import pool from '../src/db/database.js';
import { asignarPermisosPorDefecto } from '../src/services/permisosDefaultService.js';

// Llena la base de datos con usuarios, proyectos (con el modelo extendido del ADR 0008:
// programa/asignatura/semestre, profesor, resumen, stack, participantes con
// consentimiento, historial de revisiones) y votos de prueba, para probar el portal
// manualmente. Idempotente: se puede correr varias veces sin duplicar nada (emails
// reutilizados vía ON CONFLICT, proyectos por título+autor). No usar contra producción.
//
// Uso: npm run seed:demo

const PASSWORD = 'Demo1234!';

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
       resumen, stack, palabras_clave, video_demo_url, demo_url,
       slug, visibilidad, licencia
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [
      autorUuid, datos.titulo, datos.descripcion, datos.repositorioUrl || null, datos.estado,
      datos.programa || null, datos.asignatura || null, datos.semestre || null,
      datos.tipoProyecto || null, datos.profesorUuid || null,
      datos.resumen || null, datos.stack || [], datos.palabrasClave || [],
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

  const proyectos = [
    {
      autor: 'estudiante1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Sistema de riego inteligente para el vivero de la facultad',
      descripcion: 'Prototipo IoT con sensores de humedad y control remoto para automatizar el riego del vivero de Ingeniería Ambiental.',
      repositorioUrl: 'https://github.com/ucp-demo/riego-inteligente',
      programa: 'Ingeniería Ambiental',
      asignatura: 'Automatización y Control',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor1@ucp.edu.co',
      resumen: 'Riego automatizado con sensores de humedad y control remoto para el vivero de la facultad.',
      stack: ['Arduino', 'Python', 'MQTT'],
      palabrasClave: ['iot', 'riego', 'sostenibilidad'],
      videoDemoUrl: 'https://youtube.com/watch?v=demo-riego',
      licencia: 'MIT',
      coautores: [{ email: 'estudiante2@ucp.edu.co', rol: 'desarrollo', aporte: 'Firmware y conexión MQTT', consiente: true }],
      comentarioRevision: 'Buen prototipo, aprobado para la feria de proyectos.',
    },
    {
      autor: 'estudiante2@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'App de reportes de infraestructura del campus',
      descripcion: 'Aplicación móvil para que estudiantes y profesores reporten daños en la infraestructura del campus, con seguimiento de estado.',
      repositorioUrl: 'https://github.com/ucp-demo/reportes-infraestructura',
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Desarrollo Móvil',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor2@ucp.edu.co',
      resumen: 'App móvil para reportar y hacer seguimiento a daños de infraestructura en el campus.',
      stack: ['Flutter', 'Firebase'],
      palabrasClave: ['movil', 'infraestructura', 'campus'],
      comentarioRevision: 'Aprobado.',
    },
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Monitor de calidad del aire con sensores IoT',
      descripcion: 'Red de sensores distribuidos en el campus para medir PM2.5, CO2 y humedad en tiempo real, con dashboard web público.',
      repositorioUrl: 'https://github.com/ucp-demo/monitor-aire',
      programa: 'Ingeniería Ambiental',
      asignatura: 'Proyecto de Grado I',
      semestre: '2025-2',
      tipoProyecto: 'trabajo_de_grado',
      profesor: 'profesor1@ucp.edu.co',
      resumen: 'Red de sensores IoT para medir calidad del aire en el campus, con dashboard público en tiempo real.',
      stack: ['ESP32', 'InfluxDB', 'Grafana'],
      palabrasClave: ['iot', 'calidad-aire', 'ambiental'],
      demoUrl: 'https://monitor-aire-demo.ucp-demo.test',
      licencia: 'CC-BY-4.0',
      coautores: [{ email: 'estudiante4@ucp.edu.co', rol: 'investigacion', aporte: 'Análisis de datos y validación de sensores', consiente: true }],
      comentarioRevision: 'Excelente trabajo de grado, aprobado.',
    },
    {
      autor: 'estudiante1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Plataforma de tutorías entre pares',
      descripcion: 'Sistema de agendamiento para que estudiantes de semestres avanzados ofrezcan tutorías a estudiantes de primeros semestres.',
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Ingeniería de Software II',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      resumen: 'Agendamiento de tutorías entre estudiantes de semestres avanzados y de primeros semestres.',
      stack: ['React', 'Node.js', 'PostgreSQL'],
      palabrasClave: ['educacion', 'tutorias'],
      comentarioRevision: 'Aprobado.',
    },
    {
      autor: 'profesor1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Dashboard de analítica académica para decanatura',
      descripcion: 'Panel con indicadores de deserción, rendimiento por curso y alertas tempranas para la toma de decisiones académicas.',
      repositorioUrl: 'https://github.com/ucp-demo/analitica-academica',
      programa: 'Ingeniería de Sistemas',
      asignatura: null,
      semestre: '2026-1',
      tipoProyecto: 'investigacion',
      resumen: 'Indicadores de deserción y rendimiento académico con alertas tempranas para decanatura.',
      stack: ['Python', 'Pandas', 'Dash'],
      palabrasClave: ['analitica', 'academico'],
      comentarioRevision: 'Autoaprobado por el profesor autor.',
    },
    {
      autor: 'estudiante4@ucp.edu.co',
      estado: 'pendiente',
      titulo: 'Bot de Telegram para consultas de biblioteca',
      descripcion: 'Bot que permite consultar disponibilidad de libros y renovar préstamos desde Telegram, consumiendo la API de la biblioteca.',
      repositorioUrl: 'https://github.com/ucp-demo/bot-biblioteca',
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Integración de Sistemas',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      resumen: 'Bot de Telegram para consultar y renovar préstamos de la biblioteca.',
      stack: ['Node.js', 'Telegram Bot API'],
      palabrasClave: ['bot', 'biblioteca'],
      // A propósito SIN consentir: para demostrar que no se puede aprobar hasta que
      // estudiante2 confirme su consentimiento vía PUT /:id/consentimiento.
      coautores: [{ email: 'estudiante2@ucp.edu.co', rol: 'desarrollo', aporte: 'Integración con la API de biblioteca', consiente: false }],
    },
    {
      autor: 'estudiante2@ucp.edu.co',
      estado: 'pendiente',
      titulo: 'Rediseño del sitio web de bienestar universitario',
      descripcion: 'Propuesta de rediseño UX/UI para el sitio de Bienestar Universitario, con enfoque en accesibilidad.',
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Diseño de Experiencia de Usuario',
      semestre: '2026-1',
      tipoProyecto: 'aplicativo',
      resumen: 'Rediseño UX/UI accesible del sitio de Bienestar Universitario.',
      stack: ['Figma', 'HTML', 'CSS'],
      palabrasClave: ['ux', 'accesibilidad'],
    },
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'rechazado',
      titulo: 'Juego educativo de física en Unity',
      descripcion: 'Simulador de cinemática y dinámica para el curso de Física I.',
      repositorioUrl: 'https://github.com/ucp-demo/fisica-game',
      programa: 'Ingeniería de Sistemas',
      asignatura: 'Física I',
      semestre: '2025-2',
      tipoProyecto: 'aplicativo',
      profesor: 'profesor2@ucp.edu.co',
      resumen: 'Simulador de cinemática y dinámica en Unity para el curso de Física I.',
      stack: ['Unity', 'C#'],
      palabrasClave: ['educativo', 'fisica', 'juego'],
      comentarioRevision: 'Rechazado por alcance incompleto — falta implementar el módulo de dinámica rotacional. Se puede reenviar tras corregir.',
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
    ['Sistema de riego inteligente para el vivero de la facultad', ['estudiante2@ucp.edu.co', 'estudiante3@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co']],
    ['App de reportes de infraestructura del campus', ['estudiante1@ucp.edu.co', 'estudiante3@ucp.edu.co']],
    ['Monitor de calidad del aire con sensores IoT', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co', 'profesor2@ucp.edu.co']],
    ['Plataforma de tutorías entre pares', ['estudiante4@ucp.edu.co']],
    ['Dashboard de analítica académica para decanatura', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'profesor2@ucp.edu.co']],
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
  console.log(`\n${proyectos.length} proyectos (5 aprobados, 2 pendientes, 1 rechazado).`);
  console.log('"Bot de Telegram para consultas de biblioteca" tiene un coautor sin consentir —');
  console.log('sirve para probar que no se puede aprobar hasta que estudiante2 confirme.');

  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
