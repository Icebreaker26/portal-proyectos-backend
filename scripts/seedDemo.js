import bcrypt from 'bcrypt';
import pool from '../src/db/database.js';
import { asignarPermisosPorDefecto } from '../src/services/permisosDefaultService.js';

// Llena la base de datos con usuarios, proyectos y votos de prueba para probar el
// portal manualmente. Idempotente: se puede correr varias veces sin duplicar nada
// (emails/UUIDs se reutilizan via ON CONFLICT). No usar contra una base de producción.
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

const crearProyecto = async (autorUuid, { titulo, descripcion, repositorioUrl, estado }) => {
  // No ON CONFLICT: no hay constraint único sobre (autor, titulo), así que se evita
  // duplicar a mano comprobando si ya existe uno con el mismo título para ese autor.
  const existente = await pool.query(
    `SELECT id FROM proyectos WHERE autor_uuid = $1 AND titulo = $2`,
    [autorUuid, titulo],
  );
  if (existente.rows.length > 0) return existente.rows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO proyectos (autor_uuid, titulo, descripcion, repositorio_url, estado)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [autorUuid, titulo, descripcion, repositorioUrl || null, estado],
  );
  return rows[0].id;
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
    },
    {
      autor: 'estudiante2@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'App de reportes de infraestructura del campus',
      descripcion: 'Aplicación móvil para que estudiantes y profesores reporten daños en la infraestructura del campus, con seguimiento de estado.',
      repositorioUrl: 'https://github.com/ucp-demo/reportes-infraestructura',
    },
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Monitor de calidad del aire con sensores IoT',
      descripcion: 'Red de sensores distribuidos en el campus para medir PM2.5, CO2 y humedad en tiempo real, con dashboard web público.',
      repositorioUrl: 'https://github.com/ucp-demo/monitor-aire',
    },
    {
      autor: 'estudiante1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Plataforma de tutorías entre pares',
      descripcion: 'Sistema de agendamiento para que estudiantes de semestres avanzados ofrezcan tutorías a estudiantes de primeros semestres.',
      repositorioUrl: null,
    },
    {
      autor: 'profesor1@ucp.edu.co',
      estado: 'aprobado',
      titulo: 'Dashboard de analítica académica para decanatura',
      descripcion: 'Panel con indicadores de deserción, rendimiento por curso y alertas tempranas para la toma de decisiones académicas.',
      repositorioUrl: 'https://github.com/ucp-demo/analitica-academica',
    },
    {
      autor: 'estudiante4@ucp.edu.co',
      estado: 'pendiente',
      titulo: 'Bot de Telegram para consultas de biblioteca',
      descripcion: 'Bot que permite consultar disponibilidad de libros y renovar préstamos desde Telegram, consumiendo la API de la biblioteca.',
      repositorioUrl: 'https://github.com/ucp-demo/bot-biblioteca',
    },
    {
      autor: 'estudiante2@ucp.edu.co',
      estado: 'pendiente',
      titulo: 'Rediseño del sitio web de bienestar universitario',
      descripcion: 'Propuesta de rediseño UX/UI para el sitio de Bienestar Universitario, con enfoque en accesibilidad.',
      repositorioUrl: null,
    },
    {
      autor: 'estudiante3@ucp.edu.co',
      estado: 'rechazado',
      titulo: 'Juego educativo de física en Unity',
      descripcion: 'Simulador de cinemática y dinámica para el curso de Física I, rechazado por alcance incompleto — falta rehacer la entrega.',
      repositorioUrl: 'https://github.com/ucp-demo/fisica-game',
    },
  ];

  const proyectoIds = {};
  for (const p of proyectos) {
    const id = await crearProyecto(ids[p.autor], p);
    proyectoIds[p.titulo] = id;
  }

  const votantes = ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'estudiante3@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co', 'profesor2@ucp.edu.co'];

  const votos = [
    ['Sistema de riego inteligente para el vivero de la facultad', ['estudiante2@ucp.edu.co', 'estudiante3@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co']],
    ['App de reportes de infraestructura del campus', ['estudiante1@ucp.edu.co', 'estudiante3@ucp.edu.co']],
    ['Monitor de calidad del aire con sensores IoT', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'estudiante4@ucp.edu.co', 'profesor1@ucp.edu.co', 'profesor2@ucp.edu.co']],
    ['Plataforma de tutorías entre pares', ['estudiante4@ucp.edu.co']],
    ['Dashboard de analítica académica para decanatura', ['estudiante1@ucp.edu.co', 'estudiante2@ucp.edu.co', 'profesor2@ucp.edu.co']],
  ];

  for (const [titulo, emails] of votos) {
    for (const email of emails) {
      if (!votantes.includes(email)) continue;
      await votar(ids[email], proyectoIds[titulo]);
    }
  }

  console.log('Seed de prueba completo.\n');
  console.log(`Contraseña de todas las cuentas: ${PASSWORD}\n`);
  console.log('Usuarios:');
  for (const u of USUARIOS) console.log(`  - ${u.email} (${u.rol})`);
  console.log(`\n${proyectos.length} proyectos (5 aprobados, 2 pendientes, 1 rechazado).`);

  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
